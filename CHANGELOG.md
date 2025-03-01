# Changelog

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
