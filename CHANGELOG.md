# Changelog

## [1.0.30] - 2025-01-04

### Fixed
- Fixed issue where login token was not being refreshed

## [1.0.27] - 2025-01-02

### Fixed
- Fixed invalid speed setting issues for air purifiers, fans, and humidifiers
  - Speed 0 now properly turns off the device instead of attempting to set an invalid speed
  - Air purifiers and fans now correctly map HomeKit's 0-100% to device speeds 1-5
  - Humidifiers now correctly map HomeKit's 0-100% to device speeds 1-9

### Added
- Added informative logging for all device control actions
  - Power state changes
  - Speed/level adjustments
  - Mode changes
  - Child lock toggles
  - Swing mode changes
  - Rotation direction changes
  - Target humidity adjustments
- Added support for ESO15-TB dual outdoor outlets
  - Power state control for both outlets
  - Energy monitoring capabilities
  - Power consumption tracking
  - Voltage monitoring
- Added support for ESWL01, ESWL03, and ESWD16 wall switches

### Changed
- Improved error handling for device control operations
- Enhanced speed control mapping for better user experience
- Updated humidifier mist level terminology in logs for clarity 