# Changelog

## 1.0.89 (2025-07-30)

### Fixed
- **Critical**: Resolved authentication issues for German and European users
- Updated to tsvesync v1.0.89 which includes regional API endpoint support
- Fixed "app version is too low" error (code -11012022) that prevented EU users from accessing their devices
- Improved compatibility with VeSync regional API servers

### Changed
- Enhanced automatic regional API endpoint detection based on user timezone
- Improved error handling and logging for authentication failures
- Better support for users in European, Asian, and Oceania regions

### Dependencies
- Updated tsvesync from 1.0.88 to 1.0.89

## 1.0.88 (2025-07-30)

### Fixed
- Fixed "app version is too low" API error by updating to VeSync app version 5.6.53
- Updated to tsvesync v1.0.88 which includes the critical APP_VERSION update

### Dependencies
- Updated tsvesync from 1.0.87 to 1.0.88

## 1.0.87 (2025-07-30)

### Fixed
- Fixed HomeKit speed slider showing continuous values for devices with discrete speed levels
- Air131 (LV-PUR131S, LV-RH131S) now correctly shows 3 speed positions (33%, 67%, 100%) instead of continuous 0-100%
- Devices with 4 speed levels now show proper 25% increments
- Improved speed characteristic configuration for all air purifier models

### Changed
- Added `calculateRotationSpeedStep()` method to determine appropriate slider step sizes
- HomeKit RotationSpeed characteristic now uses discrete steps for devices with fixed speed levels
- Maintained continuous slider (1% steps) for devices that support variable speed control

## 1.0.68 (2025-02-28)

### Added
- API quota management system to prevent exceeding VeSync's daily request limits
- Configurable quota buffer percentage and priority methods in config.schema.json
- Automatic device count detection for quota calculation
- Graceful degradation when quota limits are reached
- High-priority methods that will still work even when quota is exceeded

### Changed
- Improved error handling for API quota errors
- Limited device state sync retries to 3 attempts to avoid excessive API calls
- Enhanced logging for quota-related issues
- Updated config schema with new quota management options

### Fixed
- Fixed issue with API quota errors causing plugin instability
- Improved handling of null responses from API calls due to quota limits

## 1.0.67 (2025-01-15)

### Added
- Support for OasisMist1000S humidifier

### Changed
- Improved error handling for API rate limiting
- Enhanced token refresh mechanism

### Fixed
- Fixed issue with fan speed control on certain models
- Improved logging for troubleshooting

## 1.0.66 (2024-12-10)

### Added
- Support for Superior6000S humidifier

### Changed
- Improved device exclusion logic
- Enhanced error recovery for network failures
- Updated tsvesync dependency to v1.0.64

### Fixed
- Fixed connection stability issues

## 1.0.65 (2024-11-05)

### Added
- Support for EverestAir air purifier

### Changed
- Improved handling of device reconnection
- Enhanced logging for API communication
- Optimized polling frequency

### Fixed
- Fixed issues with characteristic updates
