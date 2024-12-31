/**
 * VeSync Switch Implementations
 */

import { VeSyncSwitch } from './vesyncSwitch';
import { VeSync } from './vesync';
import { Helpers } from './helpers';

/**
 * Basic Wall Switch Implementation (ESWL01, ESWL03)
 */
export class VeSyncWallSwitch extends VeSyncSwitch {
    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
    }

    /**
     * Get wall switch details
     */
    async getDetails(): Promise<void> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicedetail'),
            uuid: this.cid,
            method: 'devicedetail'
        };

        const [response] = await Helpers.callApi(
            '/inwallswitch/v1/device/devicedetail',
            'post',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0 && response?.result) {
            const result = response.result;
            this.deviceStatus = result.deviceStatus || this.deviceStatus;
            this.details.active_time = result.activeTime || 0;
            this.connectionStatus = result.connectionStatus || this.connectionStatus;
        }
    }

    /**
     * Get switch device configuration info
     */
    async getConfig(): Promise<void> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicedetail'),
            method: 'configurations',
            uuid: this.cid
        };

        const [response] = await Helpers.callApi(
            '/inwallswitch/v1/device/configurations',
            'post',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.config = Helpers.buildConfigDict(response);
        }
    }

    /**
     * Turn off wall switch
     */
    async turnOff(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            status: 'off',
            uuid: this.cid
        };

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
        return false;
    }

    /**
     * Turn on wall switch
     */
    async turnOn(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            status: 'on',
            uuid: this.cid
        };

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
        return false;
    }
}

/**
 * Dimmer Switch Implementation (ESWD16)
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
        const body = {
            ...Helpers.reqBody(this.manager, 'devicedetail'),
            uuid: this.cid,
            method: 'devicedetail'
        };

        const [response] = await Helpers.callApi(
            '/dimmer/v1/device/devicedetail',
            'post',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0 && response?.result) {
            const result = response.result;
            this.deviceStatus = result.deviceStatus || this.deviceStatus;
            this.details.active_time = result.activeTime || 0;
            this.connectionStatus = result.connectionStatus || this.connectionStatus;
            this._brightness = result.brightness || this._brightness;
            this._rgbStatus = result.rgbStatus || this._rgbStatus;
            this._indicatorLight = result.indicatorlightStatus || this._indicatorLight;
            if (result.rgbValue) {
                this._rgbValue = {
                    red: result.rgbValue.red || 0,
                    green: result.rgbValue.green || 0,
                    blue: result.rgbValue.blue || 0
                };
            }
        }
    }

    /**
     * Get dimmer switch configuration info
     */
    async getConfig(): Promise<void> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicedetail'),
            method: 'configurations',
            uuid: this.cid
        };

        const [response] = await Helpers.callApi(
            '/dimmer/v1/device/configurations',
            'post',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.config = Helpers.buildConfigDict(response);
        }
    }

    /**
     * Turn off dimmer switch
     */
    async turnOff(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            status: 'off',
            uuid: this.cid
        };

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
        return false;
    }

    /**
     * Turn on dimmer switch
     */
    async turnOn(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            status: 'on',
            uuid: this.cid
        };

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
        return false;
    }

    /**
     * Set brightness level
     */
    async setBrightness(brightness: number): Promise<boolean> {
        if (!this.isDimmable()) {
            return false;
        }

        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            brightness: brightness.toString(),
            uuid: this.cid
        };

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
        return false;
    }

    /**
     * Set RGB indicator color
     */
    async rgbColorSet(red: number, green: number, blue: number): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            rgbValue: {
                red: Math.round(red),
                green: Math.round(green),
                blue: Math.round(blue)
            },
            status: 'on',
            uuid: this.cid
        };

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
        return false;
    }

    /**
     * Turn on RGB indicator
     */
    async rgbColorOn(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            status: 'on',
            uuid: this.cid
        };

        const [response] = await Helpers.callApi(
            '/dimmer/v1/device/devicergbstatus',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this._rgbStatus = 'on';
            return true;
        }
        return false;
    }

    /**
     * Turn off RGB indicator
     */
    async rgbColorOff(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            status: 'off',
            uuid: this.cid
        };

        const [response] = await Helpers.callApi(
            '/dimmer/v1/device/devicergbstatus',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this._rgbStatus = 'off';
            return true;
        }
        return false;
    }

    /**
     * Turn on indicator light
     */
    async indicatorLightOn(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            status: 'on',
            uuid: this.cid
        };

        const [response] = await Helpers.callApi(
            '/dimmer/v1/device/indicatorlightstatus',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this._indicatorLight = 'on';
            return true;
        }
        return false;
    }

    /**
     * Turn off indicator light
     */
    async indicatorLightOff(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            status: 'off',
            uuid: this.cid
        };

        const [response] = await Helpers.callApi(
            '/dimmer/v1/device/indicatorlightstatus',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this._indicatorLight = 'off';
            return true;
        }
        return false;
    }

    // Getters
    get brightness(): number {
        return this._brightness;
    }

    get indicatorLightStatus(): string {
        return this._indicatorLight;
    }

    get rgbLightStatus(): string {
        return this._rgbStatus;
    }

    get rgbLightValue(): Record<string, number> {
        return { ...this._rgbValue };
    }
}

// Export the switch modules dictionary
export const switchModules: Record<string, any> = {
    'ESWL01': VeSyncWallSwitch,
    'ESWL03': VeSyncWallSwitch,
    'ESWD16': VeSyncDimmerSwitch
}; 