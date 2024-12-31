/**
 * VeSync API Device Library
 */

import { Helpers, API_RATE_LIMIT, DEFAULT_TZ } from './helpers';
import { VeSyncBaseDevice } from './vesyncBaseDevice';
import { fanModules } from './vesyncFanImpl';
import { outletModules } from './vesyncOutletImpl';
import { switchModules } from './vesyncSwitchImpl';
import { bulbModules } from './vesyncBulbImpl';
import { VeSyncBulb } from './vesyncBulb';
import { VeSyncOutlet } from './vesyncOutlet';
import { VeSyncSwitch } from './vesyncSwitch';

const DEFAULT_ENERGY_UPDATE_INTERVAL = 21600;

// Device constructor type for concrete device classes only
type DeviceConstructor = new (config: Record<string, any>, manager: VeSync) => VeSyncBaseDevice;

// Module dictionary type
interface DeviceModules {
    [key: string]: DeviceConstructor;
}

// Device categories
type DeviceCategory = 'fans' | 'outlets' | 'switches' | 'bulbs';

/**
 * Create device instance based on type
 */
function objectFactory(details: Record<string, any>, manager: VeSync): [string, VeSyncBaseDevice | null] {
    const deviceType = details.deviceType as string;
    let DeviceClass: DeviceConstructor | null = null;
    let category = 'unknown';

    // Map of device categories to their module dictionaries
    const allModules: Record<string, DeviceModules> = {
        outlets: outletModules,
        fans: fanModules,
        bulbs: bulbModules,
        switches: switchModules
    };

    // First try exact match in all modules
    for (const [cat, modules] of Object.entries(allModules)) {
        if (deviceType in modules) {
            DeviceClass = modules[deviceType];
            category = cat;
            console.debug(`Found exact match for ${deviceType} in ${cat} modules`);
            break;
        }
    }

    // If no exact match, try to find a base class
    if (!DeviceClass) {
        // Device type prefix mapping
        const prefixMap: Record<string, DeviceCategory> = {
            // Fans
            'Core': 'fans',
            'LAP': 'fans',
            'LTF': 'fans',
            'Classic': 'fans',
            'Dual': 'fans',
            'LUH': 'fans',
            'LEH': 'fans',
            'LV-PUR': 'fans',
            'LV-RH': 'fans',
            // Outlets
            'wifi-switch': 'outlets',
            'ESW03': 'outlets',
            'ESW01': 'outlets',
            'ESW15': 'outlets',
            'ESO': 'outlets',
            // Switches
            'ESWL': 'switches',
            'ESWD': 'switches',
            // Bulbs
            'ESL': 'bulbs',
            'XYD': 'bulbs'
        };

        // Find category based on device type prefix
        for (const [prefix, cat] of Object.entries(prefixMap)) {
            if (deviceType.startsWith(prefix)) {
                category = cat;
                console.debug(`Device type ${deviceType} matched prefix ${prefix} -> category ${cat}`);
                
                // Try to find a base class in this category's modules
                const modules = allModules[cat];
                for (const [moduleType, ModuleClass] of Object.entries(modules)) {
                    const baseType = moduleType.split('-')[0]; // e.g., ESL100 from ESL100-USA
                    if (deviceType.startsWith(baseType)) {
                        DeviceClass = ModuleClass;
                        console.debug(`Found base type match: ${deviceType} -> ${baseType}`);
                        break;
                    }
                }
                break;
            }
        }
    }

    if (DeviceClass) {
        try {
            // Add category to device details
            details.deviceCategory = category;
            const device = new DeviceClass(details, manager);
            return [category, device];
        } catch (error) {
            console.error(`Error creating device instance for ${deviceType}:`, error);
            return [category, null];
        }
    } else {
        console.warn(`No device class found for type: ${deviceType}`);
        return [category, null];
    }
}

/**
 * VeSync Manager Class
 */
export class VeSync {
    private _debug: boolean;
    private _redact: boolean;
    private _energyUpdateInterval: number;
    private _energyCheck: boolean;
    private _devList: Record<string, VeSyncBaseDevice[]>;
    private _lastUpdateTs: number | null;
    private _inProcess: boolean;

    username: string;
    password: string;
    token: string | null;
    accountId: string | null;
    countryCode: string | null;
    devices: VeSyncBaseDevice[] | null;
    enabled: boolean;
    updateInterval: number;
    timeZone: string;

    fans: VeSyncBaseDevice[];
    outlets: VeSyncBaseDevice[];
    switches: VeSyncBaseDevice[];
    bulbs: VeSyncBaseDevice[];
    scales: VeSyncBaseDevice[];

    /**
     * Initialize VeSync Manager
     */
    constructor(
        username: string,
        password: string,
        timeZone: string = DEFAULT_TZ,
        debug = false,
        redact = true
    ) {
        this._debug = debug;
        this._redact = redact;
        this._energyUpdateInterval = DEFAULT_ENERGY_UPDATE_INTERVAL;
        this._energyCheck = true;
        this._lastUpdateTs = null;
        this._inProcess = false;

        this.username = username;
        this.password = password;
        this.token = null;
        this.accountId = null;
        this.countryCode = null;
        this.devices = null;
        this.enabled = false;
        this.updateInterval = API_RATE_LIMIT;

        this.fans = [];
        this.outlets = [];
        this.switches = [];
        this.bulbs = [];
        this.scales = [];

        this._devList = {
            fans: this.fans,
            outlets: this.outlets,
            switches: this.switches,
            bulbs: this.bulbs
        };

        if (typeof timeZone === 'string' && timeZone) {
            const regTest = /[^a-zA-Z/_]/;
            if (regTest.test(timeZone)) {
                this.timeZone = DEFAULT_TZ;
                console.debug('Invalid characters in time zone - ', timeZone);
            } else {
                this.timeZone = timeZone;
            }
        } else {
            this.timeZone = DEFAULT_TZ;
            console.debug('Time zone is not a string');
        }

        if (debug) {
            this.debug = true;
        }

        if (redact) {
            this.redact = true;
        }
    }

    /**
     * Get/Set debug mode
     */
    get debug(): boolean {
        return this._debug;
    }

    set debug(flag: boolean) {
        this._debug = flag;
    }

    /**
     * Get/Set redact mode
     */
    get redact(): boolean {
        return this._redact;
    }

    set redact(flag: boolean) {
        this._redact = flag;
        Helpers.shouldRedact = flag;
    }

    /**
     * Get/Set energy update interval
     */
    get energyUpdateInterval(): number {
        return this._energyUpdateInterval;
    }

    set energyUpdateInterval(interval: number) {
        if (interval > 0) {
            this._energyUpdateInterval = interval;
        }
    }

    /**
     * Test if device should be removed
     */
    static removeDevTest(device: VeSyncBaseDevice, newList: any[]): boolean {
        if (Array.isArray(newList) && device.cid) {
            for (const item of newList) {
                if ('cid' in item && device.cid === item.cid) {
                    return true;
                }
            }
            console.debug(`Device removed - ${device.deviceName} - ${device.deviceType}`);
            return false;
        }
        return true;
    }

    /**
     * Test if new device should be added
     */
    addDevTest(newDev: Record<string, any>): boolean {
        if ('cid' in newDev) {
            for (const devices of Object.values(this._devList)) {
                for (const dev of devices) {
                    if (dev.cid === newDev.cid) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    /**
     * Remove devices not found in device list return
     */
    removeOldDevices(devices: any[]): boolean {
        for (const [key, deviceList] of Object.entries(this._devList)) {
            const before = deviceList.length;
            this._devList[key] = deviceList.filter(device => VeSync.removeDevTest(device, devices));
            const after = this._devList[key].length;
            if (before !== after) {
                console.debug(`${before - after} ${key} removed`);
            }
        }
        return true;
    }

    /**
     * Correct devices without cid or uuid
     */
    static setDevId(devices: any[]): any[] {
        const devRem: number[] = [];
        devices.forEach((dev, index) => {
            if (!dev.cid) {
                if (dev.macID) {
                    dev.cid = dev.macID;
                } else if (dev.uuid) {
                    dev.cid = dev.uuid;
                } else {
                    devRem.push(index);
                    console.warn(`Device with no ID - ${dev.deviceName || ''}`);
                }
            }
        });

        if (devRem.length > 0) {
            return devices.filter((_, index) => !devRem.includes(index));
        }
        return devices;
    }

    /**
     * Process device list and instantiate device objects
     */
    processDevices(devList: any[]): boolean {
        // Ensure devices have proper IDs
        const devices = VeSync.setDevId(devList);

        // Count current devices
        let numDevices = 0;
        for (const deviceList of Object.values(this._devList)) {
            numDevices += deviceList.length;
        }

        if (!devices || devices.length === 0) {
            console.warn('No devices found in api return');
            return false;
        }

        // Initialize new device list or remove old devices
        if (numDevices === 0) {
            console.debug('New device list initialized');
        } else {
            this.removeOldDevices(devices);
        }

        // Filter out devices that already exist
        const newDevices = devices.filter(dev => this.addDevTest(dev));

        // Required keys for device instantiation
        const requiredKeys = ['deviceType', 'deviceName', 'deviceStatus', 'cid'];
        
        // Process each new device
        for (const dev of newDevices) {
            // Verify required device properties
            if (!requiredKeys.every(key => key in dev)) {
                console.debug(`Error adding device - missing required properties: ${dev.deviceName || 'Unknown'}`);
                continue;
            }

            const devType = dev.deviceType;
            try {
                // Create device instance using factory
                const [category, deviceObj] = objectFactory(dev, this);
                
                // Add device to appropriate category if valid
                if (deviceObj && category in this._devList) {
                    this._devList[category].push(deviceObj);
                    console.debug(`Added ${devType} device to ${category} category`);
                } else if (category === 'unknown') {
                    console.debug(`Unknown device type: ${devType}`);
                }
            } catch (err) {
                console.error(`Error creating device ${devType}:`, err);
                continue;
            }
        }

        return true;
    }

    /**
     * Get list of VeSync devices
     */
    async getDevices(): Promise<boolean> {
        if (!this.enabled) {
            console.error('Not logged in to VeSync');
            return false;
        }

        this._inProcess = true;
        let procReturn = false;

        try {
            const [response] = await Helpers.callApi(
                '/cloud/v2/deviceManaged/devices',
                'post',
                Helpers.reqBody(this, 'devicelist'),
                Helpers.reqHeaders(this)
            );

            if (response?.result?.list) {
                const deviceList = response.result.list;
                procReturn = this.processDevices(deviceList);

                // Update the main devices array with all devices
                this.devices = Object.values(this._devList).flat();

                // Log device discovery results
                console.log('\n=== Device Discovery Summary ===');
                console.log(`Total devices processed: ${deviceList.length}`);
                
                // Log device types found
                const deviceTypes = deviceList.map((d: Record<string, any>) => d.deviceType);
                console.log('\nDevice types found:', deviceTypes);
                
                // Log devices by category with details
                console.log('\nDevices by Category:');
                console.log('---------------------');
                for (const [category, devices] of Object.entries(this._devList)) {
                    if (devices.length > 0) {
                        console.log(`\n${category.toUpperCase()} (${devices.length} devices):`);
                        devices.forEach((d: VeSyncBaseDevice) => {
                            console.log(`  • ${d.deviceName}`);
                            console.log(`    Type: ${d.deviceType}`);
                            console.log(`    Status: ${d.deviceStatus}`);
                            console.log(`    ID: ${d.cid}`);
                        });
                    }
                }

                // Log summary statistics
                console.log('\nSummary Statistics:');
                console.log('-------------------');
                console.log(`Total Devices: ${this.devices?.length || 0}`);
                for (const [category, devices] of Object.entries(this._devList)) {
                    console.log(`${category}: ${devices.length} devices`);
                }

                console.log('\n=== End of Device Discovery ===\n');
            } else {
                console.error('No devices found in response');
            }
        } catch (error) {
            console.error('Unable to get device list:', error);
        }

        this._inProcess = false;
        return procReturn;
    }

    /**
     * Login to VeSync server
     */
    async login(): Promise<boolean> {
        const body = Helpers.reqBody(this, 'login');
        console.log('Login request:', {
            url: `${process.env.VESYNC_API_URL}/cloud/v1/user/login`,
            body
        });

        try {
            const [response, status] = await Helpers.callApi(
                '/cloud/v1/user/login',
                'post',
                body
            );

            console.log('Login response:', { status, response });

            if (response?.result?.token) {
                this.token = response.result.token;
                this.accountId = response.result.accountID;
                this.countryCode = response.result.countryCode;
                this.enabled = true;
                return true;
            }

            console.error('Unable to login with supplied credentials');
            return false;
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    }

    /**
     * Test if update interval has been exceeded
     */
    deviceTimeCheck(): boolean {
        return (
            this._lastUpdateTs === null ||
            (Date.now() - this._lastUpdateTs) / 1000 > this.updateInterval
        );
    }

    /**
     * Update device list and details
     */
    async update(): Promise<void> {
        if (this.deviceTimeCheck()) {
            if (!this.enabled) {
                console.error('Not logged in to VeSync');
                return;
            }

            await this.getDevices();

            console.debug('Start updating the device details one by one');
            for (const deviceList of Object.values(this._devList)) {
                for (const device of deviceList) {
                    try {
                        await device.getDetails();
                    } catch (error) {
                        console.error(`Error updating ${device.deviceName}:`, error);
                    }
                }
            }

            this._lastUpdateTs = Date.now();
        }
    }

    /**
     * Create device instance from details
     */
    createDevice(details: Record<string, any>): VeSyncBaseDevice | null {
        const deviceType = details.deviceType;
        const deviceClass = fanModules[deviceType];
        
        if (deviceClass) {
            return new deviceClass(details, this);
        }
        
        return null;
    }
} 