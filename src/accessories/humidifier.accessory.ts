import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { BaseAccessory } from './base.accessory';
import { TSVESyncPlatform } from '../platform';
import { DeviceCapabilities, VeSyncHumidifier } from '../types/device.types';

// Extended interface to include optional methods for humidifiers
interface ExtendedVeSyncHumidifier extends VeSyncHumidifier {
  // Common methods
  setMode?(mode: 'manual' | 'auto' | 'sleep'): Promise<boolean>;
  getDetails?(): Promise<boolean>;
  
  // Night light properties and methods
  nightLightBrightness?: number;
  nightLightStatus?: string;
  setNightLightBrightness?(brightness: number): Promise<boolean>;
  setNightLight?(enabled: boolean, brightness?: number): Promise<boolean>;
  
  // Common methods across humidifier types
  setMistLevel?(level: number): Promise<boolean>;
  setHumidity?(humidity: number): Promise<boolean>;
  setAutoMode?(): Promise<boolean>;
  setManualMode?(): Promise<boolean>;
  setSleepMode?(): Promise<boolean>;
  setDisplay?(on: boolean): Promise<boolean>;
  turnOnDisplay?(): Promise<boolean>;
  turnOffDisplay?(): Promise<boolean>;
  setIndicatorLightSwitch?(on: boolean): Promise<boolean>;
  
  // Automatic stop methods
  automaticStopOn?(): Promise<boolean>;
  automaticStopOff?(): Promise<boolean>;
  setAutomaticStop?(enabled: boolean): Promise<boolean>;
  
  // Superior6000S specific methods
  setDryingModeEnabled?(enabled: boolean): Promise<boolean>;
  
  // Common properties
  mistLevel?: number;
  // Note: humidity must be non-optional to match VeSyncHumidifier interface
  humidity: number;
  currentHumidity?: number; // Actual humidity reading in the room
  mode?: string;
  screenStatus?: 'on' | 'off';
  enabled?: boolean; // Used by Humid200S for power control
  powerSwitch?: boolean; // Used by Humid1000S and Superior6000S for power control
  
  // Superior6000S specific properties
  temperature?: number;
  filterLifePercentage?: number;
  dryingModeEnabled?: boolean;
  dryingModeState?: string | null;
  dryingModeLevel?: string | null;
  dryingModeSecondsRemaining?: number;
  
  // For device-specific details
  details?: {
    target_humidity?: number;
    night_light_brightness?: number;
    current_humidity?: number;
    water_lacks?: boolean;
    water_tank_lifted?: boolean;
    humidity_high?: boolean;
    automatic_stop?: boolean;
    automatic_stop_configured?: boolean;
    temperature?: number;
    filter_life?: number;
  };
  
  // Device configuration object
  configuration?: {
    auto_target_humidity?: number;
    automatic_stop?: boolean;
    display?: string;
    // Other configuration properties
  };
  
  // Feature support check
  hasFeature?(feature: string): boolean;
}

export class HumidifierAccessory extends BaseAccessory {
  protected readonly device: VeSyncHumidifier;
  private capabilities: DeviceCapabilities; // Removed readonly to allow re-initialization
  
  // Device type flags
  private isHumid200S: boolean;
  private isHumid200300S: boolean;
  private isHumid1000S: boolean;
  private isSuperior6000S: boolean;
  
  // Services
  private lightService?: Service;
  private temperatureService?: Service;
  private filterService?: Service;

  constructor(
    platform: TSVESyncPlatform,
    accessory: PlatformAccessory,
    device: VeSyncHumidifier
  ) {
    super(platform, accessory, device);
    this.device = device;
    
    // Initialize capabilities with default values to prevent undefined
    this.capabilities = {
      hasBrightness: false,
      hasColorTemp: false,
      hasColor: false,
      hasSpeed: true,
      hasHumidity: true,
      hasAirQuality: false,
      hasWaterLevel: true,
      hasChildLock: true,
      hasSwingMode: false,
    };
    
    // Detect device type
    this.isHumid200S = this.detectHumid200S();
    this.isHumid200300S = this.detectHumid200300S();
    this.isHumid1000S = this.detectHumid1000S();
    this.isSuperior6000S = this.detectSuperior6000S();
    
    // Log detected device type
    if (this.isHumid200S) {
      this.platform.log.debug(`Detected Humid200S device: ${this.device.deviceName}`);
    } else if (this.isHumid200300S) {
      this.platform.log.debug(`Detected Humid200300S device: ${this.device.deviceName}`);
    } else if (this.isHumid1000S) {
      this.platform.log.debug(`Detected Humid1000S device: ${this.device.deviceName}`);
    } else if (this.isSuperior6000S) {
      this.platform.log.debug(`Detected Superior6000S device: ${this.device.deviceName}`);
    } else {
      this.platform.log.debug(`Unknown humidifier type: ${this.device.deviceName}, using default implementation`);
    }
  }
  
  /**
   * Detect if the device is a Humid200S
   */
  private detectHumid200S(): boolean {
    const deviceType = this.device.deviceType.toUpperCase();
    
    // Classic200S is a Humid200S device
    if (deviceType.includes('CLASSIC200S')) {
      return true;
    }
    
    // Check for mist level range 1-3 which is specific to Humid200S
    const extendedDevice = this.device as ExtendedVeSyncHumidifier;
    if (extendedDevice.mistLevel !== undefined && extendedDevice.mistLevel <= 3) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Detect if the device is a Humid200300S
   */
  private detectHumid200300S(): boolean {
    // Check if the device has the nightLightBrightness property
    const extendedDevice = this.device as ExtendedVeSyncHumidifier;
    if (typeof extendedDevice.nightLightBrightness !== 'undefined' || 
        (extendedDevice.details && typeof extendedDevice.details.night_light_brightness !== 'undefined')) {
      return true;
    }
    
    // Check device type for Classic300S or Dual200S
    const deviceType = this.device.deviceType.toUpperCase();
    if (deviceType.includes('CLASSIC300S') || deviceType.includes('DUAL200S')) {
      return true;
    }
    
    // Check for LUH-A601S, LUH-A602S, LUH-O451S, LUH-O601S series
    if (deviceType.includes('LUH-A601S') || 
        deviceType.includes('LUH-A602S') || 
        deviceType.includes('LUH-O451S') || 
        deviceType.includes('LUH-O601S')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Detect if the device is a Humid1000S
   */
  private detectHumid1000S(): boolean {
    const deviceType = this.device.deviceType.toUpperCase();
    
    // Check for LUH-M101S series
    if (deviceType.includes('LUH-M101S-WUS') || deviceType.includes('LUH-M101S-WEUR')) {
      return true;
    }
    
    // Check for OasisMist1000S
    if (deviceType.includes('OASISMIST1000S')) {
      return true;
    }
    
    // Check for powerSwitch field and night light control
    const extendedDevice = this.device as ExtendedVeSyncHumidifier;
    if (extendedDevice.powerSwitch !== undefined && 
        typeof extendedDevice.setNightLight === 'function') {
      return true;
    }
    
    return false;
  }
  
  /**
   * Detect if the device is a Superior6000S
   */
  private detectSuperior6000S(): boolean {
    const deviceType = this.device.deviceType.toUpperCase();
    
    // Check for LEH-S601S series
    if (deviceType.includes('LEH-S601S-WUS') || deviceType.includes('LEH-S601S-WUSR')) {
      return true;
    }
    
    // Check for Superior6000S
    if (deviceType.includes('SUPERIOR6000S')) {
      return true;
    }
    
    // Check for temperature or drying mode properties
    const extendedDevice = this.device as ExtendedVeSyncHumidifier;
    if (extendedDevice.temperature !== undefined || 
        extendedDevice.dryingModeEnabled !== undefined ||
        extendedDevice.filterLifePercentage !== undefined) {
      return true;
    }
    
    return false;
  }

  protected setupService(): void {
    // No need to check for capabilities initialization since we set defaults in constructor

    // Get or create the humidifier service
    this.service = this.accessory.getService(this.platform.Service.HumidifierDehumidifier) ||
      this.accessory.addService(this.platform.Service.HumidifierDehumidifier);
      
    // Initialize all characteristics with explicit values
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, 40);
    this.service.updateCharacteristic(this.platform.Characteristic.RelativeHumidityHumidifierThreshold, 60);
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentHumidifierDehumidifierState, 1);
    this.service.updateCharacteristic(this.platform.Characteristic.TargetHumidifierDehumidifierState, 1);
    this.platform.log.debug('Initialized humidifier characteristics with explicit values');

    // Set up required characteristics
    this.setupCharacteristic(
      this.platform.Characteristic.Active,
      this.getActive.bind(this),
      this.setActive.bind(this)
    );

    // Set up target state characteristic for mode mapping
    // Determine which modes this device supports
    const extendedDevice = this.device as ExtendedVeSyncHumidifier;
    const supportsAutoMode = typeof extendedDevice.setAutoMode === 'function' || 
                            (typeof extendedDevice.setMode === 'function' && extendedDevice.mode === 'auto');
    
    // Get the characteristic and set valid values based on device capabilities
    const targetStateChar = this.service.getCharacteristic(this.platform.Characteristic.TargetHumidifierDehumidifierState);
    
    // Only allow HUMIDIFIER (1) mode if auto is not supported
    // If auto is supported, allow both HUMIDIFIER_OR_DEHUMIDIFIER (0) and HUMIDIFIER (1)
    // Never allow DEHUMIDIFIER (2) as it's not supported by any VeSync devices
    targetStateChar.setProps({
      validValues: supportsAutoMode ? [0, 1] : [1]
    });
    
    this.setupCharacteristic(
      this.platform.Characteristic.TargetHumidifierDehumidifierState,
      async () => extendedDevice.mode === 'auto' ? 0 : 1,
      this.setTargetState.bind(this)
    );

    // Set up rotation speed characteristic
    this.setupCharacteristic(
      this.platform.Characteristic.RotationSpeed,
      this.getRotationSpeed.bind(this),
      this.handleSetRotationSpeed.bind(this)
    );

    // Add Name characteristic
    this.setupCharacteristic(
      this.platform.Characteristic.Name,
      async () => this.device.deviceName
    );

    // Add Current Relative Humidity if supported
    if (this.capabilities && this.capabilities.hasHumidity) {
      if (!this.service.testCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)) {
        this.service.addCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity);
      }
      
      // Add Target Relative Humidity characteristic
      if (!this.service.testCharacteristic(this.platform.Characteristic.RelativeHumidityHumidifierThreshold)) {
        this.service.addCharacteristic(this.platform.Characteristic.RelativeHumidityHumidifierThreshold);
      }
      
      // Configure the target humidity characteristic with proper properties
      const targetHumidityChar = this.service.getCharacteristic(this.platform.Characteristic.RelativeHumidityHumidifierThreshold);
      targetHumidityChar.setProps({
        minValue: 30,
        maxValue: 80,
        minStep: 1
      });
      
      // Set an initial value to ensure the characteristic is not blank
      targetHumidityChar.updateValue(45);
      this.platform.log.debug(`Configured RelativeHumidityHumidifierThreshold characteristic with initial value 45%`);
      
      // Set up handlers for target humidity
      this.setupCharacteristic(
        this.platform.Characteristic.RelativeHumidityHumidifierThreshold,
        this.getTargetHumidity.bind(this),
        this.setTargetHumidity.bind(this)
      );
      
      // Immediately get and set the actual target humidity to ensure it's displayed correctly
      this.getTargetHumidity().then(targetHumidity => {
        this.platform.log.debug(`Initial target humidity value: ${targetHumidity}%`);
        targetHumidityChar.updateValue(targetHumidity);
      }).catch(error => {
        this.platform.log.warn(`Failed to get initial target humidity: ${error}`);
      });
    }

    // Add Water Level characteristic if supported (mapping inferred from water_lacks/water_tank_lifted)
    if (this.capabilities && this.capabilities.hasWaterLevel) {
      if (!this.service.testCharacteristic(this.platform.Characteristic.WaterLevel)) {
        this.service.addCharacteristic(this.platform.Characteristic.WaterLevel);
      }
    }

    // Add Lock Physical Controls characteristic if supported
    if (this.capabilities && this.capabilities.hasChildLock) {
      this.setupCharacteristic(
        this.platform.Characteristic.LockPhysicalControls,
        async () => false,
        async (value: CharacteristicValue) => { throw new Error('Locking physical controls is not supported by the tsvesync API.'); }
      );
    }
    
    // Add night light service for devices that support it
    if (this.isHumid200300S || this.isHumid1000S) {
      this.setupNightLightService();
    }
    
    // Add temperature sensor service for Superior6000S
    if (this.isSuperior6000S) {
      this.setupTemperatureService();
      this.setupFilterService();
    }
  }
  
  /**
   * Set up night light service for devices that support it
   */
  private setupNightLightService(): void {
    this.platform.log.debug(`Setting up night light service for device: ${this.device.deviceName}`);
    
    // Get or create the lightbulb service
    this.lightService = this.accessory.getService('Night Light') || 
      this.accessory.addService(this.platform.Service.Lightbulb, 'Night Light', 'night-light');
    
    // Set up on/off characteristic
    this.setupCharacteristic(
      this.platform.Characteristic.On,
      this.getNightLightOn.bind(this),
      this.setNightLightOn.bind(this),
      undefined,
      this.lightService
    );
    
    // Set up brightness characteristic
    this.setupCharacteristic(
      this.platform.Characteristic.Brightness,
      this.getNightLightBrightness.bind(this),
      this.setNightLightBrightness.bind(this),
      undefined,
      this.lightService
    );
  }
  
  /**
   * Set up temperature sensor service for Superior6000S
   */
  private setupTemperatureService(): void {
    this.platform.log.debug(`Setting up temperature sensor service for device: ${this.device.deviceName}`);
    
    // Get or create the temperature sensor service
    this.temperatureService = this.accessory.getService(this.platform.Service.TemperatureSensor) ||
      this.accessory.addService(this.platform.Service.TemperatureSensor);
    
    // Set up current temperature characteristic
    this.setupCharacteristic(
      this.platform.Characteristic.CurrentTemperature,
      this.getTemperature.bind(this),
      undefined,
      {
        minValue: -50,
        maxValue: 100,
        minStep: 0.1
      },
      this.temperatureService
    );
    
    // Set name for the temperature sensor
    this.setupCharacteristic(
      this.platform.Characteristic.Name,
      async () => `${this.device.deviceName} Temperature`,
      undefined,
      undefined,
      this.temperatureService
    );
  }
  
  /**
   * Get temperature for Superior6000S
   */
  private async getTemperature(): Promise<CharacteristicValue> {
    const extendedDevice = this.device as ExtendedVeSyncHumidifier;
    
    // Get temperature from device
    const temperature = extendedDevice.temperature || 
                       (extendedDevice.details && extendedDevice.details.temperature) || 
                       20; // Default to 20°C if not available
    
    return temperature;
  }
  
  /**
   * Set up filter maintenance service for Superior6000S
   */
  private setupFilterService(): void {
    this.platform.log.debug(`Setting up filter maintenance service for device: ${this.device.deviceName}`);
    
    // Get or create the filter maintenance service
    this.filterService = this.accessory.getService(this.platform.Service.FilterMaintenance) ||
      this.accessory.addService(this.platform.Service.FilterMaintenance);
    
    // Set up filter change indication characteristic
    this.setupCharacteristic(
      this.platform.Characteristic.FilterChangeIndication,
      this.getFilterChangeIndication.bind(this),
      undefined,
      undefined,
      this.filterService
    );
    
    // Set up filter life level characteristic
    this.setupCharacteristic(
      this.platform.Characteristic.FilterLifeLevel,
      this.getFilterLifeLevel.bind(this),
      undefined,
      undefined,
      this.filterService
    );
    
    // Set name for the filter service
    this.setupCharacteristic(
      this.platform.Characteristic.Name,
      async () => `${this.device.deviceName} Filter`,
      undefined,
      undefined,
      this.filterService
    );
  }
  
  /**
   * Get filter change indication for Superior6000S
   */
  private async getFilterChangeIndication(): Promise<CharacteristicValue> {
    const extendedDevice = this.device as ExtendedVeSyncHumidifier;
    
    // Get filter life percentage
    const filterLife = extendedDevice.filterLifePercentage || 
                      (extendedDevice.details && extendedDevice.details.filter_life) || 
                      100; // Default to 100% if not available
    
    // Return 1 (CHANGE_FILTER) if filter life is below 10%, otherwise 0 (FILTER_OK)
    return filterLife < 10 ? 1 : 0;
  }
  
  /**
   * Get filter life level for Superior6000S
   */
  private async getFilterLifeLevel(): Promise<CharacteristicValue> {
    const extendedDevice = this.device as ExtendedVeSyncHumidifier;
    
    // Get filter life percentage
    const filterLife = extendedDevice.filterLifePercentage || 
                      (extendedDevice.details && extendedDevice.details.filter_life) || 
                      100; // Default to 100% if not available
    
    return filterLife;
  }
  
  
  /**
   * Get night light on state
   */
  private async getNightLightOn(): Promise<CharacteristicValue> {
    const extendedDevice = this.device as ExtendedVeSyncHumidifier;
    const brightness = extendedDevice.nightLightBrightness || 
      (extendedDevice.details && extendedDevice.details.night_light_brightness) || 0;
    return brightness > 0;
  }
  
  /**
   * Set night light on state
   */
  private async setNightLightOn(value: CharacteristicValue): Promise<void> {
    try {
      const isOn = value as boolean;
      const extendedDevice = this.device as ExtendedVeSyncHumidifier;
      
      if (typeof extendedDevice.setNightLightBrightness === 'function') {
        const brightness = isOn ? 100 : 0;
        const success = await extendedDevice.setNightLightBrightness(brightness);
        
        if (!success) {
          throw new Error(`Failed to turn ${isOn ? 'on' : 'off'} night light`);
        }
      } else {
        throw new Error('Device API does not support night light control');
      }
    } catch (error) {
      this.handleDeviceError('set night light state', error);
    }
  }
  
  /**
   * Get night light brightness
   */
  private async getNightLightBrightness(): Promise<CharacteristicValue> {
    const extendedDevice = this.device as ExtendedVeSyncHumidifier;
    return extendedDevice.nightLightBrightness || 
      (extendedDevice.details && extendedDevice.details.night_light_brightness) || 0;
  }
  
  /**
   * Set night light brightness
   */
  private async setNightLightBrightness(value: CharacteristicValue): Promise<void> {
    try {
      const brightness = value as number;
      const extendedDevice = this.device as ExtendedVeSyncHumidifier;
      
      if (typeof extendedDevice.setNightLightBrightness === 'function') {
        const success = await extendedDevice.setNightLightBrightness(brightness);
        
        if (!success) {
          throw new Error(`Failed to set night light brightness to ${brightness}`);
        }
      } else {
        throw new Error('Device API does not support night light control');
      }
    } catch (error) {
      this.handleDeviceError('set night light brightness', error);
    }
  }

  /**
   * Update device states based on the latest details
   */
  protected async updateDeviceSpecificStates(details: any): Promise<void> {
    // Log the relevant details for debugging without using JSON.stringify on the entire object
    this.platform.log.debug(`Updating device states for ${this.device.deviceName}`);
    
    // Cast to extended device type
    const extendedDevice = this.device as ExtendedVeSyncHumidifier;
    
    if (details) {
      // Log only specific properties to avoid circular references
      this.platform.log.debug(
        `Device status: ${details.deviceStatus}, ` +
        `Speed: ${details.speed}, ` +
        `Mode: ${details.mode}, ` + 
        `Humidity: ${details.humidity}, ` +
        `MistLevel: ${extendedDevice.mistLevel}`
      );
    }
    
    // First, refresh the device details to ensure we have the latest state
    try {
      if (typeof extendedDevice.getDetails === 'function') {
        await extendedDevice.getDetails();
        // Log only specific properties to avoid circular references
        this.platform.log.debug(
          `Refreshed device status: ${this.device.deviceStatus}, ` +
          `Speed: ${this.device.speed}, ` +
          `Mode: ${extendedDevice.mode}, ` +
          `Humidity: ${extendedDevice.humidity}, ` +
          `MistLevel: ${extendedDevice.mistLevel}`
        );
      }
    } catch (error) {
      this.platform.log.warn(`Failed to refresh device details: ${error}`);
    }
    
    // Ensure we're using the most up-to-date status
    // According to the API documentation, deviceStatus should be 'on' or 'off'
    const isActive = this.device.deviceStatus === 'on';
    this.platform.log.debug(`Device ${this.device.deviceName} active state: ${isActive}, Status: ${this.device.deviceStatus}`);
    
    // Update active state - this is critical for HomeKit to show the correct state
    this.service.updateCharacteristic(
      this.platform.Characteristic.Active,
      isActive ? 1 : 0
    );

    // Update current state based on API mapping
    // HomeKit states: 0 = INACTIVE, 1 = IDLE, 2 = HUMIDIFYING, 3 = DEHUMIDIFYING
    // Mapping: 
    // - If not active -> INACTIVE (0)
    // - If active and mode is 'manual' -> HUMIDIFYING (2)
    // - If active and mode is 'auto' or 'sleep' -> Check if we need to be humidifying
    let currentState = 0; // Default to INACTIVE
    
    if (isActive) {
      if (extendedDevice.mode === 'manual') {
        currentState = 2; // HUMIDIFYING - will show "Rising to X%"
      } else if (extendedDevice.mode === 'auto' || extendedDevice.mode === 'sleep') {
        // Get current humidity reading (actual humidity in the room)
        const currentHumidity = extendedDevice.currentHumidity !== undefined ? 
                               extendedDevice.currentHumidity : 
                               extendedDevice.details?.current_humidity || 
                               0;
        
        // Get target humidity (humidity setting)
        const targetHumidity = extendedDevice.humidity || 
                              extendedDevice.configuration?.auto_target_humidity || 
                              extendedDevice.details?.target_humidity || 
                              45; // Default to 45% if not available
        
        // In auto mode, check if we need to be humidifying
        if (currentHumidity < targetHumidity) {
          currentState = 2; // HUMIDIFYING - will show "Rising to X%"
          this.platform.log.debug(`Auto mode: Current humidity ${currentHumidity}% is below target ${targetHumidity}%, setting state to HUMIDIFYING`);
        } else {
          currentState = 1; // IDLE - will show "Set to X%"
          this.platform.log.debug(`Auto mode: Current humidity ${currentHumidity}% has reached target ${targetHumidity}%, setting state to IDLE`);
        }
      }
    }
    
    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentHumidifierDehumidifierState,
      currentState
    );

    // Update target state based on device mode
    // HomeKit Target State: 0 = HUMIDIFIER_OR_DEHUMIDIFIER (Auto), 1 = HUMIDIFIER, 2 = DEHUMIDIFIER
    // Mapping:
    // - 'auto' -> HUMIDIFIER_OR_DEHUMIDIFIER (0)
    // - 'manual' -> HUMIDIFIER (1)
    // - 'sleep' -> HUMIDIFIER (1) (no direct mapping, default to HUMIDIFIER)
    let targetState = 1; // Default to HUMIDIFIER
    
    if (extendedDevice.mode === 'auto') {
      targetState = 0; // HUMIDIFIER_OR_DEHUMIDIFIER
    }
    
    this.service.updateCharacteristic(
      this.platform.Characteristic.TargetHumidifierDehumidifierState,
      targetState
    );

    // Update rotation speed - convert device speed (1-9) to HomeKit percentage (0-100)
    let rotationSpeed = 0;
    
    // For Humid200300S devices, use mistLevel if available
    if (isActive) {
      if (this.isHumid200300S && extendedDevice.mistLevel !== undefined) {
        const mistLevel = extendedDevice.mistLevel;
        this.platform.log.debug(`Device ${this.device.deviceName} mist level: ${mistLevel}`);
        
        // Convert mist level (1-9) to HomeKit percentage (0-100)
        switch (mistLevel) {
          case 1: rotationSpeed = 11; break;
          case 2: rotationSpeed = 22; break;
          case 3: rotationSpeed = 33; break;
          case 4: rotationSpeed = 44; break;
          case 5: rotationSpeed = 55; break;
          case 6: rotationSpeed = 66; break;
          case 7: rotationSpeed = 77; break;
          case 8: rotationSpeed = 88; break;
          case 9: rotationSpeed = 100; break;
        }
      } else if (this.device.speed !== undefined) {
        // Use speed for other humidifier types
        this.platform.log.debug(`Device ${this.device.deviceName} speed: ${this.device.speed}`);
        switch (this.device.speed) {
          case 1: rotationSpeed = 11; break;
          case 2: rotationSpeed = 22; break;
          case 3: rotationSpeed = 33; break;
          case 4: rotationSpeed = 44; break;
          case 5: rotationSpeed = 55; break;
          case 6: rotationSpeed = 66; break;
          case 7: rotationSpeed = 77; break;
          case 8: rotationSpeed = 88; break;
          case 9: rotationSpeed = 100; break;
        }
      }
    }
    
    this.platform.log.debug(`Setting rotation speed to ${rotationSpeed}% for device: ${this.device.deviceName}`);
    this.service.updateCharacteristic(
      this.platform.Characteristic.RotationSpeed,
      rotationSpeed
    );

    // Update relative humidity if supported
    if (this.capabilities && this.capabilities.hasHumidity) {
      // Get current humidity reading (actual humidity in the room)
      const currentHumidity = extendedDevice.currentHumidity !== undefined ? 
                             extendedDevice.currentHumidity : 
                             extendedDevice.details?.current_humidity || 
                             0;
      
      
      // Update current humidity characteristic if we have a valid reading
      if (currentHumidity > 0) {
        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentRelativeHumidity,
          currentHumidity
        );
      }
      
      // Get target humidity (humidity setting)
      // According to API docs, humidifier.humidity returns auto_target_humidity from configuration
      const targetHumidity = extendedDevice.humidity || 
                            extendedDevice.configuration?.auto_target_humidity || 
                            extendedDevice.details?.target_humidity || 
                            45; // Default to 45% if not available
      
      
      if (this.service.testCharacteristic(this.platform.Characteristic.RelativeHumidityHumidifierThreshold)) {
        this.service.updateCharacteristic(
          this.platform.Characteristic.RelativeHumidityHumidifierThreshold,
          targetHumidity
        );
      }
    }

    // Update water level if supported (inferred from water_lacks/water_tank_lifted)
    if (this.capabilities && this.capabilities.hasWaterLevel) {
      // Check for water_lacks or water_tank_lifted in details or device.details
      const waterLacks = details?.water_lacks || 
        (extendedDevice.details && extendedDevice.details.water_lacks);
      
      const waterTankLifted = details?.water_tank_lifted || 
        (extendedDevice.details && extendedDevice.details.water_tank_lifted);
      
      const waterLow = waterLacks || waterTankLifted;
      
      // Note: VeSync devices only support a boolean water_lacks property, not a percentage water level
      // We map this to 0% or 100% for HomeKit's WaterLevel characteristic
      if (this.service.getCharacteristic(this.platform.Characteristic.WaterLevel)) {
        // Map water level as 0 for low water, 100 for sufficient water
        this.service.updateCharacteristic(
          this.platform.Characteristic.WaterLevel,
          waterLow ? 0 : 100
        );
        this.platform.log.debug(`Water level for ${this.device.deviceName}: ${waterLow ? 'Low (0%)' : 'OK (100%)'}`);
      }
    }
    
    // Update night light characteristics for devices that support it
    if ((this.isHumid200300S || this.isHumid1000S) && this.lightService) {
      const brightness = extendedDevice.nightLightBrightness || 
        (extendedDevice.details && extendedDevice.details.night_light_brightness) || 0;
      
      // Update on/off state
      this.lightService.updateCharacteristic(
        this.platform.Characteristic.On,
        brightness > 0
      );
      
      // Update brightness
      this.lightService.updateCharacteristic(
        this.platform.Characteristic.Brightness,
        brightness
      );
    }
    
    // Update temperature for Superior6000S
    if (this.isSuperior6000S && this.temperatureService) {
      const temperature = extendedDevice.temperature || 
        (extendedDevice.details && extendedDevice.details.temperature) || 
        20; // Default to 20°C if not available
      
      this.temperatureService.updateCharacteristic(
        this.platform.Characteristic.CurrentTemperature,
        temperature
      );
    }
    
    // Update filter life for Superior6000S
    if (this.isSuperior6000S && this.filterService) {
      const filterLife = extendedDevice.filterLifePercentage || 
        (extendedDevice.details && extendedDevice.details.filter_life) || 
        100; // Default to 100% if not available
      
      this.filterService.updateCharacteristic(
        this.platform.Characteristic.FilterLifeLevel,
        filterLife
      );
      
      this.filterService.updateCharacteristic(
        this.platform.Characteristic.FilterChangeIndication,
        filterLife < 10 ? 1 : 0 // 1 = CHANGE_FILTER, 0 = FILTER_OK
      );
    }
  }

  protected getDeviceCapabilities(): DeviceCapabilities {
    return {
      hasBrightness: false,
      hasColorTemp: false,
      hasColor: false,
      hasSpeed: true,
      hasHumidity: true,
      hasAirQuality: false,
      hasWaterLevel: true,
      hasChildLock: true,
      hasSwingMode: false,
    };
  }

  private async getActive(): Promise<CharacteristicValue> {
    // Log the current device status for debugging
    this.platform.log.debug(`Getting active state for device: ${this.device.deviceName}, current status: ${this.device.deviceStatus}`);
    
    // Refresh device status before returning
    try {
      const extendedDevice = this.device as ExtendedVeSyncHumidifier;
      if (typeof extendedDevice.getDetails === 'function') {
        await extendedDevice.getDetails();
        this.platform.log.debug(`Refreshed device status: ${this.device.deviceStatus}, Mode: ${extendedDevice.mode}`);
      }
    } catch (error) {
      this.platform.log.warn(`Failed to refresh device status: ${error}`);
    }
    
    // Check if the device is on based on the deviceStatus property
    // According to the API documentation, deviceStatus should be 'on' or 'off'
    // In the test script, they use device.deviceStatus to determine if the device is on or off
    const isActive = this.device.deviceStatus === 'on';
    
    // Log the active state for debugging with more details
    this.platform.log.debug(`Device ${this.device.deviceName} is ${isActive ? 'active' : 'inactive'}, Status: ${this.device.deviceStatus}`);
    
    // Return the active state without updating characteristics here
    // This will let HomeKit handle the state update
    return isActive ? 1 : 0;
  }

  private async setActive(value: CharacteristicValue): Promise<void> {
    try {
      const isOn = value as number === 1;
      this.platform.log.debug(`Setting device ${this.device.deviceName} to ${isOn ? 'on' : 'off'}`);
      
      // Get the extended device with all potential methods
      const extendedDevice = this.device as ExtendedVeSyncHumidifier;
      
      // Refresh device details to ensure we have the latest state before checking
      try {
        if (typeof extendedDevice.getDetails === 'function') {
          await extendedDevice.getDetails();
          this.platform.log.debug(`Current device status before setting: ${this.device.deviceStatus}`);
        }
      } catch (error) {
        this.platform.log.warn(`Failed to refresh device status: ${error}`);
      }
      
      // Check current state after refreshing
      const currentlyOn = this.device.deviceStatus === 'on';
      this.platform.log.debug(`Current device state: ${currentlyOn ? 'on' : 'off'}, requested state: ${isOn ? 'on' : 'off'}`);
      
      // If the device is already in the desired state, just update HomeKit
      if (currentlyOn === isOn) {
        this.platform.log.debug(`Device ${this.device.deviceName} is already ${isOn ? 'on' : 'off'}, skipping API call`);
        
        // Update HomeKit characteristics to match the current device state
        this.service.updateCharacteristic(
          this.platform.Characteristic.Active,
          isOn ? 1 : 0
        );
        
        // Update current state based on the active state and mode
        const currentState = isOn ? 
          (extendedDevice.mode === 'manual' ? 2 : 1) : // 2 = HUMIDIFYING, 1 = IDLE
          0; // 0 = INACTIVE
        
        this.service.updateCharacteristic(
          this.platform.Characteristic.CurrentHumidifierDehumidifierState,
          currentState
        );
        
        // Update all device states to ensure HomeKit is in sync
        await this.updateDeviceSpecificStates(this.device);
        return;
      }
      
      let success = false;
      
      // Try to turn the device on/off using the appropriate method based on device type
      if (isOn) {
        // Turn on the device
        this.platform.log.debug(`Attempting to turn ON device: ${this.device.deviceName}`);
        
        // Use the appropriate method based on device type
        success = await this.device.turnOn();
        
        // If successful, set the device to manual mode
        if (success) {
          // For devices with specific mode setting methods, use them
          if (typeof extendedDevice.setManualMode === 'function') {
            this.platform.log.debug(`Setting device to manual mode using setManualMode: ${this.device.deviceName}`);
            const modeSuccess = await extendedDevice.setManualMode();
            this.platform.log.debug(`Set manual mode result: ${modeSuccess ? 'success' : 'failed'}`);
          } else if (typeof extendedDevice.setMode === 'function') {
            // Fall back to generic setMode for other devices
            this.platform.log.debug(`Setting device to manual mode using setMode: ${this.device.deviceName}`);
            const modeSuccess = await extendedDevice.setMode('manual');
            this.platform.log.debug(`Set manual mode result: ${modeSuccess ? 'success' : 'failed'}`);
          }
        }
      } else {
        // Turn off the device
        this.platform.log.debug(`Attempting to turn OFF device: ${this.device.deviceName}`);
        success = await this.device.turnOff();
      }
      
      if (!success) {
        this.platform.log.warn(`API call to turn ${isOn ? 'on' : 'off'} device returned false`);
      }
      
      // Refresh device details to get the latest state
      if (typeof extendedDevice.getDetails === 'function') {
        await extendedDevice.getDetails();
        this.platform.log.debug(
          `Device ${this.device.deviceName} status after setting: ` +
          `Status: ${this.device.deviceStatus}, ` +
          `Mode: ${extendedDevice.mode}, ` +
          `Speed: ${this.device.speed}, ` +
          `MistLevel: ${extendedDevice.mistLevel}`
        );
      }
      
      // Verify the device is actually in the desired state
      const actuallyOn = this.device.deviceStatus === 'on';
      if (actuallyOn !== isOn) {
        this.platform.log.warn(
          `Device ${this.device.deviceName} did not change to desired state. ` +
          `Wanted: ${isOn ? 'on' : 'off'}, Actual: ${actuallyOn ? 'on' : 'off'}`
        );
      }
      
      // Always update HomeKit with the actual device state, not the requested state
      this.service.updateCharacteristic(
        this.platform.Characteristic.Active,
        actuallyOn ? 1 : 0
      );
      
      // Update current state based on the actual state and mode
      let currentState = 0; // Default to INACTIVE
      
      if (actuallyOn) {
        if (extendedDevice.mode === 'manual') {
          currentState = 2; // HUMIDIFYING - will show "Rising to X%"
        } else if (extendedDevice.mode === 'auto' || extendedDevice.mode === 'sleep') {
          // Get current humidity reading (actual humidity in the room)
          const currentHumidity = extendedDevice.currentHumidity !== undefined ? 
                                 extendedDevice.currentHumidity : 
                                 extendedDevice.details?.current_humidity || 
                                 0;
          
          // Get target humidity (humidity setting)
          const targetHumidity = extendedDevice.humidity || 
                                extendedDevice.configuration?.auto_target_humidity || 
                                extendedDevice.details?.target_humidity || 
                                45; // Default to 45% if not available
          
          // In auto mode, check if we need to be humidifying
          if (currentHumidity < targetHumidity) {
            currentState = 2; // HUMIDIFYING - will show "Rising to X%"
            this.platform.log.debug(`Auto mode: Current humidity ${currentHumidity}% is below target ${targetHumidity}%, setting state to HUMIDIFYING`);
          } else {
            currentState = 1; // IDLE - will show "Set to X%"
            this.platform.log.debug(`Auto mode: Current humidity ${currentHumidity}% has reached target ${targetHumidity}%, setting state to IDLE`);
          }
        }
      }
      
      this.service.updateCharacteristic(
        this.platform.Characteristic.CurrentHumidifierDehumidifierState,
        currentState
      );
      
      // Update device state and characteristics
      await this.updateDeviceSpecificStates(this.device);
      await this.persistDeviceState('deviceStatus', actuallyOn ? 'on' : 'off');
    } catch (error) {
      this.handleDeviceError('set active state', error);
    }
  }

  private async getRotationSpeed(): Promise<CharacteristicValue> {
    if (this.device.speed === undefined || this.device.speed === null) {
      return 0;
    }

    // Convert device speed (1-9) to HomeKit percentage (0-100)
    switch (this.device.speed) {
      case 0: return 0;
      case 1: return 11;
      case 2: return 22;
      case 3: return 33;
      case 4: return 44;
      case 5: return 55;
      case 6: return 66;
      case 7: return 77;
      case 8: return 88;
      case 9: return 100;
      default: return 0;
    }
  }

  private async setTargetState(value: CharacteristicValue): Promise<void> {
    try {
      // HomeKit Target State: 0 = HUMIDIFIER_OR_DEHUMIDIFIER (Auto), 1 = HUMIDIFIER, 2 = DEHUMIDIFIER
      this.platform.log.debug(`Setting target state to ${value} for device: ${this.device.deviceName}`);
      
      const device = this.device as ExtendedVeSyncHumidifier;
      
      // Check if device is off - if so, turn it on first
      if (this.device.deviceStatus !== 'on') {
        this.platform.log.debug(`Device is off, turning on before changing mode: ${this.device.deviceName}`);
        const turnOnSuccess = await this.device.turnOn();
        if (!turnOnSuccess) {
          throw new Error('Failed to turn on device before changing mode');
        }
        
        // Refresh device details after turning on
        if (typeof device.getDetails === 'function') {
          await device.getDetails();
          this.platform.log.debug(`Device status after turning on: ${this.device.deviceStatus}`);
        }
      }
      
      // Map HomeKit target states to device modes
      let mode: string = 'manual'; // Default to manual mode
      
      switch (value) {
        case 0: // Auto
          mode = 'auto';
          break;
        case 1: // Humidifier
          mode = 'manual';
          break;
        case 2: // Dehumidifier (not supported, but we'll handle it gracefully)
          this.platform.log.warn(`Dehumidifier mode not supported for device: ${this.device.deviceName}, using manual mode instead`);
          mode = 'manual';
          break;
        default:
          this.platform.log.warn(`Unknown target state value: ${value}, using manual mode as default`);
          mode = 'manual';
      }
      
      // Check current mode first
      if (device.mode === mode) {
        this.platform.log.debug(`Device ${this.device.deviceName} is already in ${mode} mode, skipping API call`);
        
        // Update target state to reflect the current mode
        const targetState = mode === 'auto' ? 0 : 1;
        this.updateCharacteristicValue(
          this.platform.Characteristic.TargetHumidifierDehumidifierState,
          targetState
        );
        
        return;
      }
      
      let success = false;
      
      // For Humid200300S devices, use the specific mode setting methods if available
      if (this.isHumid200300S) {
        if (mode === 'auto' && typeof device.setAutoMode === 'function') {
          this.platform.log.debug(`Setting auto mode for Humid200300S device: ${this.device.deviceName}`);
          success = await device.setAutoMode();
          this.platform.log.debug(`Set auto mode result: ${success ? 'success' : 'failed'}`);
        } else if (mode === 'manual' && typeof device.setManualMode === 'function') {
          this.platform.log.debug(`Setting manual mode for Humid200300S device: ${this.device.deviceName}`);
          success = await device.setManualMode();
          this.platform.log.debug(`Set manual mode result: ${success ? 'success' : 'failed'}`);
        } else if (typeof device.setSleepMode === 'function' && mode === 'sleep') {
          this.platform.log.debug(`Setting sleep mode for Humid200300S device: ${this.device.deviceName}`);
          success = await device.setSleepMode();
          this.platform.log.debug(`Set sleep mode result: ${success ? 'success' : 'failed'}`);
        } else if (typeof device.setMode === 'function') {
          // Fall back to generic setMode if specific method not available
          this.platform.log.debug(`Setting mode to ${mode} for Humid200300S device using generic method: ${this.device.deviceName}`);
          success = await device.setMode(mode as 'manual' | 'auto' | 'sleep');
          this.platform.log.debug(`Set mode result: ${success ? 'success' : 'failed'}`);
        } else {
          throw new Error('Device API does not support mode setting operations');
        }
      } else if (typeof device.setMode === 'function') {
        // For non-Humid200300S devices, use the generic setMode method
        this.platform.log.debug(`Setting mode to ${mode} for device: ${this.device.deviceName}`);
        success = await device.setMode(mode as 'manual' | 'auto' | 'sleep');
        this.platform.log.debug(`Set mode result: ${success ? 'success' : 'failed'}`);
      } else {
        throw new Error('Device API does not support mode setting operations');
      }
      
      if (!success) {
        throw new Error(`Failed to set device mode to ${mode}`);
      }
      
      // Refresh device details to get the latest state
      if (typeof device.getDetails === 'function') {
        await device.getDetails();
        this.platform.log.debug(`Device ${this.device.deviceName} mode after setting: ${device.mode}`);
      }
      
      // Verify the device is actually in the desired mode
      const actualMode = device.mode;
      if (actualMode !== mode) {
        this.platform.log.warn(
          `Device ${this.device.deviceName} did not change to desired mode. ` +
          `Wanted: ${mode}, Actual: ${actualMode}`
        );
      }
      
      // Update the target state based on the actual mode
      const targetState = actualMode === 'auto' ? 0 : 1;
      this.updateCharacteristicValue(
        this.platform.Characteristic.TargetHumidifierDehumidifierState,
        targetState
      );
      
      // Update current state based on the active state and mode
      let currentState = 0; // Default to INACTIVE
      
      if (this.device.deviceStatus === 'on') {
        if (actualMode === 'manual') {
          currentState = 2; // HUMIDIFYING - will show "Rising to X%"
        } else if (actualMode === 'auto' || actualMode === 'sleep') {
          // Get current humidity reading (actual humidity in the room)
          const currentHumidity = device.currentHumidity !== undefined ? 
                                 device.currentHumidity : 
                                 device.details?.current_humidity || 
                                 0;
          
          // Get target humidity (humidity setting)
          const targetHumidity = device.humidity || 
                                device.configuration?.auto_target_humidity || 
                                device.details?.target_humidity || 
                                45; // Default to 45% if not available
          
          // In auto mode, check if we need to be humidifying
          if (currentHumidity < targetHumidity) {
            currentState = 2; // HUMIDIFYING - will show "Rising to X%"
            this.platform.log.debug(`Auto mode: Current humidity ${currentHumidity}% is below target ${targetHumidity}%, setting state to HUMIDIFYING`);
          } else {
            currentState = 1; // IDLE - will show "Set to X%"
            this.platform.log.debug(`Auto mode: Current humidity ${currentHumidity}% has reached target ${targetHumidity}%, setting state to IDLE`);
          }
        }
      }
      
      this.updateCharacteristicValue(
        this.platform.Characteristic.CurrentHumidifierDehumidifierState,
        currentState
      );
      
      // Update device state and characteristics
      await this.updateDeviceSpecificStates(this.device);
    } catch (error) {
      this.handleDeviceError('set target state', error);
    }
  }

  private async handleSetRotationSpeed(value: CharacteristicValue): Promise<void> {
    try {
      const percentage = value as number;
      this.platform.log.debug(`Setting rotation speed to ${percentage}% for device: ${this.device.deviceName}`);
      
      if (percentage === 0) {
        // Turn off the device instead of setting speed to 0
        this.platform.log.debug(`Turning off device ${this.device.deviceName} due to 0% rotation speed`);
        const success = await this.device.turnOff();
        if (!success) {
          throw new Error('Failed to turn off device');
        }
        return;
      }
  
      // Convert HomeKit percentage (0-100) to device speed (1-9)
      let speed: number;
      if (percentage <= 11) {
        speed = 1;
      } else if (percentage <= 22) {
        speed = 2;
      } else if (percentage <= 33) {
        speed = 3;
      } else if (percentage <= 44) {
        speed = 4;
      } else if (percentage <= 55) {
        speed = 5;
      } else if (percentage <= 66) {
        speed = 6;
      } else if (percentage <= 77) {
        speed = 7;
      } else if (percentage <= 88) {
        speed = 8;
      } else {
        speed = 9;
      }
  
      // Adjust speed based on device type
      const extendedDevice = this.device as ExtendedVeSyncHumidifier;
      let success = false;
      
      // For Humid200S devices, limit mist level to 1-3
      if (this.isHumid200S) {
        // Limit speed to 1-3 for Humid200S devices
        speed = Math.min(speed, 3);
        this.platform.log.debug(`Limiting mist level to ${speed} for Humid200S device: ${this.device.deviceName}`);
      }
      
      // Use the appropriate method based on device type
      if ((this.isHumid200S || this.isHumid200300S || this.isHumid1000S || this.isSuperior6000S) && 
          typeof extendedDevice.setMistLevel === 'function') {
        // Use setMistLevel for devices that support it
        this.platform.log.debug(`Setting mist level to ${speed} for device: ${this.device.deviceName}`);
        success = await extendedDevice.setMistLevel(speed);
      } else {
        // Fall back to changeFanSpeed for other humidifier types
        this.platform.log.debug(`Setting fan speed to ${speed} for device: ${this.device.deviceName}`);
        success = await this.device.changeFanSpeed(speed);
      }
      
      if (!success) {
        throw new Error(`Failed to set speed to ${speed}`);
      }
      
      // Refresh device details to get the latest state
      if (typeof extendedDevice.getDetails === 'function') {
        await extendedDevice.getDetails();
        
        // Log the appropriate property based on device type
        if (this.isHumid200300S && extendedDevice.mistLevel !== undefined) {
          this.platform.log.debug(`Device ${this.device.deviceName} mist level after setting: ${extendedDevice.mistLevel}`);
        } else {
          this.platform.log.debug(`Device ${this.device.deviceName} speed after setting: ${this.device.speed}`);
        }
      }
      
      // Update device state and characteristics
      await this.updateDeviceSpecificStates(this.device);
    } catch (error) {
      this.handleDeviceError('set rotation speed', error);
    }
  }
  
  /**
   * Helper method to update a characteristic value for a specific service
   */
  /**
   * Get target humidity level
   */
  private async getTargetHumidity(): Promise<CharacteristicValue> {
    const extendedDevice = this.device as ExtendedVeSyncHumidifier;
    
    // According to API docs, humidifier.humidity returns auto_target_humidity from configuration
    if (typeof extendedDevice.humidity !== 'undefined') {
      return extendedDevice.humidity;
    }
    
    // Fall back to configuration for auto_target_humidity
    if (extendedDevice.configuration && typeof extendedDevice.configuration.auto_target_humidity !== 'undefined') {
      return extendedDevice.configuration.auto_target_humidity;
    }
    
    // Try to get target humidity from device details
    if (extendedDevice.details && typeof extendedDevice.details.target_humidity !== 'undefined') {
      return extendedDevice.details.target_humidity;
    }
    
    // Default to 45% if no target humidity is available
    return 45;
  }
  
  /**
   * Set target humidity level
   */
  private async setTargetHumidity(value: CharacteristicValue): Promise<void> {
    try {
      const targetHumidity = value as number;
      
      
      this.platform.log.debug(`Setting target humidity to ${targetHumidity}% for device: ${this.device.deviceName}`);
      
      const extendedDevice = this.device as ExtendedVeSyncHumidifier;
      
      
      // Check if device is off - if so, turn it on first
      if (this.device.deviceStatus !== 'on') {
        this.platform.log.debug(`Device is off, turning on before setting humidity: ${this.device.deviceName}`);
        const turnOnSuccess = await this.device.turnOn();
        if (!turnOnSuccess) {
          throw new Error('Failed to turn on device before setting humidity');
        }
      }
      
      let success = false;
      
      // Try to set humidity using the appropriate method
      if (typeof extendedDevice.setHumidity === 'function') {
        // Use setHumidity for devices that support it
        this.platform.log.debug(`Setting humidity to ${targetHumidity}% using setHumidity: ${this.device.deviceName}`);
        success = await extendedDevice.setHumidity(targetHumidity);
        
      } else if (typeof extendedDevice.setTargetHumidity === 'function') {
        // Use setTargetHumidity for devices that support it
        this.platform.log.debug(`Setting humidity to ${targetHumidity}% using setTargetHumidity: ${this.device.deviceName}`);
        success = await extendedDevice.setTargetHumidity(targetHumidity);
        
      } else {
        throw new Error('Device API does not support setting target humidity');
      }
      
      if (!success) {
        throw new Error(`Failed to set target humidity to ${targetHumidity}%`);
      }
      
      // Refresh device details to get the latest state
      if (typeof extendedDevice.getDetails === 'function') {
        await extendedDevice.getDetails();
        
        // Log the target humidity after setting
        const currentTarget = extendedDevice.details?.target_humidity || extendedDevice.targetHumidity;
        this.platform.log.debug(`Device ${this.device.deviceName} target humidity after setting: ${currentTarget}%`);
        
      }
      
      // Update the target humidity characteristic
      this.service.updateCharacteristic(
        this.platform.Characteristic.RelativeHumidityHumidifierThreshold,
        targetHumidity
      );
      
      // Update device state and characteristics
      await this.updateDeviceSpecificStates(this.device);
      
      // Persist the target humidity
      await this.persistDeviceState('targetHumidity', targetHumidity);
    } catch (error) {
      this.handleDeviceError('set target humidity', error);
    }
  }
  
  private updateServiceCharacteristicValue(
    service: Service,
    characteristic: any,
    value: CharacteristicValue
  ): void {
    service.updateCharacteristic(characteristic, value);
    
    this.platform.log.debug(
      `[${this.device.deviceName}] Updated ${characteristic.name} to ${value}`
    );
  }
}
