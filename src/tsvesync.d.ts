declare module 'tsvesync' {
  export interface Device {
    id: string;
    name: string;
    model?: string;
    supportsBrightness?: boolean;
    deviceType?: string;
    deviceStatus?: string;
  }

  export interface TSVESyncConfig {
    username: string;
    password: string;
  }

  export class TSVESync {
    constructor(config: TSVESyncConfig);
    
    login(): Promise<void>;
    getDevices(): Promise<Device[]>;
    setPowerState(deviceId: string, state: boolean): Promise<void>;
    getPowerState(deviceId: string): Promise<boolean>;
    setBrightness(deviceId: string, brightness: number): Promise<void>;
    getBrightness(deviceId: string): Promise<number>;
  }
} 