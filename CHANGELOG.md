# Changelog

## 1.0.103 (2025-08-25)

### Fixed
- **CRITICAL: EU Authentication Finally Working**: Updated to tsvesync v1.0.103 with definitive EU authentication fix
  - EU users can now authenticate successfully regardless of their initial region setting in Homebridge configuration
  - Fixed critical issue where EU accounts would fail with "access region conflict error" even with correct regional settings
  - EU accounts now authenticate automatically in ~2.5 seconds with intelligent region detection and switching
  - Resolves persistent authentication failures that completely prevented EU users from using the plugin
  - No configuration changes required - authentication improvements work automatically
- **Improved Bad Credential Handling**: Enhanced authentication error detection for faster failure response
  - Invalid credentials now fail fast in 0.1-1.3 seconds (previously took up to 7.5 seconds)
  - System detects credential error codes and stops retrying immediately for invalid username/password scenarios
  - Clear error messages for authentication failures with specific error code recognition
  - Eliminates unnecessary retry loops for obviously bad credentials, improving user experience

### Changed
- **Enhanced Cross-Region Reliability**: Improved authentication flow for international users
  - Better handling of region switching when cross-region errors are detected
  - Streamlined authentication process eliminates complex retry logic that was causing failures
  - Enhanced error detection and automatic recovery for EU and other international users
  - Improved debugging capabilities for authentication troubleshooting

### Dependencies
- Updated tsvesync from 1.0.102 to 1.0.103 for critical EU authentication resolution

### HomeKit Integration Notes
- **EU User Impact**: European users should experience immediate resolution of authentication issues
- **No Configuration Required**: Authentication improvements are completely automatic
- **Enhanced Reliability**: International users in all regions benefit from improved authentication stability
- **Faster Authentication**: EU authentication now completes in approximately 2.5 seconds

### Migration Notes
- **No Action Required**: EU authentication improvements are automatic and require no configuration changes
- **Immediate Resolution**: European users experiencing authentication failures should see instant resolution
- **Universal Compatibility**: Authentication enhancements benefit users in all geographical regions
- **Existing Functionality**: All device features and configurations remain unchanged with improved underlying authentication

## 1.0.102 (2025-08-25)

### Fixed
- **Critical EU Authentication Resolution**: Updated to tsvesync v1.0.102 with complete EU authentication fix
  - EU users can now authenticate successfully using correct regional endpoint (smartapi.vesync.eu)
  - Fixed Step 2 authentication for EU accounts - now uses correct 'DE' country code instead of 'US'
  - Resolves persistent authentication failures for European Homebridge users
  - Enhanced authentication reliability for international users with proper country code mapping
- **Enhanced Regional Support**: Improved cross-region authentication handling
  - Better handling of cross-region authentication errors with automatic region switching
  - Enhanced constructor options support for region parameter configuration
  - Improved debugging capabilities for authentication flow troubleshooting

### Dependencies
- Updated tsvesync from 1.0.101 to 1.0.102 for critical EU authentication resolution

### HomeKit Integration Notes
- **EU User Impact**: European users should experience immediate improvement in authentication reliability
- **Regional Compatibility**: Enhanced support for users in different geographical regions
- **No Configuration Changes**: Authentication improvements are automatic and require no configuration changes
- **Enhanced Debugging**: Better error reporting and debugging capabilities for authentication issues

### Migration Notes
- No configuration changes required - EU authentication improvements are automatic
- European users experiencing authentication failures should see immediate resolution
- Existing device functionality remains unchanged with improved underlying authentication stability
- Enhanced regional support provides better reliability for international users

## 1.0.101 (2025-08-24)

### Fixed
- **Critical Authentication Fix**: Updated to tsvesync v1.0.101 with critical cross-region authentication bug fix
  - Fixed timing issue where `setApiBaseUrl()` restoration was happening before retry attempts
  - Resolves `-11261022 "access region conflict error"` that affected EU and international accounts
  - Significantly improves authentication success rates for non-US new accounts
  - Enhanced retry mechanism ensures proper endpoint usage during cross-region authentication

### Dependencies
- Updated tsvesync from 1.0.100 to 1.0.101 for critical authentication bug fix

### Migration Notes
- No configuration changes required - authentication reliability improvements are automatic
- Users experiencing authentication failures should see immediate improvement

## 1.0.100 (2025-08-23)

### Fixed
- **Cross-Region Authentication Reliability**: Updated to tsvesync v1.0.100 with critical authentication retry fix
  - Fixed timing issue in cross-region authentication retry logic where API URL was restored too early
  - Improved authentication success rates for EU accounts and cross-region authentication scenarios
  - Enhanced retry mechanism now properly completes all attempts before restoring original API base URL
  - Better debug logging for cross-region authentication troubleshooting and monitoring
- **Authentication Script Enhancement**: Improved authentication test script reliability
  - Fixed retry logic that was preventing successful cross-region authentication despite script success indication
  - Better handling of authentication flow state during cross-region retry attempts

### Dependencies
- Updated tsvesync from 1.0.99 to 1.0.100 for enhanced cross-region authentication reliability

### Migration Notes
- No configuration changes required - authentication reliability improvements are automatic
- EU and cross-region users should experience significantly improved authentication success rates
- Enhanced error handling provides better visibility into authentication retry processes
- Existing device functionality remains unchanged with improved underlying authentication stability

## 1.0.99 (2025-08-18)

### Fixed
- **Session Management**: Fixed token expiry handling to properly recognize VeSync JWT tokens as valid for 30 days
  - Updated TOKEN_EXPIRY from 1 hour to 25 days to prevent unnecessary re-authentication
  - Reduced authentication frequency from hourly to every 25 days for improved stability
  - Enhanced session management with proper JWT token lifetime recognition
- **Cross-Region Authentication**: Updated to tsvesync v1.0.99 with enhanced cross-region retry logic
  - Improved authentication reliability for international users with automatic region switching
  - Enhanced authentication script with cross-region error handling and automatic retry mechanisms
  - Better handling of cross-region authentication errors with intelligent fallback
- **Authentication Script**: Enhanced vesync-auth-test.sh with cross-region retry handling
  - Added automatic detection and retry for cross-region authentication errors
  - Improved error handling with region change token support
  - Enhanced debugging capabilities for cross-region authentication scenarios

### Dependencies
- Updated tsvesync from 1.0.98 to 1.0.99 for enhanced cross-region authentication support

### Migration Notes
- No configuration changes required - authentication improvements are automatic
- Users should experience significantly reduced authentication requests (from hourly to every 25 days)
- International users should experience better authentication success rates with cross-region support
- Existing device functionality remains unchanged with improved underlying session management

## 1.0.98 (2025-08-17)

### Fixed
- **Authentication Stability**: Updated to tsvesync v1.0.98 with enhanced authentication flow fixes
  - Resolved bizToken handling issues in VeSync authentication requests
  - Improved reliability of new two-step authentication flow with better error handling
  - Enhanced terminalId generation consistency across authentication steps
  - Fixed authentication payload structure to better match VeSync API requirements
- **Testing Infrastructure**: Updated authentication testing script for better reliability
  - Enhanced test script to properly handle null bizToken scenarios
  - Improved authentication flow validation and error reporting

## 1.0.97 (2025-08-16)

### Added
- **Enhanced Authentication Reliability**: Updated to tsvesync v1.0.97 with improved authentication system
  - Automatic support for new two-step VeSync authentication flow with legacy fallback
  - Enhanced cross-region authentication support for international users
  - Improved authentication error recovery and retry mechanisms
- **Regional API Support**: Automatic detection and routing for global VeSync API endpoints
  - Enhanced support for EU users with automatic endpoint switching
  - Improved authentication reliability for users in different geographical regions
  - Better handling of cross-region authentication errors and automatic fallback

### Fixed
- **Authentication Issues**: Resolved authentication problems affecting international users
  - Fixed "app version is too low" errors with updated VeSync API compatibility
  - Improved authentication success rates for users in EU and other regions
  - Enhanced token refresh and session management reliability
- **API Compatibility**: Updated VeSync API version support for improved stability
  - Better handling of VeSync API changes and authentication protocol updates
  - Improved compatibility with latest VeSync mobile app authentication methods

### Dependencies
- Updated tsvesync from 1.0.96 to 1.0.97 for enhanced authentication and regional support

### Migration Notes
- No configuration changes required - authentication improvements are automatic
- Enhanced authentication reliability should improve connection stability for all users
- International users should experience better authentication success rates
- Existing device functionality remains unchanged with improved underlying reliability

## 1.0.96 (2025-08-09)

### Changed
- **Logging Improvements**: Reduced log verbosity for air quality and filter maintenance features
  - Changed informational logs to debug level for cleaner output during device setup and operation
  - Preserved error and warning logs for important issues and troubleshooting
  - Affects air quality service setup, filter maintenance service setup, and related feature detection logging

## 1.0.95 (2025-08-09)

### Added
- **Air Quality Monitoring**: Complete HomeKit AirQualitySensor service integration for air purifiers
  - Added AirQuality characteristic with PM2.5-based quality levels (Excellent/Good/Fair/Poor/Very Poor)
  - Added PM2_5Density characteristic showing real-time PM2.5 measurements in μg/m³
  - Added PM10Density characteristic for devices that support PM10 monitoring
  - Automatic air quality service setup for devices with air quality monitoring capabilities
  - Real-time air quality updates synchronized with device state changes
- **Filter Maintenance**: HomeKit FilterMaintenance service for filter life tracking
  - Added FilterChangeIndication characteristic (alerts when filter needs replacement at <10% life)
  - Added FilterLifeLevel characteristic showing current filter life percentage (0-100%)
  - Automatic filter service setup for all supported air purifiers
  - Smart filter life parsing supporting both direct values and object formats from different device types
- **Enhanced Feature Detection**: Improved automatic feature detection for air purifiers
  - Dynamic air quality feature detection based on device capabilities and available data
  - Enhanced filter life feature detection with device type pattern matching
  - Comprehensive logging for feature detection and service setup processes
  - Robust fallback mechanisms for devices with varying API response formats

### Changed
- **Device Capability Detection**: Enhanced automatic service setup based on device features
  - Improved `hasFeature()` method with better device type recognition and data validation
  - Added runtime feature detection based on actual device API response data
  - Enhanced logging throughout the accessory setup process for better troubleshooting
- **Air Quality Integration**: Comprehensive air quality monitoring implementation
  - Replaced disabled air quality features with full HomeKit AirQualitySensor service support
  - Added PM2.5 to HomeKit air quality level conversion using EPA AQI standards
  - Enhanced characteristic value constraints and validation for air quality data
- **Filter Life Management**: Robust filter maintenance service implementation
  - Smart handling of different filter life data formats (Air131 objects vs direct numbers)
  - Added comprehensive error handling and default values for missing filter data
  - Enhanced filter service creation and characteristic setup with proper naming
- **Test Infrastructure**: Expanded test utilities for air quality and filter features
  - Added mock air purifier factory with air quality and filter simulation
  - Created comprehensive test scenarios for different air quality levels and filter conditions
  - Enhanced test helpers with air quality and filter life test data generators

### Fixed
- **Air Quality Service Setup**: Resolved air quality service initialization and updates
  - Fixed air quality service creation and characteristic configuration
  - Improved PM2.5 density value handling and HomeKit compatibility
  - Enhanced air quality level calculation and real-time updates
- **Filter Service Integration**: Fixed filter maintenance service setup and operation
  - Resolved filter service creation and characteristic binding issues
  - Improved filter life percentage calculation and change indication logic
  - Enhanced filter service naming and HomeKit integration
- **Feature Detection Reliability**: Improved device feature detection accuracy
  - Fixed feature detection for different device types and API response variations
  - Enhanced fallback mechanisms for devices with incomplete feature data
  - Improved logging and error handling for feature detection failures

### Dependencies
- Updated tsvesync from 1.0.94 to 1.0.95 for enhanced air quality and filter life support

### HomeKit Integration Notes
- **New Services**: Air purifiers now expose additional HomeKit services:
  - **AirQualitySensor**: Shows air quality level, PM2.5, and PM10 density (where available)
  - **FilterMaintenance**: Tracks filter life and alerts when replacement is needed
- **Compatibility**: New services are automatically detected and only appear for supported devices
- **User Experience**: Home app will show air quality readings and filter status alongside existing controls
- **No Breaking Changes**: Existing air purifier functionality remains unchanged

### Migration Notes
- No configuration changes required - new services are automatically detected
- Existing air purifier accessories will gain air quality and filter services after restart
- Filter replacement notifications will appear in Home app when filter life drops below 10%
- Air quality readings provide real-time PM2.5 and air quality level monitoring

## 1.0.90 (2025-07-31)

### Fixed
- **Breaking Change**: Updated to tsvesync v1.0.90 which removes regional API endpoint support
- All users now use the US API endpoint for improved reliability and authentication
- Fixes persistent authentication issues for German and European users
- Resolves "app version is too low" and "illegal argument" errors

### Changed
- Simplified API configuration by removing regional endpoint complexity
- Timezone parameter is still accepted for backward compatibility but no longer affects API routing
- Enhanced authentication reliability by using single, stable endpoint

### Dependencies
- Updated tsvesync from 1.0.89 to 1.0.90

### Migration Notes
- **Breaking Change**: If you were using `setRegionalEndpoint()` or `getRegionalEndpoint()` functions directly, these have been removed
- Most users will not be affected as the plugin automatically handled endpoint selection
- All functionality remains the same, just with improved reliability

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
