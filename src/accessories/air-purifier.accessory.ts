import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { BaseAccessory } from './base.accessory';
import { TSVESyncPlatform } from '../platform';
import { DeviceCapabilities, VeSyncAirPurifier } from '../types/device.types';

// Extended interface to include device-specific methods and properties
interface ExtendedVeSyncAirPurifier extends VeSyncAirPurifier {
  deviceType: string;
  // Override setMode from base interface to make it more specific
  setMode(mode: string): Promise<boolean>;
  // Add additional methods
  autoMode?(): Promise<boolean>;
  manualMode?(): Promise<boolean>;
  sleepMode?(): Promise<boolean>;
  setDisplay?(on: boolean): Promise<boolean>;
  turnOnDisplay?(): Promise<boolean>;
  turnOffDisplay?(): Promise<boolean>;
  setChildLock?(enabled: boolean): Promise<boolean>;
  setOscillation?(enabled: boolean): Promise<boolean>;
  hasFeature?(feature: string): boolean;
  isFeatureSupportedInCurrentMode?(feature: string): boolean;
  getMaxFanSpeed?(): number;
  // Filter life property from VeSyncFan base class (inherited from VeSyncAirPurifier)
  // filterLife: number; // Already defined in base interface
  details?: {
    filter_life?: number | { percent: number };
    child_lock?: boolean;
    air_quality_value?: number;
    air_quality?: string | number;
    screen_status?: 'on' | 'off';
    pm25?: number;
    pm10?: number;
    pm1?: number;
    mode?: string;
  };
}

export class AirPurifierAccessory extends BaseAccessory {
  private readonly capabilities: DeviceCapabilities;
  protected readonly device: VeSyncAirPurifier;
  private isAirBypassDevice: boolean;
  private isAirBaseV2Device: boolean;
  private isAir131Device: boolean;
  private airQualityService?: Service;
  private lastSetSpeed: number = 0; // Track the last speed we set
  private lastSetPercentage: number = 0; // Track the last percentage we set
  private skipNextUpdate: boolean = false; // Flag to skip the next update

  constructor(
    platform: TSVESyncPlatform,
    accessory: PlatformAccessory,
    device: VeSyncAirPurifier
  ) {
    super(platform, accessory, device);
    this.device = device;
    this.capabilities = this.getDeviceCapabilities();
    
    // Detect device class based on model number patterns
    const extendedDevice = this.device as ExtendedVeSyncAirPurifier;
    const deviceType = extendedDevice.deviceType || '';
    
    // AirBypass Devices: Core series, LAP-C series, Vital series
    // Use case-insensitive check for Core series to handle 'Core300S', 'CORE300S', etc.
    this.isAirBypassDevice = deviceType.toUpperCase().includes('CORE') || 
                            deviceType.startsWith('LAP-C') || 
                            deviceType.toUpperCase().includes('VITAL');
    
    // AirBaseV2 Devices: LAP-V series, LAP-EL series, EverestAir series
    this.isAirBaseV2Device = deviceType.startsWith('LAP-V') || 
                            deviceType.startsWith('LAP-EL') || 
                            deviceType.toUpperCase().includes('EVERESTAIR');
    
    // Air131 Devices: LV-PUR131S, LV-RH131S
    this.isAir131Device = deviceType.startsWith('LV-');
    
    // Log device class detection with more detail
    this.platform.log.info(`Device Classification for ${this.device.deviceName}:`);
    this.platform.log.info(`  - Device Type: "${deviceType}"`);
    this.platform.log.info(`  - Is AirBypass: ${this.isAirBypassDevice}`);
    this.platform.log.info(`  - Is AirBaseV2: ${this.isAirBaseV2Device}`);
    this.platform.log.info(`  - Is Air131: ${this.isAir131Device}`);
    
    if (this.isAirBypassDevice) {
      this.platform.log.debug(`Detected AirBypass device: ${this.device.deviceName} (${deviceType})`);
    } else if (this.isAirBaseV2Device) {
      this.platform.log.debug(`Detected AirBaseV2 device: ${this.device.deviceName} (${deviceType})`);
    } else if (this.isAir131Device) {
      this.platform.log.debug(`Detected Air131 device: ${this.device.deviceName} (${deviceType})`);
    } else {
      this.platform.log.warn(`Unknown device class: ${this.device.deviceName} (${deviceType}) - device may not function properly`);
    }
    
    // Early check for Core200S and similar devices without air quality
    // This ensures we catch cached services even before setupService() is called
    if (!this.hasFeature('air_quality')) {
      const cachedAirQualityService = this.accessory.getService(this.platform.Service.AirQualitySensor);
      if (cachedAirQualityService) {
        this.platform.log.debug(`${this.device.deviceName} (${deviceType}): Found cached air quality service on device without AQ sensor - will be removed during setup`);
      }
    }
  }

  /**
   * Feature detection system
   */
  private hasFeature(feature: string): boolean {
    const extendedDevice = this.device as unknown as ExtendedVeSyncAirPurifier;
    
    // **ENHANCED DEBUGGING**: Log detailed device type information
    this.platform.log.info(`${this.device.deviceName}: FEATURE CHECK - hasFeature('${feature}') for device type: "${this.device.deviceType}"`);
    
    // Use device's native hasFeature method if available
    if (typeof extendedDevice.hasFeature === 'function') {
      const result = extendedDevice.hasFeature(feature);
      this.platform.log.info(`${this.device.deviceName} (${this.device.deviceType}): Native hasFeature('${feature}') returned: ${result} (using tsvesync library configuration)`);
      
      // For air_quality, trust the library's configuration completely
      // The library was updated in v1.0.107 to correctly exclude air_quality for devices without sensors
      if (feature === 'air_quality') {
        this.platform.log.info(`${this.device.deviceName} (${this.device.deviceType}): Air quality feature decision based on tsvesync library config: ${result}`);
        
        // Add extra debugging for Core200S devices
        if (this.device.deviceType.includes('Core200S') || this.device.deviceType.includes('LAP-C20')) {
          this.platform.log.info(`${this.device.deviceName} (${this.device.deviceType}): Core200S variant detected - should NOT have air quality! hasFeature returned: ${result}`);
        }
        
        return result;
      }
      
      // **CRITICAL FIX**: Enhanced filter_life detection with explicit Core300S support
      if (feature === 'filter_life') {
        const deviceType = this.device.deviceType;
        this.platform.log.info(`${this.device.deviceName} (${deviceType}): Native hasFeature('filter_life') returned: ${result}`);
        
        // **EXPLICIT Core300S CHECK**: Make sure Core300S is always recognized
        if (deviceType === 'Core300S' || deviceType.includes('Core300S')) {
          this.platform.log.info(`${this.device.deviceName}: Core300S detected - SHOULD support filter_life! Native result: ${result}`);
          if (!result) {
            this.platform.log.warn(`${this.device.deviceName}: Core300S should support filter_life but native hasFeature returned false. OVERRIDING to true.`);
            return true;
          }
        }
        
        if (!result) {
          // Check if this looks like a device type that should support filter_life
          if (deviceType.includes('Core') || 
              deviceType.includes('300S') ||  // Add explicit check for 300S
              deviceType.includes('200S') ||  // Add explicit check for 200S
              deviceType.includes('400S') ||  // Add explicit check for 400S
              deviceType.includes('600S') ||  // Add explicit check for 600S
              deviceType.includes('LAP-') || 
              deviceType.includes('LV-') || 
              deviceType.includes('Vital')) {
            this.platform.log.warn(`${this.device.deviceName}: Device type ${deviceType} should support filter_life but native hasFeature returned false. Overriding to true.`);
            return true;
          }
        }
      }
      
      // **EXPLICIT Core300S auto_mode CHECK**: Make sure Core300S auto mode is recognized
      if (feature === 'auto_mode') {
        const deviceType = this.device.deviceType;
        this.platform.log.info(`${this.device.deviceName} (${deviceType}): Native hasFeature('auto_mode') returned: ${result}`);
        
        if (deviceType === 'Core300S' || deviceType.includes('Core300S')) {
          this.platform.log.info(`${this.device.deviceName}: Core300S detected - SHOULD support auto_mode! Native result: ${result}`);
          if (!result) {
            this.platform.log.warn(`${this.device.deviceName}: Core300S should support auto_mode but native hasFeature returned false. OVERRIDING to true.`);
            return true;
          }
        }
      }
      
      return result;
    }
    
    // Fallback feature detection based on device type
    switch (feature) {
      case 'air_quality':
        // Respect the tsvesync library's feature configuration for air quality
        // Only devices with actual hardware sensors should have air quality features
        // The library already correctly configures which devices support air quality
        this.platform.log.debug(`${this.device.deviceName}: Fallback hasFeature('${feature}') returned: false (device does not have air quality sensor per tsvesync config)`);
        return false;
        
      case 'child_lock':
        // Explicitly disable child lock features
        this.platform.log.debug(`${this.device.deviceName}: Fallback hasFeature('${feature}') returned: false (explicitly disabled)`);
        return false;
        
      case 'display':
        // Explicitly disable display control features
        this.platform.log.debug(`${this.device.deviceName}: Fallback hasFeature('${feature}') returned: false (explicitly disabled)`);
        return false;
        
      case 'filter_life':
        // For air purifiers, enable filter life features based on device type patterns
        const deviceType = this.device.deviceType;
        
        // Check device type patterns that should support filter_life
        const supportsFilterByType = deviceType.includes('Core') || 
                                    deviceType.includes('300S') ||  // Explicit check for 300S
                                    deviceType.includes('200S') ||  // Explicit check for 200S
                                    deviceType.includes('400S') ||  // Explicit check for 400S
                                    deviceType.includes('600S') ||  // Explicit check for 600S
                                    deviceType.includes('LAP-') || 
                                    deviceType.includes('LV-') || 
                                    deviceType.includes('Vital');
        
        if (supportsFilterByType) {
          this.platform.log.debug(`${this.device.deviceName}: Device type ${deviceType} supports filter_life by pattern matching`);
          return true;
        }
        
        // Fallback: Check if filter_life data exists in any format
        const filterDevice = this.device as unknown as ExtendedVeSyncAirPurifier;
        const filterLife = filterDevice.details?.filter_life;
        const hasFilterLife = !!(filterLife !== undefined && 
                 (typeof filterLife === 'number' || 
                  (typeof filterLife === 'object' && filterLife !== null && 'percent' in filterLife)));
        
        // Also check for filterLife property from VeSyncFan base class
        const hasFilterLifeProperty = typeof extendedDevice.filterLife === 'number';
        const result = hasFilterLife || hasFilterLifeProperty;
        
        this.platform.log.debug(`${this.device.deviceName}: Fallback hasFeature('${feature}') - details.filter_life: ${JSON.stringify(filterLife)}, device.filterLife: ${extendedDevice.filterLife}, result: ${result}`);
        return result;
        
      case 'fan_speed':
        this.platform.log.debug(`${this.device.deviceName}: Fallback hasFeature('${feature}') returned: true`);
        return true;
        
      default:
        this.platform.log.debug(`${this.device.deviceName}: Fallback hasFeature('${feature}') returned: false (unknown feature)`);
        return false;
    }
  }
  
  /**
   * Check if a feature is supported in the current device mode
   */
  private isFeatureSupportedInCurrentMode(feature: string): boolean {
    const extendedDevice = this.device as unknown as ExtendedVeSyncAirPurifier;
    
    // Use device's native method if available
    if (typeof extendedDevice.isFeatureSupportedInCurrentMode === 'function') {
      return extendedDevice.isFeatureSupportedInCurrentMode(feature);
    }
    
    // Fallback logic
    const mode = extendedDevice.mode || 'manual';
    
    // Air131 only supports fan speed in manual mode
    if (feature === 'fan_speed' && this.isAir131Device && mode !== 'manual') {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get the maximum fan speed for the device
   */
  private getMaxFanSpeed(): number {
    const extendedDevice = this.device as unknown as ExtendedVeSyncAirPurifier;
    
    // Use device's native method if available
    if (typeof extendedDevice.getMaxFanSpeed === 'function') {
      const maxSpeed = extendedDevice.getMaxFanSpeed();
      if (typeof maxSpeed === 'number' && maxSpeed > 0) {
        return maxSpeed;
      }
    }
    
    // Use maxSpeed property if available
    if (typeof extendedDevice.maxSpeed === 'number' && extendedDevice.maxSpeed > 0) {
      return extendedDevice.maxSpeed;
    }
    
    // Fallback logic based on device type
    if (this.isAir131Device) {
      return 3; // LV-series devices have 3 speed levels
    } else if (this.isAirBypassDevice) {
      return 3; // All Core series have 3 speed levels
    } else if (this.isAirBaseV2Device) {
      if (this.device.deviceType.includes('LAP-EL551S')) {
        return 3; // LAP-EL551S has 3 speed levels
      } else {
        return 4; // LAP-V series have 4 speed levels
      }
    }
    
    // Default to 3 for unknown devices
    return 3;
  }

  /**
   * Calculate the appropriate step size for discrete speed levels
   */
  private calculateRotationSpeedStep(): number {
    const maxSpeed = this.getMaxFanSpeed();
    
    // For devices with discrete speed levels, set appropriate step size
    if (maxSpeed === 3) {
      return 33.33; // Creates exact positions: 0%, 33.33%, 66.67%, 100%
    } else if (maxSpeed === 4) {
      return 25; // Creates exact positions: 0%, 25%, 50%, 75%, 100%
    }
    
    // Default to continuous slider for other devices
    return 1;
  }

  /**
   * Convert device speed to percentage
   */
  private speedToPercentage(speed: number): number {
    const maxSpeed = this.getMaxFanSpeed();
    
    // Ensure we have valid numbers
    if (maxSpeed <= 0 || typeof speed !== 'number' || speed <= 0) {
      return 0;
    }
    
    // For devices with 3 speed levels
    if (maxSpeed === 3) {
      switch (speed) {
        case 1: return 33.33;  // Low -> 33.33%
        case 2: return 66.67;  // Medium -> 66.67%
        case 3: return 100; // High -> 100%
        default: return 0;
      }
    }
    // For devices with 4 speed levels
    else if (maxSpeed === 4) {
      switch (speed) {
        case 1: return 25;  // Low -> 25%
        case 2: return 50;  // Medium-Low -> 50%
        case 3: return 75;  // Medium-High -> 75%
        case 4: return 100; // High -> 100%
        default: return 0;
      }
    }
    
    // Default calculation
    return Math.min(100, Math.max(0, Math.round((speed / maxSpeed) * 100)));
  }
  
  /**
   * Updates the rotation speed characteristic for Air131 devices immediately after turning on.
   * This ensures the UI shows the restored speed instead of 0, providing better user experience.
   * 
   * Air131 devices remember their last speed setting when turned back on, but the characteristic
   * update can be delayed. This method proactively updates the HomeKit characteristic to reflect
   * the actual device speed.
   * 
   * @private
   * @returns {Promise<void>} Promise that resolves when the update is complete
   * @throws Will log errors through handleDeviceError but won't propagate them to avoid
   *         disrupting the main turn-on operation
   */
  private async updateAir131RotationSpeedAfterTurnOn(): Promise<void> {
    try {
      // Validate device and service state
      if (!this.device || !this.service) {
        this.platform.log.warn(`${this.device?.deviceName || 'Unknown'}: Cannot update rotation speed - device or service not available`);
        return;
      }

      // Check if device has a valid speed value
      if (typeof this.device.speed !== 'number' || this.device.speed <= 0) {
        this.platform.log.debug(`${this.device.deviceName}: No valid speed to restore (speed: ${this.device.speed})`);
        return;
      }

      // Convert device speed to percentage with validation
      const percentage = this.speedToPercentage(this.device.speed);
      
      if (typeof percentage !== 'number' || isNaN(percentage) || percentage < 0 || percentage > 100) {
        this.platform.log.warn(`${this.device.deviceName}: Invalid percentage calculated (${percentage}) from speed ${this.device.speed}`);
        return;
      }

      // Update the HomeKit characteristic
      this.service.updateCharacteristic(
        this.platform.Characteristic.RotationSpeed,
        percentage
      );

      this.platform.log.debug(
        `${this.device.deviceName}: Updated rotation speed to ${percentage}% (speed: ${this.device.speed}) after turning on`
      );
    } catch (error) {
      this.handleDeviceError('update Air131 rotation speed after turn on', error);
    }
  }

  /**
   * Convert percentage to device speed
   */
  private percentageToSpeed(percentage: number): number {
    const maxSpeed = this.getMaxFanSpeed();
    
    // Ensure we have valid numbers
    if (maxSpeed <= 0 || typeof percentage !== 'number') {
      return 1; // Default to lowest speed
    }
    
    // Ensure percentage is between 0 and 100
    percentage = Math.min(100, Math.max(0, percentage));
    
    // For devices with 3 speed levels
    if (maxSpeed === 3) {
      if (percentage <= 33.34) {
        return 1; // Low
      } else if (percentage <= 66.67) {
        return 2; // Medium
      } else {
        return 3; // High
      }
    }
    // For devices with 4 speed levels
    else if (maxSpeed === 4) {
      if (percentage <= 25) {
        return 1; // Low
      } else if (percentage <= 50) {
        return 2; // Medium-Low
      } else if (percentage <= 75) {
        return 3; // Medium-High
      } else {
        return 4; // High
      }
    }
    
    // Default calculation
    return Math.max(1, Math.min(Math.round((percentage / 100) * maxSpeed), maxSpeed));
  }

  /**
   * Set up the air purifier service
   */
  protected setupService(): void {
    // Get or create the air purifier service
    this.service = this.accessory.getService(this.platform.Service.AirPurifier) ||
      this.accessory.addService(this.platform.Service.AirPurifier);
    
    // CRITICAL: Mark the AirPurifier service as primary
    // This ensures HomeKit shows the controls instead of the info page
    // when there are multiple services (e.g., with AirQualitySensor)
    this.service.setPrimaryService(true);
    this.platform.log.info(`${this.device.deviceName}: Marked AirPurifier service as PRIMARY service`);

    // **CRITICAL FIX**: Add optional characteristics FIRST before setting up handlers
    // This ensures they persist through service configuration
    this.platform.log.debug(`${this.device.deviceName} (${this.device.deviceType}): Pre-configuring optional characteristics`);
    
    // Always set up filter characteristics (like reference plugin does)
    // The reference implementation ALWAYS registers these for ALL air purifiers
    // This ensures they appear in HomeKit even if the device doesn't report having them initially
    this.platform.log.info(`${this.device.deviceName}: Setting up filter characteristics for all air purifiers`);
    
    // Use getCharacteristic which auto-adds if missing (like reference plugin)
    this.service.getCharacteristic(this.platform.Characteristic.FilterChangeIndication)
      .onGet(this.getFilterChangeIndication.bind(this));
    
    this.service.getCharacteristic(this.platform.Characteristic.FilterLifeLevel)
      .onGet(this.getFilterLifeLevel.bind(this))
      .setProps({
        minValue: 0,
        maxValue: 100,
        minStep: 1
      });
    
    this.platform.log.info(`${this.device.deviceName}: Filter characteristics registered (always present for air purifiers)`)

    // Set up required characteristics
    this.setupCharacteristic(
      this.platform.Characteristic.Active,
      this.getActive.bind(this),
      this.setActive.bind(this)
    );

    // Set up target state characteristic for mode mapping
    const targetStateChar = this.service.getCharacteristic(this.platform.Characteristic.TargetAirPurifierState);
    
    // Check if device supports auto mode
    const hasAutoMode = this.hasFeature('auto_mode');
    this.platform.log.info(`${this.device.deviceName} (${this.device.deviceType}): Auto mode support check - hasFeature('auto_mode') = ${hasAutoMode}`);
    
    // For Core200S, only allow manual mode
    if (this.device.deviceType.includes('Core200S')) {
      targetStateChar.setProps({
        validValues: [0] // MANUAL only
      });
      this.platform.log.info(`${this.device.deviceName} (Core200S): Configured for MANUAL mode only - no auto mode support`);
    } else if (this.device.deviceType.includes('Core300S')) {
      // Core300S explicitly supports both modes
      targetStateChar.setProps({
        validValues: [0, 1] // MANUAL and AUTO
      });
      this.platform.log.info(`${this.device.deviceName} (Core300S): ✅ Configured for BOTH AUTO and MANUAL modes - auto mode ENABLED`);
      this.platform.log.info(`${this.device.deviceName} (Core300S): Target state characteristic should now show mode switcher in HomeKit`);
    } else if (hasAutoMode) {
      // Other devices with auto_mode feature
      targetStateChar.setProps({
        validValues: [0, 1] // MANUAL and AUTO
      });
      this.platform.log.info(`${this.device.deviceName} (${this.device.deviceType}): Configured for AUTO and MANUAL modes based on feature detection`);
    } else {
      // Devices without auto mode
      targetStateChar.setProps({
        validValues: [0] // MANUAL only
      });
      this.platform.log.info(`${this.device.deviceName} (${this.device.deviceType}): Configured for MANUAL mode only - no auto mode feature`);
    }
    
    // Set up the characteristic handlers for all devices
    this.setupCharacteristic(
      this.platform.Characteristic.TargetAirPurifierState,
      this.getTargetState.bind(this),
      this.setTargetState.bind(this)
    );

    // Set up current state
    this.setupCharacteristic(
      this.platform.Characteristic.CurrentAirPurifierState,
      this.getCurrentState.bind(this)
    );

    // Set up rotation speed characteristic using the simplified approach (like reference plugin)
    const minStep = this.calculateRotationSpeedStep();
    
    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .onGet(this.getRotationSpeed.bind(this))
      .onSet(this.setRotationSpeed.bind(this))
      .setProps({
        minValue: 0,
        maxValue: 100,
        minStep: minStep
      });
    
    this.platform.log.debug(`${this.device.deviceName}: Configured RotationSpeed with minStep: ${minStep}`);

    // Add Name characteristic
    this.setupCharacteristic(
      this.platform.Characteristic.Name,
      async () => this.device.deviceName
    );
    
    // Set up air quality sensor service if supported
    this.platform.log.debug(`${this.device.deviceName} (${this.device.deviceType}): Checking air_quality feature...`);
    
    // Always check for existing air quality service first
    const existingAirQualityService = this.accessory.getService(this.platform.Service.AirQualitySensor);
    
    // Check if device supports air quality
    const hasAirQuality = this.hasFeature('air_quality');
    this.platform.log.debug(`${this.device.deviceName} (${this.device.deviceType}): hasFeature('air_quality') returned ${hasAirQuality}`);
    
    if (hasAirQuality) {
      this.platform.log.debug(`${this.device.deviceName} (${this.device.deviceType}): Device has air quality sensor - setting up air quality service`);
      this.setupAirQualityService();
    } else {
      this.platform.log.debug(`${this.device.deviceName}: Device does not have air quality sensor - removing any air quality service`);
      
      // Remove any existing air quality service and clear the reference
      if (existingAirQualityService) {
        this.platform.log.debug(`${this.device.deviceName}: Found existing air quality service on device without AQ sensor - removing it`);
        this.accessory.removeService(existingAirQualityService);
        // Clear the reference to ensure it's not used elsewhere
        this.airQualityService = undefined;
      }
      // Ensure the reference is cleared even if no service was found
      this.airQualityService = undefined;
    }
    
    // Clean up any existing FilterMaintenance service (from old implementation)
    const existingFilterService = this.accessory.getService(this.platform.Service.FilterMaintenance);
    if (existingFilterService) {
      this.platform.log.info(`${this.device.deviceName}: Removing old FilterMaintenance service (migrating to AirPurifier service)`);
      this.accessory.removeService(existingFilterService);
    }
    
    // Check and log important features for debugging
    const autoModeSupported = this.hasFeature('auto_mode');
    this.platform.log.info(`${this.device.deviceName} (${this.device.deviceType}): Features detected:`);
    this.platform.log.info(`  - auto_mode: ${autoModeSupported} (controls mode switch)`);
    this.platform.log.info(`  - filter_life: ${this.hasFeature('filter_life')} (controls filter display)`);
  }
  
  /**
   * Set up the air quality sensor service
   */
  private setupAirQualityService(): void {
    this.platform.log.debug(`Setting up air quality service for ${this.device.deviceName}`);
    
    // Get or create the air quality sensor service
    this.airQualityService = this.accessory.getService(this.platform.Service.AirQualitySensor) ||
      this.accessory.addService(this.platform.Service.AirQualitySensor);
    
    // Mark this as a linked service (not primary)
    // The AirPurifier service is the primary service
    if (this.service) {
      this.airQualityService.addLinkedService(this.service);
      this.platform.log.info(`${this.device.deviceName}: Linked AirQualitySensor service to PRIMARY AirPurifier service`);
    }

    // Set up required air quality characteristic
    this.setupCharacteristic(
      this.platform.Characteristic.AirQuality,
      this.getAirQuality.bind(this),
      undefined,
      {},
      this.airQualityService
    );

    // Set up optional PM2.5 density characteristic
    this.setupCharacteristic(
      this.platform.Characteristic.PM2_5Density,
      this.getPM25Density.bind(this),
      undefined,
      {
        minValue: 0,
        maxValue: 1000,
        minStep: 1
      },
      this.airQualityService
    );

    // Set up optional PM10 density characteristic (if available)
    const extendedDevice = this.device as unknown as ExtendedVeSyncAirPurifier;
    if (extendedDevice.details?.pm10 !== undefined) {
      this.setupCharacteristic(
        this.platform.Characteristic.PM10Density,
        this.getPM10Density.bind(this),
        undefined,
        {
          minValue: 0,
          maxValue: 1000,
          minStep: 1
        },
        this.airQualityService
      );
    }
  }


  /**
   * Get air quality level for HomeKit
   */
  private async getAirQuality(): Promise<CharacteristicValue> {
    const extendedDevice = this.device as unknown as ExtendedVeSyncAirPurifier;
    
    // Get PM2.5 value from device
    const pm25 = extendedDevice.details?.air_quality_value ?? 
                 extendedDevice.details?.pm25 ?? 0;
    
    // Convert to HomeKit air quality scale using existing method
    return this.convertAirQualityToHomeKit(pm25);
  }

  /**
   * Get PM2.5 density
   */
  private async getPM25Density(): Promise<CharacteristicValue> {
    const extendedDevice = this.device as unknown as ExtendedVeSyncAirPurifier;
    
    const pm25 = extendedDevice.details?.air_quality_value ?? 
                 extendedDevice.details?.pm25 ?? 0;
    
    // Ensure value is within HomeKit limits (0-1000)
    return Math.min(1000, Math.max(0, pm25));
  }

  /**
   * Get PM10 density
   */
  private async getPM10Density(): Promise<CharacteristicValue> {
    const extendedDevice = this.device as unknown as ExtendedVeSyncAirPurifier;
    
    const pm10 = extendedDevice.details?.pm10 ?? 0;
    
    // Ensure value is within HomeKit limits (0-1000)
    return Math.min(1000, Math.max(0, pm10));
  }

  /**
   * Extract filter life from device data in a centralized way
   */
  private extractFilterLife(): number {
    const extendedDevice = this.device as unknown as ExtendedVeSyncAirPurifier;
    
    // Priority 1: Use device's normalized filterLife property
    if (typeof extendedDevice.filterLife === 'number' && !isNaN(extendedDevice.filterLife)) {
      return extendedDevice.filterLife;
    }
    
    // Priority 2: Check details.filter_life
    const filterLifeData = extendedDevice.details?.filter_life;
    
    // Handle number format
    if (typeof filterLifeData === 'number' && !isNaN(filterLifeData)) {
      return filterLifeData;
    }
    
    // Handle object format { percent: number }
    if (typeof filterLifeData === 'object' && filterLifeData !== null && 'percent' in filterLifeData) {
      const percent = (filterLifeData as { percent: number }).percent;
      return (typeof percent === 'number' && !isNaN(percent)) ? percent : 100;
    }
    
    // Default to 100% (filter OK)
    return 100;
  }

  /**
   * Get filter change indication
   */
  private async getFilterChangeIndication(): Promise<CharacteristicValue> {
    const filterLife = this.extractFilterLife();
    
    // Indicate filter change needed when life is below 10%
    return filterLife < 10 ? 1 : 0; // 0=FILTER_OK, 1=CHANGE_FILTER
  }

  /**
   * Get filter life level
   */
  private async getFilterLifeLevel(): Promise<CharacteristicValue> {
    const filterLife = this.extractFilterLife();
    
    // Ensure value is within HomeKit limits (0-100) and round to nearest integer
    return Math.round(Math.min(100, Math.max(0, filterLife)));
  }
  
  /**
   * Get current state (INACTIVE = 0, IDLE = 1, PURIFYING_AIR = 2)
   */
  private async getCurrentState(): Promise<CharacteristicValue> {
    return this.device.deviceStatus === 'on' ? 2 : 0;
  }

  /**
   * Get device capabilities
   */
  protected getDeviceCapabilities(): DeviceCapabilities {
    return {
      hasSpeed: true,
      hasAirQuality: this.hasFeature('air_quality'),
      hasChildLock: false, // Explicitly disable child lock
      hasBrightness: false,
      hasColorTemp: false,
      hasColor: false,
      hasHumidity: false,
      hasWaterLevel: false,
      hasSwingMode: false,
    };
  }

  /**
   * Update device states based on the latest details
   */
  protected async updateDeviceSpecificStates(details: any): Promise<void> {
    // Update power state
    const isOn = details.enabled || details.deviceStatus === 'on';
    this.service.updateCharacteristic(this.platform.Characteristic.Active, isOn ? 1 : 0);
    
    // Update current state (INACTIVE = 0, IDLE = 1, PURIFYING_AIR = 2)
    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentAirPurifierState,
      isOn ? 2 : 0
    );

    // Get the extended device to access mode information
    const extendedDevice = this.device as ExtendedVeSyncAirPurifier;
    
    // Update target state (MANUAL = 0, AUTO = 1)
    // Special handling for Core200S
    let targetState = 0; // Default to MANUAL
    
    if (this.device.deviceType.includes('Core200S')) {
      // Core200S always reports MANUAL mode
      targetState = 0; // MANUAL
    } else if (extendedDevice.mode) {
      // For other devices, including Core300S, use the reported mode
      targetState = extendedDevice.mode === 'auto' ? 1 : 0;
    }
    
    this.service.updateCharacteristic(
      this.platform.Characteristic.TargetAirPurifierState,
      targetState
    );

    // Update rotation speed
    if (isOn && details.speed !== undefined && details.speed !== null) {
      // Check if we should skip this update
      if (this.skipNextUpdate) {
        this.platform.log.debug(`Skipping update for ${this.device.deviceName} as requested`);
        this.skipNextUpdate = false;
        return;
      }
      
      // If we've recently set the speed, use the percentage we calculated
      if (this.lastSetSpeed > 0 && this.lastSetPercentage > 0) {
        this.platform.log.debug(`Using last set percentage for ${this.device.deviceName}: speed=${this.lastSetSpeed}, percentage=${this.lastSetPercentage}`);
        
        // Only update if the device speed matches what we set
        if (this.lastSetSpeed === details.speed) {
          this.platform.log.debug(`Device speed matches last set speed: ${details.speed}`);
          
          // Force update the characteristic to our last set percentage
          this.service.updateCharacteristic(
            this.platform.Characteristic.RotationSpeed,
            this.lastSetPercentage
          );
        } else {
          // Device speed doesn't match what we set, so convert from device speed
          const percentage = this.speedToPercentage(details.speed);
          this.platform.log.debug(`Device speed doesn't match last set speed. Device: ${details.speed}, Last set: ${this.lastSetSpeed}, Calculated percentage: ${percentage}`);
          
          // Update our tracking variables
          this.lastSetSpeed = details.speed;
          this.lastSetPercentage = percentage;
          
          // Update the characteristic
          this.service.updateCharacteristic(
            this.platform.Characteristic.RotationSpeed,
            percentage
          );
        }
      } else {
        // No recent set speed, so convert from device speed
        const percentage = this.speedToPercentage(details.speed);
        this.platform.log.debug(`No recent set speed for ${this.device.deviceName}. Device speed: ${details.speed}, Calculated percentage: ${percentage}`);
        
        // Update the characteristic
        this.service.updateCharacteristic(
          this.platform.Characteristic.RotationSpeed,
          percentage
        );
      }
    } else {
      this.service.updateCharacteristic(
        this.platform.Characteristic.RotationSpeed,
        0
      );
      // Reset tracking variables when device is off
      this.lastSetSpeed = 0;
      this.lastSetPercentage = 0;
    }
    
    // Update air quality characteristics if service exists AND device supports air quality
    if (this.hasFeature('air_quality')) {
      // Device supports air quality - update characteristics if service exists
      if (this.airQualityService) {
        const extendedDevice = this.device as unknown as ExtendedVeSyncAirPurifier;
        
        // Update air quality level
        const pm25 = extendedDevice.details?.air_quality_value ?? 
                     extendedDevice.details?.pm25 ?? 0;
        const airQualityLevel = this.convertAirQualityToHomeKit(pm25);
        
        this.airQualityService.updateCharacteristic(
          this.platform.Characteristic.AirQuality,
          airQualityLevel
        );
        
        // Update PM2.5 density
        this.airQualityService.updateCharacteristic(
          this.platform.Characteristic.PM2_5Density,
          Math.min(1000, Math.max(0, pm25))
        );
        
        // Update PM10 density if available
        if (extendedDevice.details?.pm10 !== undefined) {
          this.airQualityService.updateCharacteristic(
            this.platform.Characteristic.PM10Density,
            Math.min(1000, Math.max(0, extendedDevice.details.pm10))
          );
        }
      }
    } else {
      // Device does not support air quality - remove any existing service
      // Check both our reference and the actual accessory for any air quality service
      const existingService = this.airQualityService || this.accessory.getService(this.platform.Service.AirQualitySensor);
      if (existingService) {
        this.platform.log.debug(`${this.device.deviceName}: Device does not support air quality but service exists - removing it now`);
        this.accessory.removeService(existingService);
        this.airQualityService = undefined;
      }
    }
    
    // Update filter characteristics on main service if supported
    if (this.hasFeature('filter_life')) {
      const filterLife = this.extractFilterLife();
      
      // Update filter change indication on main service
      this.service?.updateCharacteristic(
        this.platform.Characteristic.FilterChangeIndication,
        filterLife < 10 ? 1 : 0
      );
      
      // Update filter life level on main service
      this.service?.updateCharacteristic(
        this.platform.Characteristic.FilterLifeLevel,
        Math.min(100, Math.max(0, filterLife))
      );
    }
  }

  /**
   * Get target state (MANUAL = 0, AUTO = 1)
   */
  private async getTargetState(): Promise<CharacteristicValue> {
    // For Core200S, always return MANUAL
    if (this.device.deviceType.includes('Core200S')) {
      return 0; // MANUAL
    }
    
    const extendedDevice = this.device as ExtendedVeSyncAirPurifier;
    const targetState = extendedDevice.mode === 'auto' ? 1 : 0;
    
    return targetState;
  }

  /**
   * Set target state (AUTO = 0, MANUAL = 1)
   */
  private async setTargetState(value: CharacteristicValue): Promise<void> {
    try {
      const targetState = value as number;
      const extendedDevice = this.device as ExtendedVeSyncAirPurifier;
      
      // For Core200S, don't allow mode changes
      if (this.device.deviceType.includes('Core200S')) {
        this.platform.log.warn(`Mode changes not supported on ${this.device.deviceName}, only fan speed control is available`);
        // Update the characteristic back to MANUAL (0)
        this.service.updateCharacteristic(this.platform.Characteristic.TargetAirPurifierState, 0);
        return;
      }
      
      // For all other devices, including Core300S, normal mode handling
      const mode = targetState === 1 ? 'auto' : 'manual';
      this.platform.log.debug(`Setting mode to ${mode} for device: ${this.device.deviceName}`);
      
      let success = false;
      
      // Use the appropriate method to set the mode
      if (targetState === 1 && typeof extendedDevice.autoMode === 'function') {
        success = await extendedDevice.autoMode();
      } else if (targetState === 0 && typeof extendedDevice.manualMode === 'function') {
        success = await extendedDevice.manualMode();
      } else if (typeof extendedDevice.setMode === 'function') {
        success = await extendedDevice.setMode(mode as 'auto' | 'manual' | 'sleep');
      } else if (typeof this.device.setMode === 'function') {
        success = await this.device.setMode(mode);
      } else {
        throw new Error('Device API does not support mode setting operations');
      }
      
      if (!success) {
        throw new Error(`Failed to set mode to ${mode}`);
      }
      
      // Update device state and characteristics
      await this.updateDeviceSpecificStates(this.device);
    } catch (error) {
      this.handleDeviceError('set target state', error);
    }
  }

  /**
   * Get rotation speed
   */
  private async getRotationSpeed(): Promise<CharacteristicValue> {
    // If device is off or speed is not defined, return 0
    if (this.device.deviceStatus !== 'on' || 
        this.device.speed === undefined || 
        this.device.speed === null) {
      return 0;
    }
    
    // If we have a last set percentage, use that instead of calculating from device speed
    if (this.lastSetPercentage > 0 && this.lastSetSpeed === this.device.speed) {
      this.platform.log.debug(`getRotationSpeed returning last set percentage: ${this.lastSetPercentage} for speed: ${this.device.speed}`);
      return this.lastSetPercentage;
    }
    
    // Convert device speed to percentage using our consistent conversion method
    const percentage = this.speedToPercentage(this.device.speed);
    this.platform.log.debug(`getRotationSpeed calculated percentage: ${percentage} for speed: ${this.device.speed}`);
    
    return percentage;
  }

  /**
   * Set rotation speed
   */
  private async setRotationSpeed(value: CharacteristicValue): Promise<void> {
    try {
      // Ensure value is a valid number
      let percentage = value as number;
      if (isNaN(percentage) || percentage === null || percentage === undefined) {
        this.platform.log.warn(`Invalid rotation speed value: ${value} for device: ${this.device.deviceName}`);
        return;
      }
      
      // Ensure percentage is between 0 and 100
      percentage = Math.min(100, Math.max(0, percentage));
      
      this.platform.log.debug(`Setting rotation speed to ${percentage}% for device: ${this.device.deviceName}`);
      
      if (percentage === 0) {
        // Turn off the device instead of setting speed to 0
        this.platform.log.debug(`Turning off device ${this.device.deviceName} due to 0% rotation speed`);
        const success = await this.device.turnOff();
        if (!success) {
          throw new Error('Failed to turn off device');
        }
        // Reset tracking variables when turning off
        this.lastSetSpeed = 0;
        this.lastSetPercentage = 0;
        return;
      }
      
      const extendedDevice = this.device as ExtendedVeSyncAirPurifier;
      
      // Check if device is off and turn it on first
      if (this.device.deviceStatus !== 'on') {
        this.platform.log.debug(`Device ${this.device.deviceName} is off, turning on before setting speed`);
        const turnOnSuccess = await this.device.turnOn();
        if (!turnOnSuccess) {
          // For LV-PUR131S, this might return false if already on, so check actual state
          if (this.isAir131Device && this.device.deviceStatus === 'on') {
            this.platform.log.debug(`${this.device.deviceName}: Device is now on`);
          } else {
            throw new Error('Failed to turn on device');
          }
        }
        // Wait a bit for the device to turn on
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update device state to get fresh mode information
        await this.updateDeviceSpecificStates(this.device);
      }
      
      // Check if fan speed control is supported in current mode
      if (!this.isFeatureSupportedInCurrentMode('fan_speed')) {
        this.platform.log.warn(`Fan speed control not supported in ${extendedDevice.mode} mode for device: ${this.device.deviceName}`);
        
        // For Air131 devices, switch to manual mode first
        if (this.isAir131Device && extendedDevice.mode !== 'manual') {
          this.platform.log.debug(`Setting device to manual mode before changing fan speed: ${this.device.deviceName}`);
          
          // Use the appropriate method to set manual mode
          if (typeof extendedDevice.manualMode === 'function') {
            const modeSuccess = await extendedDevice.manualMode();
            this.platform.log.debug(`Set manual mode result: ${modeSuccess ? 'success' : 'failed'}`);
            // Wait for mode change to take effect
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else if (typeof extendedDevice.setMode === 'function') {
            const modeSuccess = await extendedDevice.setMode('manual');
            this.platform.log.debug(`Set manual mode result: ${modeSuccess ? 'success' : 'failed'}`);
            // Wait for mode change to take effect
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // Convert percentage to device speed using our consistent conversion method
      const speed = this.percentageToSpeed(percentage);
      
      // Final validation to ensure speed is a valid number
      if (isNaN(speed) || speed === null || speed === undefined) {
        this.platform.log.warn(`Calculated invalid speed: ${speed} from percentage: ${percentage} for device: ${this.device.deviceName}`);
        return;
      }
      
      this.platform.log.debug(`Setting fan speed to ${speed} for device: ${this.device.deviceName}`);
      
      // Store the values we're setting before making the API call
      this.lastSetSpeed = speed;
      this.lastSetPercentage = percentage;
      
      // Set the flag to skip the next update
      this.skipNextUpdate = true;
      
      // Immediately update the characteristic to show the correct percentage
      // This ensures the slider shows the value we set, not what the device reports
      this.service.updateCharacteristic(
        this.platform.Characteristic.RotationSpeed,
        percentage
      );
      
      const success = await this.device.changeFanSpeed(speed);
      
      if (!success) {
        // If the API call failed, reset our tracking variables
        this.lastSetSpeed = 0;
        this.lastSetPercentage = 0;
        throw new Error(`Failed to set speed to ${speed}`);
      }
      
      this.platform.log.debug(`Successfully set fan speed to ${speed} (${percentage}%) for device: ${this.device.deviceName}`);
      
      // Update device state and characteristics
      // Skip this to avoid overriding our UI update
      // await this.updateDeviceSpecificStates(this.device);
    } catch (error) {
      this.handleDeviceError('set rotation speed', error);
    }
  }

  private async getActive(): Promise<CharacteristicValue> {
    return this.device.deviceStatus === 'on' ? 1 : 0;
  }

  private async setActive(value: CharacteristicValue): Promise<void> {
    try {
      const isOn = value as number === 1;
      this.platform.log.debug(`Setting device ${this.device.deviceName} to ${isOn ? 'on' : 'off'}`);
      
      const success = isOn ? await this.device.turnOn() : await this.device.turnOff();
      
      if (!success) {
        // For LV-PUR131S, success=false might mean device is already in desired state
        if (this.isAir131Device) {
          this.platform.log.debug(`${this.device.deviceName}: turn${isOn ? 'On' : 'Off'}() returned false - device may already be ${isOn ? 'on' : 'off'}`);
          // Check actual device state
          const actualState = this.device.deviceStatus === 'on';
          if (actualState === isOn) {
            this.platform.log.debug(`${this.device.deviceName}: Device is already in desired state (${isOn ? 'on' : 'off'})`);
            return; // Don't throw error if already in desired state
          }
        }
        throw new Error(`Failed to turn ${isOn ? 'on' : 'off'} device`);
      }
      
      // Reset tracking variables when turning off
      if (!isOn) {
        this.lastSetSpeed = 0;
        this.lastSetPercentage = 0;
      } else if (isOn && this.isAir131Device) {
        // For Air131 devices, immediately update rotation speed characteristic
        // to show the restored speed instead of 0
        await this.updateAir131RotationSpeedAfterTurnOn();
      }
      
      // Update device state and characteristics
      await this.updateDeviceSpecificStates(this.device);
      await this.persistDeviceState('deviceStatus', isOn ? 'on' : 'off');
    } catch (error) {
      this.handleDeviceError('set active state', error);
    }
  }
}
