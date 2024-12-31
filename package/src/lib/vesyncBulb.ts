/**
 * VeSync Bulb Base Class
 */

import { VeSyncBaseDevice } from './vesyncBaseDevice';
import { VeSync } from './vesync';
import { Helpers } from './helpers';

// Feature dictionary for bulb types
const featureDict: Record<string, { features: string[], colorModel: string }> = {
    'ESL100': {
        features: ['dimmable'],
        colorModel: 'none'
    },
    'ESL100CW': {
        features: ['dimmable', 'color_temp'],
        colorModel: 'none'
    },
    'XYD0001': {
        features: ['dimmable', 'color_temp', 'rgb_shift'],
        colorModel: 'hsv'
    },
    'ESL100MC': {
        features: ['dimmable', 'rgb_shift'],
        colorModel: 'rgb'
    }
};

/**
 * VeSync Bulb Base Class
 */
export abstract class VeSyncBulb extends VeSyncBaseDevice {
    protected brightness: number;
    protected colorTemp: number;
    protected colorValue: number;
    protected colorHue: number;
    protected colorSaturation: number;
    protected colorMode: string;
    protected features: string[];
    protected rgbValues: { red: number, green: number, blue: number };

    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
        this.brightness = 0;
        this.colorTemp = 0;
        this.colorValue = 0;
        this.colorHue = 0;
        this.colorSaturation = 0;
        this.colorMode = '';
        this.features = featureDict[this.deviceType]?.features || [];
        this.rgbValues = {
            red: 0,
            green: 0,
            blue: 0
        };
    }

    /**
     * Get bulb details
     */
    async getDetails(): Promise<void> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicedetail'),
            uuid: this.cid,
            method: 'devicedetail'
        };

        const [response] = await Helpers.callApi(
            '/SmartBulb/v1/device/devicedetail',
            'post',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0 && response?.result) {
            this.deviceStatus = response.result.deviceStatus || this.deviceStatus;
            this.brightness = response.result.brightness || this.brightness;
            if (this.features.includes('color_temp')) {
                this.colorTemp = response.result.colorTemp || this.colorTemp;
            }
            if (this.features.includes('rgb_shift')) {
                if (featureDict[this.deviceType].colorModel === 'rgb') {
                    this.rgbValues = {
                        red: response.result.red || this.rgbValues.red,
                        green: response.result.green || this.rgbValues.green,
                        blue: response.result.blue || this.rgbValues.blue
                    };
                } else {
                    this.colorHue = response.result.hue || this.colorHue;
                    this.colorSaturation = response.result.saturation || this.colorSaturation;
                    this.colorValue = response.result.value || this.colorValue;
                }
            }
        }
    }

    /**
     * Update bulb status
     */
    async update(): Promise<void> {
        await this.getDetails();
    }

    /**
     * Turn bulb on
     */
    async turnOn(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            uuid: this.cid,
            status: 'on'
        };

        const [response] = await Helpers.callApi(
            '/SmartBulb/v1/device/devicestatus',
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
     * Turn bulb off
     */
    async turnOff(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            uuid: this.cid,
            status: 'off'
        };

        const [response] = await Helpers.callApi(
            '/SmartBulb/v1/device/devicestatus',
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
     * Set bulb brightness
     */
    async setBrightness(brightness: number): Promise<boolean> {
        if (!this.features.includes('dimmable')) {
            return false;
        }

        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            uuid: this.cid,
            status: 'on',
            brightNess: brightness.toString()
        };

        const [response] = await Helpers.callApi(
            '/SmartBulb/v1/device/updateBrightness',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.brightness = brightness;
            return true;
        }
        return false;
    }

    /**
     * Get bulb brightness
     */
    getBrightness(): number {
        return this.brightness;
    }

    /**
     * Get color temperature in Kelvin
     */
    getColorTempKelvin(): number {
        if (!this.features.includes('color_temp')) {
            return 0;
        }
        return ((6500 - 2700) * this.colorTemp / 100) + 2700;
    }

    /**
     * Get color temperature in percent
     */
    getColorTempPercent(): number {
        if (!this.features.includes('color_temp')) {
            return 0;
        }
        return this.colorTemp;
    }

    /**
     * Get color hue
     */
    getColorHue(): number {
        if (!this.features.includes('rgb_shift')) {
            return 0;
        }
        return this.colorHue;
    }

    /**
     * Get color saturation
     */
    getColorSaturation(): number {
        if (!this.features.includes('rgb_shift')) {
            return 0;
        }
        return this.colorSaturation;
    }

    /**
     * Get color value
     */
    getColorValue(): number {
        if (!this.features.includes('rgb_shift')) {
            return 0;
        }
        return this.colorValue;
    }

    /**
     * Get RGB values
     */
    getRGBValues(): { red: number, green: number, blue: number } {
        if (!this.features.includes('rgb_shift') || featureDict[this.deviceType].colorModel !== 'rgb') {
            return { red: 0, green: 0, blue: 0 };
        }
        return this.rgbValues;
    }

    /**
     * Set color temperature - Abstract method to be implemented by subclasses
     */
    abstract setColorTemp(colorTemp: number): Promise<boolean>;
} 