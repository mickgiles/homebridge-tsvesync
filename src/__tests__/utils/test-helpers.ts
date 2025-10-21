import { Logger } from 'homebridge';
import { PluginLogger } from '../../utils/logger';
import { RetryManager } from '../../utils/retry';
import { VeSyncOutlet, VeSyncSwitch, VeSyncBulb, VeSyncFan, VeSyncDimmerSwitch } from '../../types/device.types';
import { VeSync } from 'tsvesync';

const TEST_DEVICE_MIN_KELVIN = 2700;
const TEST_DEVICE_MAX_KELVIN = 6500;

const percentToKelvin = (percent: number): number => TEST_DEVICE_MIN_KELVIN + ((TEST_DEVICE_MAX_KELVIN - TEST_DEVICE_MIN_KELVIN) * Math.max(0, Math.min(100, percent)) / 100);

/**
 * Creates a mock Logger instance for testing
 */
export const createMockLogger = (): jest.Mocked<Logger> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
  prefix: undefined
});

/**
 * Creates a mock PluginLogger instance for testing
 */
export const createMockPluginLogger = (log: Logger = createMockLogger()): jest.Mocked<PluginLogger> => {
  const logger = new PluginLogger(log, true);
  return {
    ...logger,
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    stateChange: jest.fn(),
    operationStart: jest.fn(),
    operationEnd: jest.fn(),
    pollingEvent: jest.fn(),
    formatMessage: jest.fn((message: string) => message),
  } as unknown as jest.Mocked<PluginLogger>;
};

/**
 * Creates a mock RetryManager instance for testing
 */
export const createMockRetryManager = (): jest.Mocked<RetryManager> => {
  const manager = new RetryManager(createMockLogger(), {
    maxRetries: 3,
  });
  return {
    ...manager,
    execute: jest.fn(),
    getRetryCount: jest.fn().mockReturnValue(0),
  } as unknown as jest.Mocked<RetryManager>;
};

/**
 * Creates a mock service instance for testing
 */
export const createMockService = () => ({
  getCharacteristic: jest.fn().mockReturnValue({
    onSet: jest.fn().mockReturnThis(),
    onGet: jest.fn().mockReturnThis(),
    updateValue: jest.fn().mockReturnThis(),
    setProps: jest.fn().mockReturnThis(),
  }),
  setCharacteristic: jest.fn().mockReturnThis(),
  testCharacteristic: jest.fn().mockReturnValue(false),
  removeCharacteristic: jest.fn().mockReturnThis(),
  addCharacteristic: jest.fn().mockReturnValue({
    onSet: jest.fn().mockReturnThis(),
    onGet: jest.fn().mockReturnThis(),
    updateValue: jest.fn().mockReturnThis(),
    setProps: jest.fn().mockReturnThis(),
  }),
});

/**
 * Creates a mock info service instance for testing
 */
export const createMockInfoService = () => ({
  setCharacteristic: jest.fn().mockReturnThis(),
});

/**
 * Type for mock device configuration
 */
export interface MockDeviceConfig {
  deviceName?: string;
  uuid?: string;
  deviceType?: string;
  getDetails?: jest.Mock;
}

/**
 * Creates a mock device instance for testing
 */
export const createMockDevice = (config: MockDeviceConfig = {}) => ({
  deviceName: config.deviceName || 'Test Device',
  uuid: config.uuid || '12345',
  deviceType: config.deviceType || 'outlet',
  getDetails: config.getDetails || jest.fn(),
});

/**
 * Waits for all promises in the queue to resolve
 */
export const flushPromises = () => new Promise(resolve => setImmediate(resolve));

/**
 * Helper to run async tests with proper timeout and error handling
 */
export const runAsyncTest = async (
  testFn: () => Promise<void>,
  timeout: number = 5000
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Test timed out after ${timeout}ms`));
    }, timeout);

    testFn()
      .then(() => {
        clearTimeout(timeoutId);
        resolve();
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
};

/**
 * Simulates a network delay
 */
export const simulateNetworkDelay = (ms: number = 100): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Type for mock outlet configuration
 */
export interface MockOutletConfig {
  deviceName?: string;
  deviceType?: string;
  cid?: string;
  uuid?: string;
  power?: number;
  voltage?: number;
  energy?: number;
  current?: number;
}

/**
 * Creates a mock outlet instance for testing
 */
export const createMockOutlet = (config: MockOutletConfig = {}): jest.Mocked<VeSyncOutlet> => {
  const details = {
    power: config.power || 0,
    voltage: config.voltage || 120,
    energy: config.energy || 0,
    current: config.current || 0,
  };

  return {
    deviceName: config.deviceName || 'Test Outlet',
    deviceType: config.deviceType || 'wifi-switch-1.3',
    cid: config.cid || 'test-cid',
    uuid: config.uuid || 'test-uuid',
    deviceStatus: 'on',
    subDeviceNo: 0,
    isSubDevice: false,
    deviceRegion: 'US',
    configModule: 'Outlet',
    macId: '00:11:22:33:44:55',
    deviceCategory: 'outlet',
    connectionStatus: 'online',
    getDetails: jest.fn().mockResolvedValue(details),
    setApiBaseUrl: jest.fn(),
    turnOn: jest.fn().mockResolvedValue(true),
    turnOff: jest.fn().mockResolvedValue(true),
    ...details,
  } as unknown as jest.Mocked<VeSyncOutlet>;
};

/**
 * Creates a mock VeSync client for testing
 */
export const createMockVeSync = (): jest.Mocked<VeSync> => {
  return {
    login: jest.fn().mockResolvedValue(true),
    getDevices: jest.fn().mockResolvedValue(true),
    fans: [],
    outlets: [],
    switches: [],
    bulbs: [],
    humidifiers: [],
    purifiers: [],
    _debug: false,
    _redact: false,
    _energyUpdateInterval: 0,
    _energyCheck: false,
    username: 'test@example.com',
    password: 'test-password',
    token: 'test-token',
    accountID: 'test-account',
    apiKey: 'test-key',
    apiBase: 'test-base',
    timezone: 'UTC',
    debug: false,
    redact: false,
    traceSocket: false,
    apiUrl: 'test-url',
    initialized: true,
    setToken: jest.fn(),
    setAccountID: jest.fn(),
    setAPIKey: jest.fn(),
    setAPIBase: jest.fn(),
    setInitialized: jest.fn(),
    setDevices: jest.fn(),
    getDevicesByType: jest.fn(),
    getDeviceByUUID: jest.fn(),
    getDeviceByCid: jest.fn(),
    getDeviceByName: jest.fn(),
    getDevicesByCategory: jest.fn(),
    getDevicesByMacID: jest.fn(),
    getDevicesByDeviceType: jest.fn(),
    getDevicesByConfigModule: jest.fn(),
    getDevicesByDeviceRegion: jest.fn(),
    getDevicesByConnectionStatus: jest.fn(),
  } as unknown as jest.Mocked<VeSync>;
};

/**
 * Type for mock switch configuration
 */
export interface MockSwitchConfig {
  deviceName?: string;
  deviceType?: string;
  cid?: string;
  uuid?: string;
  power?: boolean;
}

/**
 * Creates a mock switch instance for testing
 */
export const createMockSwitch = (config: MockSwitchConfig = {}): jest.Mocked<VeSyncSwitch> => {
  const state = {
    power: config.power || false,
    deviceStatus: config.power ? 'on' : 'off',
  };

  const mockSwitch = {
    deviceName: config.deviceName || 'Test Switch',
    deviceType: config.deviceType || 'ESW01-EU',
    cid: config.cid || 'test-cid',
    uuid: config.uuid || 'test-uuid',
    deviceStatus: state.deviceStatus,
    power: state.power,
    subDeviceNo: 0,
    isSubDevice: false,
    deviceRegion: 'US',
    configModule: 'Switch',
    macId: '00:11:22:33:44:55',
    deviceCategory: 'switch',
    connectionStatus: 'online',
    getDetails: jest.fn().mockImplementation(async () => {
      return {
        deviceStatus: state.deviceStatus,
        power: state.power,
      };
    }),
    setApiBaseUrl: jest.fn(),
    turnOn: jest.fn().mockImplementation(async () => {
      state.power = true;
      state.deviceStatus = 'on';
      mockSwitch.power = state.power;
      mockSwitch.deviceStatus = state.deviceStatus;
      return true;
    }),
    turnOff: jest.fn().mockImplementation(async () => {
      state.power = false;
      state.deviceStatus = 'off';
      mockSwitch.power = state.power;
      mockSwitch.deviceStatus = state.deviceStatus;
      return true;
    }),
  } as unknown as jest.Mocked<VeSyncSwitch>;

  return mockSwitch;
};

export interface MockLightOptions {
  deviceName: string;
  deviceType: string;
  cid: string;
  uuid: string;
  power?: boolean;
  brightness?: number;
  colorTemp?: number;
  hue?: number;
  saturation?: number;
  subDeviceNo?: number;
  isSubDevice?: boolean;
}

export function createMockLight(options: MockLightOptions): VeSyncBulb {
  const state = {
    deviceStatus: options.power ? 'on' : 'off',
    brightness: options.brightness || 100,
    colorTemp: options.colorTemp || 140,
    hue: options.hue || 0,
    saturation: options.saturation || 0,
  };

  const turnOn = jest.fn().mockImplementation(() => {
    state.deviceStatus = 'on';
    mockLight.deviceStatus = state.deviceStatus;
    return Promise.resolve(true);
  });

  const turnOff = jest.fn().mockImplementation(() => {
    state.deviceStatus = 'off';
    mockLight.deviceStatus = state.deviceStatus;
    return Promise.resolve(true);
  });

  const setBrightness = jest.fn().mockImplementation((brightness: number) => {
    state.brightness = brightness;
    mockLight.brightness = state.brightness;
    return Promise.resolve(true);
  });

  const setColorTemperature = jest.fn().mockImplementation((colorTemp: number) => {
    state.colorTemp = colorTemp;
    mockLight.colorTemp = state.colorTemp;
    return Promise.resolve(true);
  });

  const setColor = jest.fn().mockImplementation((hue: number, saturation: number) => {
    state.hue = hue;
    state.saturation = saturation;
    mockLight.hue = state.hue;
    mockLight.saturation = state.saturation;
    return Promise.resolve(true);
  });

  const getDetails = jest.fn().mockImplementation(() => {
    return Promise.resolve({
      deviceStatus: state.deviceStatus,
      brightness: state.brightness,
      colorTemp: state.colorTemp,
      hue: state.hue,
      saturation: state.saturation,
    });
  });

  const mockLight = {
    deviceName: options.deviceName,
    deviceType: options.deviceType,
    cid: options.cid,
    uuid: options.uuid,
    deviceStatus: state.deviceStatus,
    brightness: state.brightness,
    colorTemp: state.colorTemp,
    hue: state.hue,
    saturation: state.saturation,
    subDeviceNo: options.subDeviceNo || 0,
    isSubDevice: options.isSubDevice || false,
    deviceRegion: 'US',
    configModule: 'Light',
    macId: '00:11:22:33:44:55',
    deviceCategory: 'light',
    connectionStatus: 'online',
    setApiBaseUrl: jest.fn(),
    turnOn,
    turnOff,
    setBrightness,
    setColorTemperature,
    setColor,
    getDetails,
  } as VeSyncBulb;

  return mockLight;
}

/**
 * Type for mock fan configuration
 */
export interface MockFanConfig {
  deviceName?: string;
  deviceType?: string;
  cid?: string;
  uuid?: string;
  speed?: number;
  rotationDirection?: 'clockwise' | 'counterclockwise';
  oscillationState?: boolean;
  childLock?: boolean;
  mode?: 'normal' | 'auto' | 'sleep' | 'turbo';
}

/**
 * Creates a mock fan instance for testing
 */
export const createMockFan = (config: MockFanConfig = {}): jest.Mocked<VeSyncFan> => {
  const state = {
    deviceStatus: 'on',
    speed: config.speed || 3,
    rotationDirection: config.rotationDirection || 'clockwise',
    oscillationState: config.oscillationState || false,
    childLock: config.childLock || false,
    mode: config.mode || 'normal'
  };

  const mockFan = {
    deviceName: config.deviceName || 'Test Fan',
    deviceType: config.deviceType || 'LTF-F422',
    cid: config.cid || 'test-cid',
    uuid: config.uuid || 'test-uuid',
    deviceStatus: state.deviceStatus,
    speed: state.speed,
    maxSpeed: 5,
    rotationDirection: state.rotationDirection,
    oscillationState: state.oscillationState,
    childLock: state.childLock,
    mode: state.mode,
    subDeviceNo: 0,
    isSubDevice: false,
    deviceRegion: 'US',
    configModule: 'Fan',
    macId: '00:11:22:33:44:55',
    deviceCategory: 'fan',
    connectionStatus: 'online',
    getDetails: jest.fn().mockImplementation(async () => {
      return {
        deviceStatus: state.deviceStatus,
        speed: state.speed,
        rotationDirection: state.rotationDirection,
        oscillationState: state.oscillationState,
        childLock: state.childLock,
        mode: state.mode
      };
    }),
    setApiBaseUrl: jest.fn(),
    turnOn: jest.fn().mockImplementation(async () => {
      state.deviceStatus = 'on';
      mockFan.deviceStatus = state.deviceStatus;
      return true;
    }),
    turnOff: jest.fn().mockImplementation(async () => {
      state.deviceStatus = 'off';
      mockFan.deviceStatus = state.deviceStatus;
      return true;
    }),
    changeFanSpeed: jest.fn().mockImplementation(async (speed: number) => {
      state.speed = speed;
      mockFan.speed = state.speed;
      return true;
    }),
    setRotationDirection: jest.fn().mockImplementation(async (direction: 'clockwise' | 'counterclockwise') => {
      state.rotationDirection = direction;
      mockFan.rotationDirection = state.rotationDirection;
      return true;
    }),
    setOscillation: jest.fn().mockImplementation(async (enabled: boolean) => {
      state.oscillationState = enabled;
      mockFan.oscillationState = state.oscillationState;
      return true;
    }),
    setChildLock: jest.fn().mockImplementation(async (enabled: boolean) => {
      state.childLock = enabled;
      mockFan.childLock = state.childLock;
      return true;
    }),
    setMode: jest.fn().mockImplementation(async (mode: 'normal' | 'auto' | 'sleep' | 'turbo') => {
      state.mode = mode;
      mockFan.mode = state.mode;
      return true;
    }),
    setSwingMode: jest.fn().mockImplementation(async (enabled: boolean) => {
      state.oscillationState = enabled;
      mockFan.oscillationState = state.oscillationState;
      return true;
    })
  } as unknown as jest.Mocked<VeSyncFan>;

  return mockFan;
};

/**
 * Type for mock bulb configuration
 */
export interface MockBulbConfig {
  deviceName?: string;
  deviceType?: string;
  cid?: string;
  uuid?: string;
  brightness?: number;
  colorTemp?: number;
  hue?: number;
  saturation?: number;
}

/**
 * Creates a mock bulb instance for testing
 */
export const createMockBulb = (config: MockBulbConfig = {}): jest.Mocked<VeSyncBulb> => {
  const deviceType = config.deviceType || 'ESL100MC';
  const features = new Set<string>(['dimmable']);
  if (deviceType.includes('CW') || deviceType === 'XYD0001') {
    features.add('color_temp');
  }
  if (deviceType.includes('MC') || deviceType === 'XYD0001') {
    features.add('rgb_shift');
  }

  const colorModel = features.has('rgb_shift') ? (deviceType === 'XYD0001' ? 'hsv' : 'rgb') : 'none';

  const hsvToRgb = (h: number, s: number, v: number): { red: number; green: number; blue: number } => {
    let hue = h % 360;
    if (hue < 0) {
      hue += 360;
    }
    const saturation = Math.max(0, Math.min(100, s)) / 100;
    const value = Math.max(0, Math.min(100, v)) / 100;

    const c = value * saturation;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = value - c;

    let rPrime = 0;
    let gPrime = 0;
    let bPrime = 0;

    if (hue < 60) {
      rPrime = c;
      gPrime = x;
    } else if (hue < 120) {
      rPrime = x;
      gPrime = c;
    } else if (hue < 180) {
      gPrime = c;
      bPrime = x;
    } else if (hue < 240) {
      gPrime = x;
      bPrime = c;
    } else if (hue < 300) {
      rPrime = x;
      bPrime = c;
    } else {
      rPrime = c;
      bPrime = x;
    }

    return {
      red: Math.round((rPrime + m) * 255),
      green: Math.round((gPrime + m) * 255),
      blue: Math.round((bPrime + m) * 255)
    };
  };

  const state = {
    brightness: config.brightness ?? 100,
    colorTempPercent: config.colorTemp ?? 50,
    hue: config.hue ?? 0,
    saturation: config.saturation ?? 0,
    deviceStatus: 'off' as 'on' | 'off',
    value: 100,
    rgb: { red: 0, green: 0, blue: 0 }
  };

  if (colorModel === 'rgb') {
    state.rgb = hsvToRgb(state.hue, state.saturation, state.value);
  }

  const mockBulb: any = {
    deviceName: config.deviceName || 'Test Bulb',
    deviceType,
    cid: config.cid || 'test-cid',
    uuid: config.uuid || 'test-uuid',
    deviceStatus: state.deviceStatus,
    brightness: state.brightness,
    colorTemp: state.colorTempPercent,
    hue: state.hue,
    saturation: state.saturation,
    subDeviceNo: 0,
    isSubDevice: false,
    deviceRegion: 'US',
    configModule: 'Bulb',
    macId: '00:11:22:33:44:55',
    deviceCategory: 'bulb',
    connectionStatus: 'online',
    getDetails: jest.fn().mockResolvedValue(true),
    setApiBaseUrl: jest.fn(),
    turnOn: jest.fn().mockImplementation(async () => {
      state.deviceStatus = 'on';
      mockBulb.deviceStatus = 'on';
      return true;
    }),
    turnOff: jest.fn().mockImplementation(async () => {
      state.deviceStatus = 'off';
      mockBulb.deviceStatus = 'off';
      return true;
    }),
    setBrightness: jest.fn().mockImplementation(async (value: number) => {
      state.brightness = value;
      mockBulb.brightness = value;
      if (value > 0) {
        state.deviceStatus = 'on';
        mockBulb.deviceStatus = 'on';
      }
      return true;
    }),
    setColorTemperature: jest.fn().mockImplementation(async (percent: number) => {
      state.colorTempPercent = percent;
      mockBulb.colorTemp = percent;
      return true;
    }),
    setColor: jest.fn().mockImplementation(async (hue: number, saturation: number, value: number = 100) => {
      state.hue = hue;
      state.saturation = saturation;
      state.value = value;
      mockBulb.hue = hue;
      mockBulb.saturation = saturation;
      if (colorModel === 'rgb') {
        state.rgb = hsvToRgb(hue, saturation, value);
      }
      return true;
    }),
    hasFeature: jest.fn().mockImplementation((feature: string) => features.has(feature)),
    getColorModel: jest.fn().mockImplementation(() => colorModel),
    getBrightness: jest.fn().mockImplementation(() => state.brightness),
    getColorTempPercent: jest.fn().mockImplementation(() => state.colorTempPercent),
    getColorTempKelvin: jest.fn().mockImplementation(() => percentToKelvin(state.colorTempPercent)),
    getColorHue: jest.fn().mockImplementation(() => state.hue),
    getColorSaturation: jest.fn().mockImplementation(() => state.saturation),
    getColorValue: jest.fn().mockImplementation(() => state.value),
    getRGBValues: jest.fn().mockImplementation(() => state.rgb),
  };

  return mockBulb as jest.Mocked<VeSyncBulb>;
};

export interface MockDimmerConfig {
  deviceName?: string;
  deviceType?: string;
  cid?: string;
  uuid?: string;
  brightness?: number;
  deviceStatus?: 'on' | 'off';
  rgbLightStatus?: 'on' | 'off';
  indicatorLightStatus?: 'on' | 'off';
  failBrightnessOnZero?: boolean;
}

export const createMockDimmer = (config: MockDimmerConfig = {}): jest.Mocked<VeSyncDimmerSwitch> => {
  const state = {
    brightness: config.brightness ?? 50,
    deviceStatus: config.deviceStatus ?? 'off',
    rgbLightStatus: config.rgbLightStatus ?? 'off',
    indicatorLightStatus: config.indicatorLightStatus ?? 'off',
    rgbLightValue: { red: 0, green: 0, blue: 0 },
  };

  const dimmer: Partial<VeSyncDimmerSwitch> = {
    deviceName: config.deviceName || 'Test Dimmer',
    deviceType: config.deviceType || 'ESWD16',
    cid: config.cid || 'test-dimmer-cid',
    uuid: config.uuid || 'test-dimmer-uuid',
    deviceStatus: state.deviceStatus,
    brightness: state.brightness,
    rgbLightStatus: state.rgbLightStatus,
    indicatorLightStatus: state.indicatorLightStatus,
    rgbLightValue: state.rgbLightValue,
    getDetails: jest.fn().mockResolvedValue(true),
    turnOn: jest.fn().mockImplementation(async () => {
      state.deviceStatus = 'on';
      dimmer.deviceStatus = 'on';
      return true;
    }),
    turnOff: jest.fn().mockImplementation(async () => {
      state.deviceStatus = 'off';
      dimmer.deviceStatus = 'off';
      state.brightness = 0;
      dimmer.brightness = 0;
      return true;
    }),
    setBrightness: jest.fn().mockImplementation(async (value: number) => {
      if (config.failBrightnessOnZero && value === 0) {
        return false;
      }
      state.brightness = value;
      dimmer.brightness = value;
      if (value > 0) {
        state.deviceStatus = 'on';
        dimmer.deviceStatus = 'on';
      } else {
        state.deviceStatus = 'off';
        dimmer.deviceStatus = 'off';
      }
      return true;
    }),
    rgbColorSet: jest.fn().mockImplementation(async (red: number, green: number, blue: number) => {
      state.rgbLightValue = { red, green, blue };
      dimmer.rgbLightValue = state.rgbLightValue;
      state.rgbLightStatus = 'on';
      dimmer.rgbLightStatus = 'on';
      return true;
    }),
    rgbColorOn: jest.fn().mockImplementation(async () => {
      state.rgbLightStatus = 'on';
      dimmer.rgbLightStatus = 'on';
      return true;
    }),
    rgbColorOff: jest.fn().mockImplementation(async () => {
      state.rgbLightStatus = 'off';
      dimmer.rgbLightStatus = 'off';
      return true;
    }),
    indicatorLightOn: jest.fn().mockImplementation(async () => {
      state.indicatorLightStatus = 'on';
      dimmer.indicatorLightStatus = 'on';
      return true;
    }),
    indicatorLightOff: jest.fn().mockImplementation(async () => {
      state.indicatorLightStatus = 'off';
      dimmer.indicatorLightStatus = 'off';
      return true;
    }),
  };

  return dimmer as jest.Mocked<VeSyncDimmerSwitch>;
};

/**
 * Type for mock air purifier configuration
 */
export interface MockAirPurifierConfig {
  deviceName?: string;
  deviceType?: string;
  cid?: string;
  uuid?: string;
  airQualityValue?: number;
  pm1?: number;
  pm10?: number;
  aqPercent?: number;
  filterLife?: number | { percent: number };
  hasAirQuality?: boolean;
  hasFilter?: boolean;
}

/**
 * Creates a mock air purifier with air quality and filter features
 */
export const createMockAirPurifier = (config: MockAirPurifierConfig = {}): jest.Mocked<VeSyncFan> => {
  const state = {
    deviceStatus: 'on',
    speed: 3,
    mode: 'auto' as 'normal' | 'auto' | 'sleep' | 'turbo',
    airQualityValue: config.airQualityValue || 25,
    pm1: config.pm1 || 15,
    pm10: config.pm10 || 35,
    aqPercent: config.aqPercent || 80,
    filterLife: typeof config.filterLife === 'object' ? config.filterLife.percent : (config.filterLife || 75),
  };

  const mockAirPurifier = {
    deviceName: config.deviceName || 'Test Air Purifier',
    deviceType: config.deviceType || 'Core300S',
    cid: config.cid || 'test-cid',
    uuid: config.uuid || 'test-uuid',
    deviceStatus: state.deviceStatus,
    speed: state.speed,
    mode: state.mode,
    maxSpeed: 4,
    rotationDirection: 'clockwise' as 'clockwise' | 'counterclockwise',
    oscillationState: false,
    childLock: false,
    airQualityValue: state.airQualityValue,
    pm1: state.pm1,
    pm10: state.pm10,
    aqPercent: state.aqPercent,
    filterLife: state.filterLife,
    subDeviceNo: 0,
    isSubDevice: false,
    deviceRegion: 'US',
    configModule: 'VeSyncAirBypass',
    macId: '00:11:22:33:44:55',
    deviceCategory: 'fan',
    connectionStatus: 'online',
    hasFeature: jest.fn().mockImplementation((feature: string) => {
      if (feature === 'air_quality') return config.hasAirQuality !== false;
      if (feature === 'filter_life') return config.hasFilter !== false;
      return true;
    }),
    getDetails: jest.fn().mockImplementation(async () => {
      return {
        deviceStatus: state.deviceStatus,
        speed: state.speed,
        mode: state.mode,
        air_quality_value: state.airQualityValue,
        pm1: state.pm1,
        pm10: state.pm10,
        aq_percent: state.aqPercent,
        filter_life: config.filterLife || state.filterLife
      };
    }),
    setApiBaseUrl: jest.fn(),
    turnOn: jest.fn().mockImplementation(async () => {
      state.deviceStatus = 'on';
      mockAirPurifier.deviceStatus = state.deviceStatus;
      return true;
    }),
    turnOff: jest.fn().mockImplementation(async () => {
      state.deviceStatus = 'off';
      mockAirPurifier.deviceStatus = state.deviceStatus;
      return true;
    }),
    changeFanSpeed: jest.fn().mockImplementation(async (speed: number) => {
      state.speed = speed;
      mockAirPurifier.speed = state.speed;
      return true;
    }),
    changeMode: jest.fn().mockImplementation(async (mode: 'normal' | 'auto' | 'sleep' | 'turbo') => {
      state.mode = mode;
      mockAirPurifier.mode = state.mode;
      return true;
    }),
    setMode: jest.fn().mockImplementation(async (mode: 'normal' | 'auto' | 'sleep' | 'turbo') => {
      state.mode = mode;
      mockAirPurifier.mode = state.mode;
      return true;
    }),
    setRotationDirection: jest.fn().mockImplementation(async (direction: 'clockwise' | 'counterclockwise') => {
      mockAirPurifier.rotationDirection = direction;
      return true;
    }),
    setOscillation: jest.fn().mockImplementation(async (enabled: boolean) => {
      mockAirPurifier.oscillationState = enabled;
      return true;
    }),
    setChildLock: jest.fn().mockImplementation(async (enabled: boolean) => {
      mockAirPurifier.childLock = enabled;
      return true;
    }),
    setSwingMode: jest.fn().mockImplementation(async (enabled: boolean) => {
      mockAirPurifier.oscillationState = enabled;
      return true;
    })
  } as unknown as jest.Mocked<VeSyncFan>;

  return mockAirPurifier;
};

/**
 * Air quality test scenarios for different conditions
 */
export const airQualityScenarios = {
  excellent: {
    pm25: 8,
    pm1: 5,
    pm10: 12,
    level: 1,
    description: 'Excellent air quality'
  },
  good: {
    pm25: 22,
    pm1: 15,
    pm10: 28,
    level: 2,
    description: 'Good air quality'
  },
  fair: {
    pm25: 42,
    pm1: 30,
    pm10: 55,
    level: 3,
    description: 'Fair air quality'
  },
  poor: {
    pm25: 85,
    pm1: 60,
    pm10: 120,
    level: 4,
    description: 'Poor air quality'
  },
  veryPoor: {
    pm25: 200,
    pm1: 150,
    pm10: 300,
    level: 5,
    description: 'Very poor air quality'
  }
};

/**
 * Filter life test scenarios
 */
export const filterLifeScenarios = {
  new: {
    percent: 100,
    needsReplacement: false,
    description: 'New filter'
  },
  good: {
    percent: 75,
    needsReplacement: false,
    description: 'Good filter condition'
  },
  fair: {
    percent: 50,
    needsReplacement: false,
    description: 'Fair filter condition'
  },
  low: {
    percent: 15,
    needsReplacement: false,
    description: 'Low filter life'
  },
  critical: {
    percent: 8,
    needsReplacement: true,
    description: 'Critical filter life'
  },
  empty: {
    percent: 0,
    needsReplacement: true,
    description: 'Filter needs replacement'
  }
};

/**
 * Creates air quality test data for device mocking
 */
export const createAirQualityTestData = (scenario: keyof typeof airQualityScenarios) => {
  const data = airQualityScenarios[scenario];
  return {
    air_quality: data.level,
    air_quality_value: data.pm25,
    pm1: data.pm1,
    pm10: data.pm10,
    aq_percent: Math.max(0, 100 - data.pm25), // Rough approximation
  };
};

/**
 * Creates filter life test data for device mocking
 */
export const createFilterLifeTestData = (scenario: keyof typeof filterLifeScenarios, format: 'number' | 'object' = 'number') => {
  const data = filterLifeScenarios[scenario];
  
  if (format === 'object') {
    return {
      filter_life: {
        percent: data.percent,
        replace_indicator: data.needsReplacement
      }
    };
  }
  
  return {
    filter_life: data.percent
  };
}; 
