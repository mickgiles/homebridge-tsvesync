/**
 * VeSync Bulb Implementations
 */

import { VeSyncBulb } from './vesyncBulb';
import { VeSync } from './vesync';
import { Helpers } from './helpers';

/**
 * ESL100 Bulb Implementation
 */
export class VeSyncBulbESL100 extends VeSyncBulb {
    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
    }

    async setColorTemp(colorTemp: number): Promise<boolean> {
        return false;
    }
}

/**
 * ESL100CW Bulb Implementation
 */
export class VeSyncBulbESL100CW extends VeSyncBulb {
    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
    }

    async setColorTemp(colorTemp: number): Promise<boolean> {
        if (!this.features.includes('color_temp')) {
            return false;
        }

        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            uuid: this.cid,
            status: 'on',
            colorTemp: colorTemp.toString()
        };

        const [response] = await Helpers.callApi(
            '/SmartBulb/v1/device/updateColorTemperature',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.colorTemp = colorTemp;
            return true;
        }
        return false;
    }
}

/**
 * XYD0001 Bulb Implementation
 */
export class VeSyncBulbXYD0001 extends VeSyncBulb {
    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
    }

    async setColorTemp(colorTemp: number): Promise<boolean> {
        if (!this.features.includes('color_temp')) {
            return false;
        }

        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            uuid: this.cid,
            status: 'on',
            colorTemp: colorTemp.toString()
        };

        const [response] = await Helpers.callApi(
            '/SmartBulb/v1/device/updateColorTemperature',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.colorTemp = colorTemp;
            return true;
        }
        return false;
    }

    async setHsv(hue: number, saturation: number, value: number): Promise<boolean> {
        if (!this.features.includes('rgb_shift')) {
            return false;
        }

        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            uuid: this.cid,
            status: 'on',
            mode: 'color',
            hue: Math.round(hue).toString(),
            saturation: Math.round(saturation).toString(),
            brightness: Math.round(value).toString()
        };

        const [response] = await Helpers.callApi(
            '/SmartBulb/v1/device/updateColor',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.colorHue = hue;
            this.colorSaturation = saturation;
            this.colorValue = value;
            return true;
        }
        return false;
    }

    async enableWhiteMode(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            uuid: this.cid,
            status: 'on',
            colorMode: 'white'
        };

        const [response] = await Helpers.callApi(
            '/SmartBulb/v1/device/updateColorMode',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.colorMode = 'white';
            return true;
        }
        return false;
    }
}

/**
 * ESL100MC Bulb Implementation
 */
export class VeSyncBulbESL100MC extends VeSyncBulb {
    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
    }

    async setColorTemp(colorTemp: number): Promise<boolean> {
        return false;
    }

    async setRgb(red: number, green: number, blue: number): Promise<boolean> {
        if (!this.features.includes('rgb_shift')) {
            return false;
        }

        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            uuid: this.cid,
            status: 'on',
            mode: 'color',
            red: Math.round(red).toString(),
            green: Math.round(green).toString(),
            blue: Math.round(blue).toString()
        };

        const [response] = await Helpers.callApi(
            '/SmartBulb/v1/device/updateColor',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.rgbValues = { red, green, blue };
            return true;
        }
        return false;
    }

    async enableWhiteMode(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            uuid: this.cid,
            status: 'on',
            colorMode: 'white'
        };

        const [response] = await Helpers.callApi(
            '/SmartBulb/v1/device/updateColorMode',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.colorMode = 'white';
            return true;
        }
        return false;
    }
}

// Export the bulb modules dictionary
export const bulbModules: Record<string, any> = {
    'ESL100': VeSyncBulbESL100,
    'ESL100CW': VeSyncBulbESL100CW,
    'XYD0001': VeSyncBulbXYD0001,
    'ESL100MC': VeSyncBulbESL100MC
}; 