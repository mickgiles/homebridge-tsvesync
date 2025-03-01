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
  setNightLightBrightness?(brightness: number): Promise<boolean>;
  
  // Humid200300S specific methods (from API documentation)
  setMistLevel?(level: number): Promise<boolean>;
  setHumidity?(humidity: number): Promise<boolean>;
  setAutoMode?(): Promise<boolean>;
  setManualMode?(): Promise<boolean>;
  setSleepMode?(): Promise<boolean>;
  setDisplay?(on: boolean): Promise<boolean>;
  turnOnDisplay?(): Promise<boolean>;
  turnOffDisplay?(): Promise<boolean>;
  automaticStopOn?(): Promise<boolean>;
  automaticStopOff?(): Promise<boolean>;
  
  // Humid200300S specific properties
  mistLevel?: number;
  // Note: humidity must be non-optional to match VeSyncHumidifier interface
  humidity: number;
  currentHumidity?: number; // Actual humidity reading in the room
  mode?: string;
  screenStatus?: 'on' | 'off';
  
  // For Humid200300S specific details
  details?: {
    target_humidity?: number;
    night_light_brightness?: number;
    current_humidity?: number;
    water_lacks?: boolean;
    water_tank_lifted?: boolean;
    humidity_high?: boolean;
    automatic_stop?: boolean;
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
  private isHumid200300S: boolean;
  private lightService?: Service;

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
    
    // Detect if this is a Humid200300S device
    this.isHumid200300S = this.detectHumid200300S();
    
    if (this.isHumid200300S) {
      this.platform.log.debug(`Detected Humid200300S device: ${this.device.deviceName}`);
    }
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
    
    // Check device type for Classic200S or Classic300S
    const deviceType = this.device.deviceType.toUpperCase();
    return deviceType.includes('CLASSIC200S') || deviceType.includes('CLASSIC300S');
  }

  protected setupService(): void {
    // No need to check for capabilities initialization since we set defaults in constructor

    // Get or create the humidifier service
    this.service = this.accessory.getService(this.platform.Service.HumidifierDehumidifier) ||
      this.accessory.addService(this.platform.Service.HumidifierDehumidifier);

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
      
      // Set up handlers for target humidity
      this.setupCharacteristic(
        this.platform.Characteristic.RelativeHumidityHumidifierThreshold,
        this.getTargetHumidity.bind(this),
        this.setTargetHumidity.bind(this)
      );
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
    
    // Add night light service for Humid200300S devices
    if (this.isHumid200300S) {
      this.setupNightLightService();
    }
  }
  
  /**
   * Set up night light service for Humid200300S devices
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
    // - If active and mode is 'auto' or 'sleep' -> IDLE (1)
    let currentState = 0; // Default to INACTIVE
    
    if (isActive) {
      if (extendedDevice.mode === 'manual') {
        currentState = 2; // HUMIDIFYING
      } else if (extendedDevice.mode === 'auto' || extendedDevice.mode === 'sleep') {
        currentState = 1; // IDLE
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
      
      // [TEMP] Add logging for current humidity values
      this.platform.log.warn(
        `[TEMP_HUMIDITY_DEBUG] Device ${this.device.deviceName} - Current humidity values:` +
        ` device.currentHumidity=${extendedDevice.currentHumidity},` +
        ` details.current_humidity=${extendedDevice.details?.current_humidity},` +
        ` using value=${currentHumidity}`
      );
      
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
      
      // [TEMP] Add logging for target humidity values
      this.platform.log.warn(
        `[TEMP_HUMIDITY_DEBUG] Device ${this.device.deviceName} - Target humidity values:` +
        ` device.humidity=${extendedDevice.humidity},` +
        ` configuration.auto_target_humidity=${extendedDevice.configuration?.auto_target_humidity},` +
        ` details.target_humidity=${extendedDevice.details?.target_humidity},` +
        ` final targetHumidity=${targetHumidity}`
      );
      
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
      
      if (this.service.getCharacteristic(this.platform.Characteristic.WaterLevel)) {
        // Map water level as 0 for low water, 100 for sufficient water
        this.service.updateCharacteristic(
          this.platform.Characteristic.WaterLevel,
          waterLow ? 0 : 100
        );
      }
    }
    
    // Update night light characteristics for Humid200300S devices
    if (this.isHumid200300S && this.lightService) {
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
      
      // Try to turn the device on/off using the appropriate method
      if (isOn) {
        // Turn on the device
        this.platform.log.debug(`Attempting to turn ON device: ${this.device.deviceName}`);
        success = await this.device.turnOn();
        
        // If successful, set the device to manual mode
        if (success) {
          // For Humid200300S devices, use the specific setManualMode method if available
          if (this.isHumid200300S && typeof extendedDevice.setManualMode === 'function') {
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
      const currentState = actuallyOn ? 
        (extendedDevice.mode === 'manual' ? 2 : 1) : // 2 = HUMIDIFYING, 1 = IDLE
        0; // 0 = INACTIVE
      
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
      const currentState = this.device.deviceStatus === 'on' ? 
        (actualMode === 'manual' ? 2 : 1) : // 2 = HUMIDIFYING, 1 = IDLE
        0; // 0 = INACTIVE
      
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
  
      // Check if this is a Humid200300S device and use setMistLevel if available
      const extendedDevice = this.device as ExtendedVeSyncHumidifier;
      let success = false;
      
      if (this.isHumid200300S && typeof extendedDevice.setMistLevel === 'function') {
        // Use setMistLevel for Humid200300S devices
        this.platform.log.debug(`Setting mist level to ${speed} for Humid200300S device: ${this.device.deviceName}`);
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
      // [TEMP] Add logging for target humidity source
      this.platform.log.warn(
        `[TEMP_HUMIDITY_DEBUG] getTargetHumidity for ${this.device.deviceName}:` +
        ` device.humidity=${extendedDevice.humidity},` +
        ` configuration.auto_target_humidity=${extendedDevice.configuration?.auto_target_humidity},` +
        ` details.target_humidity=${extendedDevice.details?.target_humidity},` +
        ` returning from device.humidity=${extendedDevice.humidity}`
      );
      return extendedDevice.humidity;
    }
    
    // Fall back to configuration for auto_target_humidity
    if (extendedDevice.configuration && typeof extendedDevice.configuration.auto_target_humidity !== 'undefined') {
      // [TEMP] Add logging for target humidity source
      this.platform.log.warn(
        `[TEMP_HUMIDITY_DEBUG] getTargetHumidity for ${this.device.deviceName}:` +
        ` device.humidity=${extendedDevice.humidity},` +
        ` configuration.auto_target_humidity=${extendedDevice.configuration.auto_target_humidity},` +
        ` details.target_humidity=${extendedDevice.details?.target_humidity},` +
        ` returning from configuration=${extendedDevice.configuration.auto_target_humidity}`
      );
      return extendedDevice.configuration.auto_target_humidity;
    }
    
    // Try to get target humidity from device details
    if (extendedDevice.details && typeof extendedDevice.details.target_humidity !== 'undefined') {
      // [TEMP] Add logging for target humidity source
      this.platform.log.warn(
        `[TEMP_HUMIDITY_DEBUG] getTargetHumidity for ${this.device.deviceName}:` +
        ` device.humidity=${extendedDevice.humidity},` +
        ` configuration.auto_target_humidity=${extendedDevice.configuration?.auto_target_humidity},` +
        ` details.target_humidity=${extendedDevice.details.target_humidity},` +
        ` returning from details=${extendedDevice.details.target_humidity}`
      );
      return extendedDevice.details.target_humidity;
    }
    
    // Default to 45% if no target humidity is available
    this.platform.log.warn(
      `[TEMP_HUMIDITY_DEBUG] getTargetHumidity for ${this.device.deviceName}:` +
      ` device.humidity=${extendedDevice.humidity},` +
      ` configuration.auto_target_humidity=${extendedDevice.configuration?.auto_target_humidity},` +
      ` details.target_humidity=${extendedDevice.details?.target_humidity},` +
      ` returning default=45`
    );
    return 45;
  }
  
  /**
   * Set target humidity level
   */
  private async setTargetHumidity(value: CharacteristicValue): Promise<void> {
    try {
      const targetHumidity = value as number;
      
      // [TEMP] Add logging for target humidity setting
      this.platform.log.warn(
        `[TEMP_HUMIDITY_DEBUG] setTargetHumidity for ${this.device.deviceName}:` +
        ` requested value=${targetHumidity}`
      );
      
      this.platform.log.debug(`Setting target humidity to ${targetHumidity}% for device: ${this.device.deviceName}`);
      
      const extendedDevice = this.device as ExtendedVeSyncHumidifier;
      
      // [TEMP] Add logging for initial device state
      this.platform.log.warn(
        `[TEMP_HUMIDITY_DEBUG] setTargetHumidity initial state for ${this.device.deviceName}:` +
        ` device.deviceStatus=${this.device.deviceStatus},` +
        ` configuration.auto_target_humidity=${extendedDevice.configuration?.auto_target_humidity},` +
        ` details.target_humidity=${extendedDevice.details?.target_humidity},` +
        ` device.targetHumidity=${extendedDevice.targetHumidity}`
      );
      
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
        
        // [TEMP] Add logging for API method used
        this.platform.log.warn(
          `[TEMP_HUMIDITY_DEBUG] setTargetHumidity for ${this.device.deviceName}:` +
          ` used method=setHumidity, success=${success}`
        );
      } else if (typeof extendedDevice.setTargetHumidity === 'function') {
        // Use setTargetHumidity for devices that support it
        this.platform.log.debug(`Setting humidity to ${targetHumidity}% using setTargetHumidity: ${this.device.deviceName}`);
        success = await extendedDevice.setTargetHumidity(targetHumidity);
        
        // [TEMP] Add logging for API method used
        this.platform.log.warn(
          `[TEMP_HUMIDITY_DEBUG] setTargetHumidity for ${this.device.deviceName}:` +
          ` used method=setTargetHumidity, success=${success}`
        );
      } else {
        // [TEMP] Add logging for missing API method
        this.platform.log.warn(
          `[TEMP_HUMIDITY_DEBUG] setTargetHumidity for ${this.device.deviceName}:` +
          ` no suitable method found, setHumidity=${typeof extendedDevice.setHumidity},` +
          ` setTargetHumidity=${typeof extendedDevice.setTargetHumidity}`
        );
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
        
        // [TEMP] Add logging for device state after API call
        this.platform.log.warn(
          `[TEMP_HUMIDITY_DEBUG] setTargetHumidity result for ${this.device.deviceName}:` +
          ` success=${success},` +
          ` new configuration.auto_target_humidity=${extendedDevice.configuration?.auto_target_humidity},` +
          ` new details.target_humidity=${extendedDevice.details?.target_humidity},` +
          ` new device.targetHumidity=${extendedDevice.targetHumidity}`
        );
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
      // [TEMP] Add logging for errors
      this.platform.log.warn(
        `[TEMP_HUMIDITY_DEBUG] setTargetHumidity error for ${this.device.deviceName}:` +
        ` error=${error instanceof Error ? error.message : String(error)}`
      );
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
