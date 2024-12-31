/**
 * VeSync Fan Classes
 */

import { VeSyncBaseDevice } from './vesyncBaseDevice';
import { VeSync } from './vesync';
import { Helpers } from './helpers';

type DeviceConstructor = new (config: Record<string, any>, manager: VeSync) => VeSyncBaseDevice;

interface FanConfig {
    [key: string]: {
        module: 'VeSyncAirBypass' | 'VeSyncHumidifier' | 'VeSyncWarmHumidifier';
        features: string[];
    };
}

// Fan configuration
export const fanConfig: FanConfig = {
    // Core Series
    'Core200S': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'Core300S': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'Core400S': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'Core600S': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    
    // LAP Series
    'LAP-C201S-AUSR': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-C202S-WUSR': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-C301S-WJP': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-C302S-WUSB': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-C301S-WAAA': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-C401S-WJP': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-C401S-WUSR': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-C401S-WAAA': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-C601S-WUS': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-C601S-WUSR': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-C601S-WEU': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-V102S-AASR': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-V102S-WUS': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-V102S-WEU': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-V102S-AUSR': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-V102S-WJP': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-V201S-AASR': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-V201S-WJP': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-V201S-WEU': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-V201S-WUS': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-V201-AUSR': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-V201S-AUSR': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-V201S-AEUR': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-EL551S-AUS': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-EL551S-AEUR': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-EL551S-WEU': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    'LAP-EL551S-WUS': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'air_quality', 'timer']
    },
    
    // LTF Series
    'LTF-F422S-KEU': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'timer']
    },
    'LTF-F422S-WUSR': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'timer']
    },
    'LTF-F422_WJP': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'timer']
    },
    'LTF-F422S-WUS': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'timer']
    },
    
    // Classic Series
    'Classic300S': {
        module: 'VeSyncHumidifier',
        features: ['display', 'humidity', 'mist', 'timer', 'auto_mode']
    },
    'Classic200S': {
        module: 'VeSyncHumidifier',
        features: ['display', 'humidity', 'mist', 'timer', 'auto_mode']
    },
    
    // Dual Series
    'Dual200S': {
        module: 'VeSyncHumidifier',
        features: ['display', 'humidity', 'mist', 'timer', 'auto_mode']
    },
    
    // LUH Series
    'LUH-A601S-WUSB': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode']
    },
    'LUH-A601S-AUSW': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode']
    },
    'LUH-D301S-WUSR': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode']
    },
    'LUH-D301S-WJP': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode']
    },
    'LUH-D301S-WEU': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode']
    },
    'LUH-A602S-WUSR': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode']
    },
    'LUH-A602S-WUS': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode']
    },
    'LUH-A602S-WEUR': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode']
    },
    'LUH-A602S-WEU': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode']
    },
    'LUH-A602S-WJP': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode']
    },
    'LUH-A602S-WUSC': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode']
    },
    'LUH-O451S-WEU': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode']
    },
    'LUH-O451S-WUS': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode']
    },
    'LUH-O451S-WUSR': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode']
    },
    'LUH-O601S-WUS': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode']
    },
    'LUH-O601S-KUS': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode']
    },
    'LUH-M101S-WUS': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode']
    },
    
    // LEH Series
    'LEH-S601S-WUS': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode', 'drying']
    },
    'LEH-S601S-WUSR': {
        module: 'VeSyncWarmHumidifier',
        features: ['display', 'humidity', 'mist', 'warm', 'timer', 'auto_mode', 'drying']
    },
    
    // LV Series
    'LV-PUR131S': {
        module: 'VeSyncAirBypass',
        features: ['air_quality', 'display', 'child_lock', 'night_light', 'timer']
    },
    'LV-RH131S': {
        module: 'VeSyncAirBypass',
        features: ['display', 'child_lock', 'night_light', 'timer']
    }
}; 

/**
 * Base class for VeSync Fans
 */
export abstract class VeSyncFan extends VeSyncBaseDevice {
    protected details: Record<string, any> = {};
    protected mode_dict: Record<string, any> = {};
    protected speed_dict: Record<string, any> = {};
    protected features: string[] = [];

    constructor(details: Record<string, any>, manager: VeSync) {
        super(details, manager);
        this.details = details;
        this.features = fanConfig[this.deviceType]?.features || [];
    }

    /**
     * Check if feature is supported
     */
    hasFeature(feature: string): boolean {
        return this.features.includes(feature);
    }

    /**
     * Get current mode
     */
    get mode(): string {
        return this.details.mode ?? '';
    }

    /**
     * Get current speed
     */
    get speed(): number {
        return this.details.speed ?? 0;
    }

    /**
     * Get filter life percentage
     */
    get filterLife(): number {
        return this.details.filter_life ?? 0;
    }

    /**
     * Get screen status
     */
    get screenStatus(): string {
        return this.details.screen_status ?? '';
    }

    /**
     * Get child lock status
     */
    get childLock(): string {
        return this.details.child_lock ?? '';
    }

    /**
     * Get air quality (if supported)
     */
    get airQuality(): string {
        return this.details.air_quality ?? '';
    }

    /**
     * Get humidity level (if supported)
     */
    get humidity(): number {
        return this.details.humidity ?? 0;
    }

    /**
     * Get mist level (if supported)
     */
    get mistLevel(): number {
        return this.details.mist_level ?? 0;
    }

    /**
     * Get warm level (if supported)
     */
    get warmLevel(): number {
        return this.details.warm_level ?? 0;
    }

    /**
     * Get timer status
     */
    get timer(): number {
        return this.details.timer ?? 0;
    }

    /**
     * Return formatted device info to stdout
     */
    display(): void {
        super.display();
        const info = [
            ['Mode: ', this.mode],
            ['Speed: ', this.speed],
            ['Filter Life: ', this.filterLife, '%']
        ];

        if (this.hasFeature('display')) {
            info.push(['Screen Status: ', this.screenStatus]);
        }
        if (this.hasFeature('child_lock')) {
            info.push(['Child Lock: ', this.childLock]);
        }
        if (this.hasFeature('air_quality')) {
            info.push(['Air Quality: ', this.airQuality]);
        }
        if (this.hasFeature('humidity')) {
            info.push(['Humidity: ', this.humidity, '%']);
        }
        if (this.hasFeature('mist')) {
            info.push(['Mist Level: ', this.mistLevel]);
        }
        if (this.hasFeature('warm')) {
            info.push(['Warm Level: ', this.warmLevel]);
        }
        if (this.hasFeature('timer')) {
            info.push(['Timer: ', this.timer, 'hours']);
        }

        for (const [key, value, unit = ''] of info) {
            console.log(`${key.toString().padEnd(30, '.')} ${value}${unit}`);
        }
    }

    /**
     * Return JSON details for fan
     */
    displayJSON(): string {
        const baseInfo = JSON.parse(super.displayJSON());
        const details: Record<string, string> = {
            'Mode': this.mode,
            'Speed': this.speed.toString(),
            'Filter Life': this.filterLife.toString()
        };

        if (this.hasFeature('display')) {
            details['Screen Status'] = this.screenStatus;
        }
        if (this.hasFeature('child_lock')) {
            details['Child Lock'] = this.childLock;
        }
        if (this.hasFeature('air_quality')) {
            details['Air Quality'] = this.airQuality;
        }
        if (this.hasFeature('humidity')) {
            details['Humidity'] = this.humidity.toString();
        }
        if (this.hasFeature('mist')) {
            details['Mist Level'] = this.mistLevel.toString();
        }
        if (this.hasFeature('warm')) {
            details['Warm Level'] = this.warmLevel.toString();
        }
        if (this.hasFeature('timer')) {
            details['Timer'] = this.timer.toString();
        }

        return JSON.stringify({
            ...baseInfo,
            ...details
        }, null, 4);
    }

    abstract getDetails(): Promise<void>;
    abstract turnOn(): Promise<boolean>;
    abstract turnOff(): Promise<boolean>;
    abstract changeFanSpeed(speed: number): Promise<boolean>;
    abstract setMode(mode: string): Promise<boolean>;
} 