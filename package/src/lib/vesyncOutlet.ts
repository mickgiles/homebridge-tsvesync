/**
 * VeSync Outlets
 */

import { VeSyncBaseDevice } from './vesyncBaseDevice';
import { VeSync } from './vesync';
import { Helpers } from './helpers';

/**
 * VeSync Outlet Base Class
 */
export abstract class VeSyncOutlet extends VeSyncBaseDevice {
    protected energy: Record<string, any>;
    protected details: Record<string, any>;

    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
        this.energy = {};
        this.details = details;
    }

    /**
     * Get outlet details
     */
    async getDetails(): Promise<void> {
        const url = `/v1/${this.deviceType}/${this.deviceType}-${this.cid}/detail`;
        const [response] = await Helpers.callApi(
            url,
            'get',
            null,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.details = response.result;
            this.deviceStatus = response.result.deviceStatus;
        }
    }

    /**
     * Update outlet energy data
     */
    async updateEnergy(): Promise<void> {
        const url = `/v1/${this.deviceType}/${this.deviceType}-${this.cid}/energy/detail`;
        const [response] = await Helpers.callApi(
            url,
            'get',
            null,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.energy = response.result;
        }
    }

    /**
     * Get outlet energy usage
     */
    async getEnergyUsage(): Promise<Record<string, any>> {
        await this.updateEnergy();
        return {
            power: this.energy.power || 'Not available',
            voltage: this.energy.voltage || 'Not available',
            energy_today: this.energy.energyToday || 'Not available',
            energy_week: this.energy.energyWeek || 'Not available',
            energy_month: this.energy.energyMonth || 'Not available',
            energy_year: this.energy.energyYear || 'Not available'
        };
    }

    /**
     * Get outlet status
     */
    async getStatus(): Promise<string> {
        await this.getDetails();
        return this.deviceStatus;
    }

    /**
     * Get weekly energy data
     */
    async getWeeklyEnergy(): Promise<void> {
        const url = `/v1/${this.deviceType}/${this.deviceType}-${this.cid}/energy/week`;
        const [response] = await Helpers.callApi(
            url,
            'get',
            null,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.energy.week = response.result;
        }
    }

    /**
     * Get monthly energy data
     */
    async getMonthlyEnergy(): Promise<void> {
        const url = `/v1/${this.deviceType}/${this.deviceType}-${this.cid}/energy/month`;
        const [response] = await Helpers.callApi(
            url,
            'get',
            null,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.energy.month = response.result;
        }
    }

    /**
     * Get yearly energy data
     */
    async getYearlyEnergy(): Promise<void> {
        const url = `/v1/${this.deviceType}/${this.deviceType}-${this.cid}/energy/year`;
        const [response] = await Helpers.callApi(
            url,
            'get',
            null,
            Helpers.reqHeaders(this.manager)
        );

        if (response?.code === 0) {
            this.energy.year = response.result;
        }
    }

    /**
     * Update outlet details and energy info
     */
    async update(): Promise<void> {
        await this.getDetails();
        await this.updateEnergy();
    }

    /**
     * Turn outlet on
     */
    abstract turnOn(): Promise<boolean>;

    /**
     * Turn outlet off
     */
    abstract turnOff(): Promise<boolean>;
} 