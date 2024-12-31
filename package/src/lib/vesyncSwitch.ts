/**
 * VeSync Switch Classes
 */

import { VeSyncBaseDevice } from './vesyncBaseDevice';
import { VeSync } from './vesync';
import { Helpers } from './helpers';

type DeviceConstructor = new (config: Record<string, any>, manager: VeSync) => VeSyncBaseDevice;

interface SwitchConfig {
    [key: string]: {
        module: string;
        features: string[];
    };
}

// Switch configuration
export const switchConfig: SwitchConfig = {
    'ESWL01': {
        module: 'VeSyncWallSwitch',
        features: []
    },
    'ESWD16': {
        module: 'VeSyncDimmerSwitch',
        features: ['dimmable']
    },
    'ESWL03': {
        module: 'VeSyncWallSwitch',
        features: []
    }
};

/**
 * Base class for VeSync Switches
 */
export abstract class VeSyncSwitch extends VeSyncBaseDevice {
    protected details: Record<string, any> = {};
    protected features: string[] = [];

    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
        this.details = details;
        this.features = switchConfig[this.deviceType]?.features || [];
    }

    /**
     * Get active time of switch
     */
    get activeTime(): number {
        return this.details.active_time ?? 0;
    }

    /**
     * Return true if switch is dimmable
     */
    isDimmable(): boolean {
        return this.features.includes('dimmable');
    }

    /**
     * Return formatted device info to stdout
     */
    display(): void {
        super.display();
        const info = [
            ['Active Time:', this.activeTime]
        ];

        for (const [key, value] of info) {
            console.log(`${key.toString().padEnd(30, '.')} ${value}`);
        }
    }

    /**
     * Return JSON details for switch
     */
    displayJSON(): string {
        const baseInfo = JSON.parse(super.displayJSON());
        return JSON.stringify({
            ...baseInfo,
            'Active Time': this.activeTime
        }, null, 4);
    }

    abstract getDetails(): Promise<void>;
    abstract getConfig(): Promise<void>;
    abstract turnOn(): Promise<boolean>;
    abstract turnOff(): Promise<boolean>;

    /**
     * Update device details
     */
    async update(): Promise<void> {
        await this.getDetails();
    }
}

/**
 * VeSync Wall Switch
 */
export class VeSyncWallSwitch extends VeSyncSwitch {
    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
    }

    /**
     * Get wall switch details
     */
    async getDetails(): Promise<void> {
        const body = Helpers.reqBody(this.manager, 'devicedetail');
        body.uuid = this.uuid;

        const [response] = await Helpers.callApi(
            '/inwallswitch/v1/device/devicedetail',
            'post',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0 && response?.result) {
            const result = response.result;
            this.deviceStatus = result.deviceStatus ?? this.deviceStatus;
            this.details.active_time = result.activeTime ?? 0;
            this.connectionStatus = result.connectionStatus ?? this.connectionStatus;
        } else {
            console.debug(`Error getting ${this.deviceName} details`);
        }
    }

    /**
     * Get switch device configuration info
     */
    async getConfig(): Promise<void> {
        const body = Helpers.reqBody(this.manager, 'devicedetail');
        body.method = 'configurations';
        body.uuid = this.uuid;

        const [response] = await Helpers.callApi(
            '/inwallswitch/v1/device/configurations',
            'post',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.config = Helpers.buildConfigDict(response);
        } else {
            console.debug(`Unable to get ${this.deviceName} config info`);
        }
    }

    /**
     * Turn off wall switch
     */
    async turnOff(): Promise<boolean> {
        const body = Helpers.reqBody(this.manager, 'devicestatus');
        body.status = 'off';
        body.uuid = this.uuid;

        const [response] = await Helpers.callApi(
            '/inwallswitch/v1/device/devicestatus',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.deviceStatus = 'off';
            return true;
        }
        console.debug(`Error turning ${this.deviceName} off`);
        return false;
    }

    /**
     * Turn on wall switch
     */
    async turnOn(): Promise<boolean> {
        const body = Helpers.reqBody(this.manager, 'devicestatus');
        body.status = 'on';
        body.uuid = this.uuid;

        const [response] = await Helpers.callApi(
            '/inwallswitch/v1/device/devicestatus',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.deviceStatus = 'on';
            return true;
        }
        console.debug(`Error turning ${this.deviceName} on`);
        return false;
    }
}

/**
 * VeSync Dimmer Switch
 */
export class VeSyncDimmerSwitch extends VeSyncSwitch {
    private _brightness: number = 0;
    private _rgbValue: Record<string, number> = { red: 0, blue: 0, green: 0 };
    private _rgbStatus: string = 'unknown';
    private _indicatorLight: string = 'unknown';

    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
    }

    /**
     * Get dimmer switch details
     */
    async getDetails(): Promise<void> {
        const body = Helpers.reqBody(this.manager, 'devicedetail');
        body.uuid = this.uuid;

        const [response] = await Helpers.callApi(
            '/dimmer/v1/device/devicedetail',
            'post',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0 && response?.result) {
            const result = response.result;
            this.deviceStatus = result.deviceStatus ?? this.deviceStatus;
            this.details.active_time = result.activeTime ?? 0;
            this.connectionStatus = result.connectionStatus ?? this.connectionStatus;
            this._brightness = result.brightness ?? this._brightness;
            this._rgbStatus = result.rgbStatus ?? this._rgbStatus;
            this._indicatorLight = result.indicatorlightStatus ?? this._indicatorLight;
            if (result.rgbValue) {
                this._rgbValue = {
                    red: result.rgbValue.red ?? 0,
                    green: result.rgbValue.green ?? 0,
                    blue: result.rgbValue.blue ?? 0
                };
            }
        } else {
            console.debug(`Error getting ${this.deviceName} details`);
        }
    }

    /**
     * Get dimmer switch configuration info
     */
    async getConfig(): Promise<void> {
        const body = Helpers.reqBody(this.manager, 'devicedetail');
        body.method = 'configurations';
        body.uuid = this.uuid;

        const [response] = await Helpers.callApi(
            '/dimmer/v1/device/configurations',
            'post',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.config = Helpers.buildConfigDict(response);
        } else {
            console.debug(`Unable to get ${this.deviceName} config info`);
        }
    }

    /**
     * Turn off dimmer switch
     */
    async turnOff(): Promise<boolean> {
        const body = Helpers.reqBody(this.manager, 'devicestatus');
        body.status = 'off';
        body.uuid = this.uuid;

        const [response] = await Helpers.callApi(
            '/dimmer/v1/device/devicestatus',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.deviceStatus = 'off';
            return true;
        }
        console.debug(`Error turning ${this.deviceName} off`);
        return false;
    }

    /**
     * Turn on dimmer switch
     */
    async turnOn(): Promise<boolean> {
        const body = Helpers.reqBody(this.manager, 'devicestatus');
        body.status = 'on';
        body.uuid = this.uuid;

        const [response] = await Helpers.callApi(
            '/dimmer/v1/device/devicestatus',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.deviceStatus = 'on';
            return true;
        }
        console.debug(`Error turning ${this.deviceName} on`);
        return false;
    }

    /**
     * Return brightness in percent
     */
    get brightness(): number {
        return this._brightness;
    }

    /**
     * Return faceplate brightness light status
     */
    get indicatorLightStatus(): string {
        return this._indicatorLight;
    }

    /**
     * Return RGB faceplate light status
     */
    get rgbLightStatus(): string {
        return this._rgbStatus;
    }

    /**
     * Return RGB light values
     */
    get rgbLightValue(): Record<string, number> {
        return this._rgbValue;
    }

    /**
     * Update device details
     */
    async update(): Promise<void> {
        await this.getDetails();
    }

    /**
     * Display device info
     */
    display(): void {
        super.display();
        const info = [
            ['Brightness:', this.brightness, '%'],
            ['RGB Status:', this.rgbLightStatus],
            ['RGB Values:', JSON.stringify(this.rgbLightValue)],
            ['Indicator Light:', this.indicatorLightStatus]
        ];

        for (const [key, value, unit = ''] of info) {
            console.log(`${key.toString().padEnd(30, '.')} ${value}${unit}`);
        }
    }

    /**
     * Return JSON details for dimmer switch
     */
    displayJSON(): string {
        const baseInfo = JSON.parse(super.displayJSON());
        return JSON.stringify({
            ...baseInfo,
            'Brightness': this.brightness,
            'RGB Status': this.rgbLightStatus,
            'RGB Values': this.rgbLightValue,
            'Indicator Light': this.indicatorLightStatus
        }, null, 4);
    }

    /**
     * Set brightness level
     * @param brightness - Brightness level (1-100)
     */
    async setBrightness(brightness: number): Promise<boolean> {
        const body = Helpers.reqBody(this.manager, 'devicestatus');
        body.uuid = this.uuid;
        body.brightness = brightness;

        const [response] = await Helpers.callApi(
            '/dimmer/v1/device/updatebrightness',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this._brightness = brightness;
            return true;
        }
        console.debug(`Error setting ${this.deviceName} brightness`);
        return false;
    }

    /**
     * Toggle indicator light status
     * @param status - Light status ('on' or 'off')
     */
    async indicatorLightToggle(status: string): Promise<boolean> {
        if (status !== 'on' && status !== 'off') {
            console.debug('Invalid status passed to indicator light toggle');
            return false;
        }

        const body = Helpers.reqBody(this.manager, 'devicestatus');
        body.uuid = this.uuid;
        body.status = status;

        const [response] = await Helpers.callApi(
            '/dimmer/v1/device/indicatorlightstatus',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this._indicatorLight = status;
            return true;
        }
        console.debug(`Error toggling ${this.deviceName} indicator light`);
        return false;
    }

    /**
     * Set RGB color values
     * @param red - Red value (0-255)
     * @param green - Green value (0-255)
     * @param blue - Blue value (0-255)
     */
    async rgbColorSet(red: number, green: number, blue: number): Promise<boolean> {
        const body = Helpers.reqBody(this.manager, 'devicestatus');
        body.uuid = this.uuid;
        body.rgbValue = { red, green, blue };
        body.status = 'on';

        const [response] = await Helpers.callApi(
            '/dimmer/v1/device/devicergbstatus',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this._rgbValue = { red, green, blue };
            this._rgbStatus = 'on';
            return true;
        }
        console.debug(`Error setting ${this.deviceName} RGB color`);
        return false;
    }

    /**
     * Toggle switch status
     * @param status - Switch status ('on' or 'off')
     */
    async switchToggle(status: string): Promise<boolean> {
        if (status !== 'on' && status !== 'off') {
            console.debug('Invalid status passed to switch toggle');
            return false;
        }

        return status === 'on' ? this.turnOn() : this.turnOff();
    }

    /**
     * Set faceplate RGB color status and optionally set RGB values
     * @param status - RGB status ('on' or 'off')
     * @param red - Optional red value (0-255)
     * @param green - Optional green value (0-255)
     * @param blue - Optional blue value (0-255)
     */
    async rgbColorStatus(status: string, red?: number, green?: number, blue?: number): Promise<boolean> {
        if (status !== 'on' && status !== 'off') {
            console.debug('Invalid status passed to RGB color status');
            return false;
        }

        const body = Helpers.reqBody(this.manager, 'devicestatus');
        body.uuid = this.uuid;
        body.status = status;

        if (red !== undefined && green !== undefined && blue !== undefined) {
            body.rgbValue = { red, green, blue };
            this._rgbValue = { red, green, blue };
        }

        const [response] = await Helpers.callApi(
            '/dimmer/v1/device/devicergbstatus',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this._rgbStatus = status;
            return true;
        }
        console.debug(`Error setting ${this.deviceName} RGB status`);
        return false;
    }

    /**
     * Turn RGB Color Off
     */
    async rgbColorOff(): Promise<boolean> {
        return this.rgbColorStatus('off');
    }

    /**
     * Turn RGB Color On
     */
    async rgbColorOn(): Promise<boolean> {
        return this.rgbColorStatus('on');
    }

    /**
     * Turn indicator light on
     */
    async indicatorLightOn(): Promise<boolean> {
        return this.indicatorLightToggle('on');
    }

    /**
     * Turn indicator light off
     */
    async indicatorLightOff(): Promise<boolean> {
        return this.indicatorLightToggle('off');
    }
}

// Export switch modules for device factory
export const switchModules: Record<string, DeviceConstructor> = {
    'ESWL01': VeSyncWallSwitch,
    'ESWL03': VeSyncWallSwitch,
    'ESWD16': VeSyncDimmerSwitch
}; 