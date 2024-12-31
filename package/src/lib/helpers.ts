/**
 * Helper functions for VeSync API
 */

import axios from 'axios';
import crypto from 'crypto';
import { VeSync } from './vesync';

// API configuration
let _apiBaseUrl = 'https://smartapi.vesync.com';

export function getApiBaseUrl(): string {
    return _apiBaseUrl;
}

export function setApiBaseUrl(url: string): void {
    _apiBaseUrl = url;
}

export const API_RATE_LIMIT = 30;
export const API_TIMEOUT = 5000;

export const APP_VERSION = '2.8.6';
export const PHONE_BRAND = 'SM N9005';
export const PHONE_OS = 'Android';
export const USER_TYPE = '1';
export const DEFAULT_TZ = 'America/New_York';
export const DEFAULT_REGION = 'US';
export const MOBILE_ID = '1234567890123456';
export const BYPASS_HEADER_UA = 'okhttp/3.12.1';

export interface RequestBody {
    acceptLanguage?: string;
    accountID?: string;
    appVersion?: string;
    cid?: string;
    configModule?: string;
    debugMode?: boolean;
    deviceRegion?: string;
    email?: string;
    method?: string;
    password?: string;
    phoneBrand?: string;
    phoneOS?: string;
    timeZone?: string;
    token?: string;
    traceId?: string;
    userType?: string;
    uuid?: string;
    status?: string;
    [key: string]: any;
}

export class Helpers {
    static shouldRedact = true;

    /**
     * Calculate MD5 hash
     */
    static md5(text: string): string {
        return crypto.createHash('md5').update(text).digest('hex');
    }

    /**
     * Build header for legacy api GET requests
     */
    static reqHeaders(manager: VeSync): Record<string, string> {
        if (!manager.accountId || !manager.token) {
            throw new Error('Manager accountId and token must be set');
        }
        return {
            'accept-language': 'en',
            'accountId': manager.accountId,
            'appVersion': APP_VERSION,
            'content-type': 'application/json',
            'tk': manager.token,
            'tz': manager.timeZone
        };
    }

    /**
     * Build header for api requests on 'bypass' endpoint
     */
    static reqHeaderBypass(): Record<string, string> {
        return {
            'Content-Type': 'application/json; charset=UTF-8',
            'User-Agent': BYPASS_HEADER_UA
        };
    }

    /**
     * Return universal keys for body of api requests
     */
    static reqBodyBase(manager: VeSync): Record<string, string> {
        return {
            'timeZone': manager.timeZone,
            'acceptLanguage': 'en'
        };
    }

    /**
     * Keys for authenticating api requests
     */
    static reqBodyAuth(manager: VeSync): Record<string, any> {
        if (!manager.accountId || !manager.token) {
            throw new Error('Manager accountId and token must be set');
        }
        return {
            'accountID': manager.accountId,
            'token': manager.token
        };
    }

    /**
     * Detail keys for api requests
     */
    static reqBodyDetails(): Record<string, string> {
        return {
            'appVersion': APP_VERSION,
            'phoneBrand': PHONE_BRAND,
            'phoneOS': PHONE_OS,
            'traceId': Date.now().toString()
        };
    }

    /**
     * Builder for body of api requests
     */
    static reqBody(manager: VeSync, type: string): Record<string, any> {
        const body = {
            ...this.reqBodyBase(manager)
        };

        if (type === 'login') {
            return {
                ...body,
                ...this.reqBodyDetails(),
                email: manager.username,
                password: this.hashPassword(manager.password),
                devToken: '',
                userType: USER_TYPE,
                method: 'login'
            };
        }

        const authBody = {
            ...body,
            ...this.reqBodyAuth(manager)
        };

        if (type === 'devicestatus') {
            return authBody;
        }

        const fullBody = {
            ...authBody,
            ...this.reqBodyDetails()
        };

        switch (type) {
            case 'devicelist':
                return {
                    ...fullBody,
                    method: 'devices',
                    pageNo: '1',
                    pageSize: '100'
                };
            case 'devicedetail':
                return {
                    ...fullBody,
                    method: 'devicedetail',
                    mobileId: MOBILE_ID
                };
            case 'bypass':
                return {
                    ...fullBody,
                    method: 'bypass'
                };
            case 'bypassV2':
                return {
                    ...fullBody,
                    deviceRegion: DEFAULT_REGION,
                    method: 'bypassV2'
                };
            case 'bypass_config':
                return {
                    ...fullBody,
                    method: 'firmwareUpdateInfo'
                };
            default:
                return fullBody;
        }
    }

    /**
     * Call VeSync API
     */
    static async callApi(
        endpoint: string,
        method: string,
        data: any = null,
        headers: Record<string, string> = {}
    ): Promise<[any, number]> {
        try {
            const url = _apiBaseUrl + endpoint;
            const response = await axios({
                method,
                url,
                data,
                headers,
                timeout: API_TIMEOUT
            });

            return [response.data, response.status];
        } catch (error: any) {
            if (error.response) {
                return [error.response.data, error.response.status];
            }
            console.error('API call failed:', error.message);
            return [null, 0];
        }
    }

    /**
     * Calculate hex value from energy response
     */
    static calculateHex(hexStr: string): string {
        if (!hexStr || !hexStr.includes(':')) {
            return '0';
        }

        const [prefix, value] = hexStr.split(':');
        if (!prefix || !value) {
            return '0';
        }

        try {
            const decoded = Buffer.from(value, 'hex');
            return decoded.readFloatBE(0).toString();
        } catch (error) {
            console.debug('Error decoding hex value:', error);
            return '0';
        }
    }

    /**
     * Build energy dictionary from API response
     */
    static buildEnergyDict(result: any): Record<string, any> {
        if (!result) {
            return {};
        }

        return {
            energy_consumption_of_today: result.energyConsumptionOfToday || 0,
            cost_per_kwh: result.costPerKWH || 0,
            max_energy: result.maxEnergy || 0,
            total_energy: result.totalEnergy || 0,
            data: result.data || [],
            energy_consumption: result.energy || 0,
            start_time: result.startTime || '',
            end_time: result.endTime || ''
        };
    }

    /**
     * Build configuration dictionary from API response
     */
    static buildConfigDict(result: any): Record<string, any> {
        if (!result) {
            return {};
        }

        return {
            configModule: result.configModule || '',
            firmwareVersion: result.currentFirmVersion || '',
            deviceRegion: result.deviceRegion || '',
            debugMode: result.debugMode || false,
            deviceTimezone: result.deviceTimezone || DEFAULT_TZ,
            ...result
        };
    }

    /**
     * Calculate MD5 hash
     */
    static hashPassword(text: string): string {
        return crypto.createHash('md5').update(text).digest('hex');
    }
} 