/**
 * VeSync Fan Implementations
 */

import { VeSyncFan } from './vesyncFan';
import { VeSync } from './vesync';
import { Helpers } from './helpers';

/**
 * VeSync Air Purifier with Bypass
 */
export class VeSyncAirBypass extends VeSyncFan {
    protected readonly modes = ['auto', 'manual', 'sleep'] as const;
    protected readonly speeds = [1, 2, 3, 4, 5];
    protected readonly displayModes = ['on', 'off'] as const;
    protected readonly childLockModes = ['on', 'off'] as const;

    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
    }

    /**
     * Get device details
     */
    async getDetails(): Promise<void> {
        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {},
                    method: 'getPurifierStatus',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        if (this.checkResponse([response, status], 'getDetails')) {
            const result = response?.result?.result;
            if (result) {
                // Update device status
                this.deviceStatus = result.enabled ? 'on' : 'off';
                
                // Store device settings
                this.details = {
                    mode: result.mode || '',
                    speed: result.level || 0,
                    filterLife: result.filter_life || 0,
                    screenStatus: result.display || false,
                    childLock: result.child_lock || false,
                    airQuality: result.air_quality || 0
                };

                // Store configuration if available
                if (result.configuration) {
                    this.config = result.configuration;
                }
            }
        }
    }

    /**
     * Turn device on
     */
    async turnOn(): Promise<boolean> {
        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        enabled: true,
                        id: 0
                    },
                    method: 'setSwitch',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'turnOn');
    }

    /**
     * Turn device off
     */
    async turnOff(): Promise<boolean> {
        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        enabled: false,
                        id: 0
                    },
                    method: 'setSwitch',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'turnOff');
    }

    /**
     * Change fan speed
     */
    async changeFanSpeed(speed: number): Promise<boolean> {
        if (!this.speeds.includes(speed)) {
            throw new Error(`Invalid speed: ${speed}. Must be one of: ${this.speeds.join(', ')}`);
        }

        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        id: 0,
                        level: speed,
                        mode: 'manual',
                        type: 'wind'
                    },
                    method: 'setLevel',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'changeFanSpeed');
    }

    /**
     * Set device mode
     */
    async setMode(mode: string): Promise<boolean> {
        if (!this.modes.includes(mode as any)) {
            throw new Error(`Invalid mode: ${mode}. Must be one of: ${this.modes.join(', ')}`);
        }

        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        mode
                    },
                    method: 'setPurifierMode',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'setMode');
    }

    /**
     * Set display status
     */
    async setDisplay(enabled: boolean): Promise<boolean> {
        if (!this.hasFeature('display')) {
            throw new Error('Display control not supported');
        }

        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        state: enabled
                    },
                    method: 'setDisplay',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'setDisplay');
    }

    /**
     * Set child lock
     */
    async setChildLock(enabled: boolean): Promise<boolean> {
        if (!this.hasFeature('child_lock')) {
            throw new Error('Child lock not supported');
        }

        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        state: enabled
                    },
                    method: 'setChildLock',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'setChildLock');
    }

    /**
     * Set timer
     */
    async setTimer(hours: number): Promise<boolean> {
        if (!this.hasFeature('timer')) {
            throw new Error('Timer not supported');
        }

        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        action: 'off',
                        total: hours * 3600
                    },
                    method: 'addTimer',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'setTimer');
    }

    /**
     * Clear timer
     */
    async clearTimer(): Promise<boolean> {
        if (!this.hasFeature('timer')) {
            throw new Error('Timer not supported');
        }

        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {},
                    method: 'deleteTimer',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'clearTimer');
    }

    /**
     * Turn automatic stop on
     */
    async automaticStopOn(): Promise<boolean> {
        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        enabled: true
                    },
                    method: 'setAutomaticStop',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'automaticStopOn');
    }

    /**
     * Turn automatic stop off
     */
    async automaticStopOff(): Promise<boolean> {
        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        enabled: false
                    },
                    method: 'setAutomaticStop',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'automaticStopOff');
    }
}

/**
 * VeSync Humidifier Base Class
 */
export class VeSyncHumidifier extends VeSyncFan {
    protected readonly modes = ['auto', 'manual', 'sleep'] as const;
    protected readonly speeds = [1, 2, 3];
    protected readonly displayModes = ['on', 'off'] as const;
    protected readonly mistLevels = [1, 2, 3];
    protected readonly humidityRange = { min: 30, max: 80 };

    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
    }

    /**
     * Get device details
     */
    async getDetails(): Promise<void> {
        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {},
                    method: 'getHumidifierStatus',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        if (this.checkResponse([response, status], 'getDetails')) {
            this.details = response.result.result;
        }
    }

    /**
     * Turn device on
     */
    async turnOn(): Promise<boolean> {
        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        enabled: true,
                        id: 0
                    },
                    method: 'setSwitch',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'turnOn');
    }

    /**
     * Turn device off
     */
    async turnOff(): Promise<boolean> {
        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        enabled: false,
                        id: 0
                    },
                    method: 'setSwitch',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'turnOff');
    }

    /**
     * Change fan speed
     */
    async changeFanSpeed(speed: number): Promise<boolean> {
        if (!this.speeds.includes(speed)) {
            throw new Error(`Invalid speed: ${speed}. Must be one of: ${this.speeds.join(', ')}`);
        }

        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        id: 0,
                        level: speed,
                        type: 'wind'
                    },
                    method: 'setLevel',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'changeFanSpeed');
    }

    /**
     * Set device mode
     */
    async setMode(mode: string): Promise<boolean> {
        if (!this.modes.includes(mode as any)) {
            throw new Error(`Invalid mode: ${mode}. Must be one of: ${this.modes.join(', ')}`);
        }

        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        mode
                    },
                    method: 'setHumidifierMode',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'setMode');
    }

    /**
     * Set mist level
     */
    async setMistLevel(level: number): Promise<boolean> {
        if (!this.hasFeature('mist')) {
            throw new Error('Mist control not supported');
        }

        if (!this.mistLevels.includes(level)) {
            throw new Error(`Invalid mist level: ${level}. Must be one of: ${this.mistLevels.join(', ')}`);
        }

        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        mistLevel: level
                    },
                    method: 'setMistLevel',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'setMistLevel');
    }

    /**
     * Set target humidity
     */
    async setHumidity(humidity: number): Promise<boolean> {
        if (!this.hasFeature('humidity')) {
            throw new Error('Humidity control not supported');
        }

        if (humidity < this.humidityRange.min || humidity > this.humidityRange.max) {
            throw new Error(`Invalid humidity: ${humidity}. Must be between ${this.humidityRange.min} and ${this.humidityRange.max}`);
        }

        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        targetHumidity: humidity
                    },
                    method: 'setTargetHumidity',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'setHumidity');
    }

    /**
     * Set display status
     */
    async setDisplay(enabled: boolean): Promise<boolean> {
        if (!this.hasFeature('display')) {
            throw new Error('Display control not supported');
        }

        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        state: enabled
                    },
                    method: 'setDisplay',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'setDisplay');
    }

    /**
     * Set timer
     */
    async setTimer(hours: number): Promise<boolean> {
        if (!this.hasFeature('timer')) {
            throw new Error('Timer not supported');
        }

        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        action: 'off',
                        total: hours * 3600
                    },
                    method: 'addTimer',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'setTimer');
    }

    /**
     * Clear timer
     */
    async clearTimer(): Promise<boolean> {
        if (!this.hasFeature('timer')) {
            throw new Error('Timer not supported');
        }

        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {},
                    method: 'deleteTimer',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'clearTimer');
    }

    /**
     * Turn automatic stop on
     */
    async automaticStopOn(): Promise<boolean> {
        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        enabled: true
                    },
                    method: 'setAutomaticStop',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'automaticStopOn');
    }

    /**
     * Turn automatic stop off
     */
    async automaticStopOff(): Promise<boolean> {
        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        enabled: false
                    },
                    method: 'setAutomaticStop',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'automaticStopOff');
    }
}

/**
 * VeSync Warm Humidifier Class
 */
export class VeSyncWarmHumidifier extends VeSyncHumidifier {
    protected readonly warmLevels = [1, 2, 3];

    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
    }

    /**
     * Set warm mist level
     */
    async setWarmLevel(level: number): Promise<boolean> {
        if (!this.hasFeature('warm')) {
            throw new Error('Warm mist control not supported');
        }

        if (!this.warmLevels.includes(level)) {
            throw new Error(`Invalid warm level: ${level}. Must be one of: ${this.warmLevels.join(', ')}`);
        }

        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        warmLevel: level
                    },
                    method: 'setWarmLevel',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'setWarmLevel');
    }

    /**
     * Set drying mode enabled
     */
    async setDryingModeEnabled(enabled: boolean): Promise<boolean> {
        if (!this.hasFeature('drying')) {
            throw new Error('Drying mode not supported');
        }

        const [response, status] = await Helpers.callApi(
            '/cloud/v2/deviceManaged/bypassV2',
            'post',
            {
                ...Helpers.reqBody(this.manager, 'bypassV2'),
                cid: this.cid,
                configModule: this.configModule,
                payload: {
                    data: {
                        autoDryingSwitch: enabled ? 1 : 0
                    },
                    method: 'setDryingMode',
                    source: 'APP'
                }
            },
            Helpers.reqHeaderBypass()
        );

        return this.checkResponse([response, status], 'setDryingModeEnabled');
    }
}

// Export fan modules dictionary
export const fanModules: Record<string, new (details: Record<string, any>, manager: VeSync) => VeSyncFan> = {
    // Core Series
    'Core200S': VeSyncAirBypass,
    'Core300S': VeSyncAirBypass,
    'Core400S': VeSyncAirBypass,
    'Core600S': VeSyncAirBypass,
    
    // LAP Series
    'LAP-C201S-AUSR': VeSyncAirBypass,
    'LAP-C202S-WUSR': VeSyncAirBypass,
    'LAP-C301S-WJP': VeSyncAirBypass,
    'LAP-C302S-WUSB': VeSyncAirBypass,
    'LAP-C301S-WAAA': VeSyncAirBypass,
    'LAP-C401S-WJP': VeSyncAirBypass,
    'LAP-C401S-WUSR': VeSyncAirBypass,
    'LAP-C401S-WAAA': VeSyncAirBypass,
    'LAP-C601S-WUS': VeSyncAirBypass,
    'LAP-C601S-WUSR': VeSyncAirBypass,
    'LAP-C601S-WEU': VeSyncAirBypass,
    'LAP-V102S-AASR': VeSyncAirBypass,
    'LAP-V102S-WUS': VeSyncAirBypass,
    'LAP-V102S-WEU': VeSyncAirBypass,
    'LAP-V102S-AUSR': VeSyncAirBypass,
    'LAP-V102S-WJP': VeSyncAirBypass,
    'LAP-V201S-AASR': VeSyncAirBypass,
    'LAP-V201S-WJP': VeSyncAirBypass,
    'LAP-V201S-WEU': VeSyncAirBypass,
    'LAP-V201S-WUS': VeSyncAirBypass,
    'LAP-V201-AUSR': VeSyncAirBypass,
    'LAP-V201S-AUSR': VeSyncAirBypass,
    'LAP-V201S-AEUR': VeSyncAirBypass,
    'LAP-EL551S-AUS': VeSyncAirBypass,
    'LAP-EL551S-AEUR': VeSyncAirBypass,
    'LAP-EL551S-WEU': VeSyncAirBypass,
    'LAP-EL551S-WUS': VeSyncAirBypass,
    
    // LTF Series
    'LTF-F422S-KEU': VeSyncAirBypass,
    'LTF-F422S-WUSR': VeSyncAirBypass,
    'LTF-F422_WJP': VeSyncAirBypass,
    'LTF-F422S-WUS': VeSyncAirBypass,
    
    // Classic Series
    'Classic300S': VeSyncHumidifier,
    'Classic200S': VeSyncHumidifier,
    
    // Dual Series
    'Dual200S': VeSyncHumidifier,
    
    // LUH Series
    'LUH-A601S-WUSB': VeSyncWarmHumidifier,
    'LUH-A601S-AUSW': VeSyncWarmHumidifier,
    'LUH-D301S-WUSR': VeSyncWarmHumidifier,
    'LUH-D301S-WJP': VeSyncWarmHumidifier,
    'LUH-D301S-WEU': VeSyncWarmHumidifier,
    'LUH-A602S-WUSR': VeSyncWarmHumidifier,
    'LUH-A602S-WUS': VeSyncWarmHumidifier,
    'LUH-A602S-WEUR': VeSyncWarmHumidifier,
    'LUH-A602S-WEU': VeSyncWarmHumidifier,
    'LUH-A602S-WJP': VeSyncWarmHumidifier,
    'LUH-A602S-WUSC': VeSyncWarmHumidifier,
    'LUH-O451S-WEU': VeSyncWarmHumidifier,
    'LUH-O451S-WUS': VeSyncWarmHumidifier,
    'LUH-O451S-WUSR': VeSyncWarmHumidifier,
    'LUH-O601S-WUS': VeSyncWarmHumidifier,
    'LUH-O601S-KUS': VeSyncWarmHumidifier,
    'LUH-M101S-WUS': VeSyncWarmHumidifier,
    
    // LEH Series
    'LEH-S601S-WUS': VeSyncWarmHumidifier,
    'LEH-S601S-WUSR': VeSyncWarmHumidifier,
    
    // LV Series
    'LV-PUR131S': VeSyncAirBypass,
    'LV-RH131S': VeSyncAirBypass
}; 