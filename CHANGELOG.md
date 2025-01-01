# Changelog

## [1.0.20] - 2025-01-01

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

### Changed
- Improved error handling for device control operations
- Enhanced speed control mapping for better user experience
- Updated humidifier mist level terminology in logs for clarity 