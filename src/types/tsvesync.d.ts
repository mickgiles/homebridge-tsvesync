declare module 'tsvesync/src/lib/helpers' {
  export function setApiBaseUrl(url: string): void;
}

declare module 'tsvesync' {
  export interface VeSyncDeviceWithPower {
    deviceName: string;
    deviceType: string;
    uuid: string;
    cid: string;
    deviceStatus: string;
    getDetails(): Promise<any>;
    setApiBaseUrl(url: string): void;
    turnOn(): Promise<boolean>;
    turnOff(): Promise<boolean>;
  }

  export class VeSyncBaseDevice {
    deviceName: string;
    deviceType: string;
    uuid: string;
    cid: string;
    deviceStatus: string;
    getDetails(): Promise<any>;
    setApiBaseUrl(url: string): void;
    turnOn(): Promise<boolean>;
    turnOff(): Promise<boolean>;
  }

  export class VeSync {
    constructor(
      username: string,
      password: string,
      timeZone: string,
      debug?: boolean,
      redact?: boolean,
      apiUrl?: string,
      customLogger?: Logger
    );

    fans: VeSyncDeviceWithPower[];
    outlets: VeSyncDeviceWithPower[];
    switches: VeSyncDeviceWithPower[];
    bulbs: VeSyncDeviceWithPower[];
    humidifiers: VeSyncDeviceWithPower[];
    purifiers: VeSyncDeviceWithPower[];

    login(): Promise<boolean>;
    getDevices(): Promise<boolean>;
  }
} 