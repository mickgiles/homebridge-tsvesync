declare module 'tsvesync/src/lib/helpers' {
  export function setApiBaseUrl(url: string): void;
}

declare module 'tsvesync' {
  export interface VeSyncDeviceWithPower {
    deviceName: string;
    deviceType: string;
    uuid: string;
    cid: string;
    subDeviceNo: number;
    isSubDevice: boolean;
    deviceStatus: string;
    setApiBaseUrl(url: string): void;
    turnOn(): Promise<boolean>;
    turnOff(): Promise<boolean>;
  }

  export class VeSyncBaseDevice {
    deviceName: string;
    deviceType: string;
    uuid: string;
    cid: string;
    subDeviceNo: number;
    deviceStatus: string;
    isSubDevice: boolean;
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
      customLogger?: Logger,
      exclusions?: {
        type?: string[];
        model?: string[];
        name?: string[];
        namePattern?: string[];
        id?: string[];
      }
    );

    fans: VeSyncDeviceWithPower[];
    outlets: VeSyncDeviceWithPower[];
    switches: VeSyncDeviceWithPower[];
    bulbs: VeSyncDeviceWithPower[];
    humidifiers: VeSyncDeviceWithPower[];
    purifiers: VeSyncDeviceWithPower[];

    login(): Promise<boolean>;
    update(): Promise<void>;
  }
} 