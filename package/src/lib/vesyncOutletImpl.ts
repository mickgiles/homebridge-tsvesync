/**
 * VeSync Outlet Implementations
 */

import { VeSyncOutlet } from './vesyncOutlet';
import { VeSync } from './vesync';
import { Helpers } from './helpers';

/**
 * VeSync 7A Outlet
 */
export class VeSyncOutlet7A extends VeSyncOutlet {
    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
    }

    /**
     * Turn outlet on
     */
    async turnOn(): Promise<boolean> {
        const url = `/v1/wifi-switch-1.3/wifi-switch-1.3-${this.cid}/status/on`;
        const [response] = await Helpers.callApi(
            url,
            'put',
            null,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.deviceStatus = 'on';
            return true;
        }
        return false;
    }

    /**
     * Turn outlet off
     */
    async turnOff(): Promise<boolean> {
        const url = `/v1/wifi-switch-1.3/wifi-switch-1.3-${this.cid}/status/off`;
        const [response] = await Helpers.callApi(
            url,
            'put',
            null,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.deviceStatus = 'off';
            return true;
        }
        return false;
    }
}

/**
 * VeSync 10A Outlet
 */
export class VeSyncOutlet10A extends VeSyncOutlet {
    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
    }

    /**
     * Turn outlet on
     */
    async turnOn(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            uuid: this.uuid,
            status: 'on'
        };

        const [response] = await Helpers.callApi(
            '/10a/v1/device/devicestatus',
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
     * Turn outlet off
     */
    async turnOff(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            uuid: this.uuid,
            status: 'off'
        };

        const [response] = await Helpers.callApi(
            '/10a/v1/device/devicestatus',
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
}

/**
 * VeSync 15A Outlet
 */
export class VeSyncOutlet15A extends VeSyncOutlet {
    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
    }

    /**
     * Turn outlet on
     */
    async turnOn(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            uuid: this.uuid,
            status: 'on'
        };

        const [response] = await Helpers.callApi(
            '/15a/v1/device/devicestatus',
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
     * Turn outlet off
     */
    async turnOff(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            uuid: this.uuid,
            status: 'off'
        };

        const [response] = await Helpers.callApi(
            '/15a/v1/device/devicestatus',
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
     * Turn on nightlight
     */
    async turnOnNightlight(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            uuid: this.uuid,
            mode: 'auto'
        };

        const [response] = await Helpers.callApi(
            '/15a/v1/device/nightlightstatus',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.details.nightLightStatus = 'on';
            return true;
        }
        return false;
    }

    /**
     * Turn off nightlight
     */
    async turnOffNightlight(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            uuid: this.uuid,
            mode: 'manual'
        };

        const [response] = await Helpers.callApi(
            '/15a/v1/device/nightlightstatus',
            'put',
            body,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.details.nightLightStatus = 'off';
            return true;
        }
        return false;
    }
}

/**
 * VeSync Outdoor Plug
 */
export class VeSyncOutdoorPlug extends VeSyncOutlet {
    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
    }

    /**
     * Turn outlet on
     */
    async turnOn(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            uuid: this.uuid,
            status: 'on',
            switchNo: 1
        };

        const [response] = await Helpers.callApi(
            '/outdoorsocket15a/v1/device/devicestatus',
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
     * Turn outlet off
     */
    async turnOff(): Promise<boolean> {
        const body = {
            ...Helpers.reqBody(this.manager, 'devicestatus'),
            uuid: this.uuid,
            status: 'off',
            switchNo: 1
        };

        const [response] = await Helpers.callApi(
            '/outdoorsocket15a/v1/device/devicestatus',
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
}

// Export outlet modules dictionary
export const outletModules: Record<string, new (details: Record<string, any>, manager: VeSync) => VeSyncOutlet> = {
    'wifi-switch-1.3': VeSyncOutlet7A,
    'ESW03-USA': VeSyncOutlet10A,
    'ESW01-EU': VeSyncOutlet10A,
    'ESW15-USA': VeSyncOutlet15A,
    'ESO15-TB': VeSyncOutdoorPlug
}; 