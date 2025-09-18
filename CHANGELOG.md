# Changelog

## 1.3.4 (2025-09-18)

### Added
- **🕹️ ESWD16 Dimming in HomeKit**: ESWD16 dimmer switches now register as HomeKit `Lightbulb` accessories with native On/Off and Brightness control.
- **🌈 Indicator Ring Control**: Introduced a dedicated "Indicator" light service for the ESWD16 locator ring, including Hue/Saturation control powered by automatic HSV→RGB conversion.

### Improved
- **🔄 State Synchronization**: On/Off and brightness updates now refresh ESWD16 cloud state immediately, keeping HomeKit characteristics accurate even when VeSync lags.
- **🛡️ Polling Guardrails**: Background discovery is now serialized and paired with UUID-stable Air Quality accessories, preventing duplicate registrations and overlapping sync loops.

### Dependencies
- **📦 tsvesync**: Upgraded to 1.3.4 to stay aligned with the latest ESWD16 API surfaces.

## 1.3.3 (2025-01-05)

### Fixed
- **⏰ Extended Timeout Chain Fix**: Enhanced proactive token refresh system to handle very long-duration tokens
  - **🔧 Timeout Chaining**: Implemented timeout chaining for refresh delays exceeding Node.js setTimeout maximum (~24.8 days)
  - **🛡️ Robust Scheduling**: Prevents timer overflow errors with automatic timer chaining for extended token lifetimes
  - **⚡ Seamless Operation**: Long-duration token refresh scheduling now works reliably without timing limitations
  - **🎯 Precision Handling**: Maintains accurate refresh timing even for tokens with extended lifetimes
  - **📊 Enhanced Logging**: Improved logging for chained timer operations and extended refresh scheduling

- **🔄 Session Hydration Compatibility**: Enhanced session recovery with backward compatibility
  - **🛡️ Fallback Support**: Added backward-compatible session hydration for older tsvesync versions
  - **⚡ Direct Field Setting**: Automatic fallback to direct field setting when hydrateSession method unavailable
  - **🔧 Improved Reliability**: Enhanced session recovery across different tsvesync library versions
  - **📊 Better Error Handling**: Graceful handling of version compatibility during session restoration

### Enhanced
- **🎯 Timer Management**: Advanced timer management system for extended timeout scenarios
  - **🔧 MAX_DELAY Handling**: Proper handling of Node.js setTimeout maximum delay limitations (2,147,483,647 ms)
  - **⚡ Chain Calculation**: Intelligent timer chaining with accurate remaining time calculations
  - **🛡️ Error Prevention**: Prevents timer overflow errors and ensures reliable long-duration scheduling
  - **📈 Performance**: Optimized timer chaining with minimal overhead for standard use cases

### Technical Details
- **🏗️ Timeout Architecture**: Enhanced proactive refresh system with timeout chaining support
- **📊 Timer Chain Logic**: Automatic detection and handling of timeouts exceeding Node.js limitations
- **🔧 Compatibility Layer**: Backward-compatible session hydration for various tsvesync versions
- **⚡ Precision Timing**: Maintains accurate refresh timing regardless of token lifetime duration

### Dependencies
- **📦 tsvesync**: Updated to 1.3.3 for enhanced cross-project version synchronization

### Summary of All Enhancements from v1.2.0 onwards

#### Session Management & Authentication System (v1.2.0-1.3.3)
- **💾 Complete Session Persistence**: Sessions survive across Homebridge restarts with enhanced validation
- **⏰ Advanced Proactive Token Refresh**: Intelligent refresh scheduling with extended timeout support (v1.3.0-1.3.3)
- **🔐 Enhanced Security**: Username validation and account isolation for multi-user environments
- **📊 JWT Token Mastery**: Complete lifecycle management with normalized timestamp handling
- **🛡️ Secure Storage**: Protected session storage with comprehensive validation and recovery
- **🚀 Performance Optimization**: Reduced authentication overhead with intelligent session reuse
- **🔄 Cross-Region Support**: Enhanced compatibility with different VeSync regional endpoints
- **🎯 Extended Timeout Handling**: Reliable scheduling for very long-duration token refresh scenarios (NEW in 1.3.3)

#### Speed Control & HomeKit Integration (v1.2.0-1.3.1)
- **🎛️ Advanced Speed Control**: Dynamic support for 3-4+ speed air purifiers with model-specific logic
- **🌙 Intelligent Sleep Mode**: Sleep mode integration as first notch on HomeKit slider
- **🎯 Precision Mapping**: Accurate percentage-to-speed conversions for different device capabilities
- **📱 Enhanced UX**: Improved slider positions, speed transitions, and HomeKit responsiveness
- **🔄 Smart Notch System**: Automatic adjustment based on device capabilities and speed ranges

Full changelog: https://github.com/mickgiles/homebridge-tsvesync/blob/main/CHANGELOG.md

## 1.3.2 (2025-01-05)

### Enhanced
- **🔐 Advanced Session Management**: Comprehensive improvements to session persistence and authentication reliability
  - **👤 Enhanced Username Validation**: Session reuse now validates username to prevent cross-account authentication conflicts
  - **🔒 Improved Account Isolation**: Persisted sessions are properly isolated and validated against configured accounts
  - **💾 Optimized Session Persistence**: Best-effort session saving immediately after successful authentication
  - **📝 Detailed Session Logging**: Comprehensive debug logging for session save/load operations with expiration tracking
  - **🛡️ Robust Error Handling**: Enhanced error messages and recovery flows for session hydration failures

- **🔧 JWT Timestamp Precision Handling**: Enhanced token timestamp processing for consistent authentication
  - **📊 Timestamp Normalization**: Automatic detection and conversion of millisecond timestamps to seconds
  - **⚡ Improved Token Validation**: Ensures accurate token expiration calculations across different token formats
  - **🔄 Cross-Region Compatibility**: Better handling of JWT tokens from different VeSync regional endpoints
  - **🛡️ Edge Case Prevention**: Fixes authentication issues with tokens using inconsistent timestamp precision

### Fixed
- **🎛️ Session Hydration Reliability**: Improved session recovery and validation processes
  - **🔍 Better Error Detection**: Enhanced detection of invalid or corrupted session data
  - **📈 Startup Performance**: Optimized authentication flow to reduce unnecessary login attempts
  - **⚡ Token Lifecycle Management**: Better coordination with tsvesync library's token refresh mechanisms
  - **🛡️ Authentication Stability**: Reduced authentication interruptions during long-running sessions

### Technical Details
- **🏗️ Session Architecture**: Enhanced session store with improved persistence and validation logic
- **📊 Token Management**: Advanced JWT token handling with normalized timestamp precision
- **🔧 Error Handling**: Comprehensive error recovery flows with detailed logging and debugging
- **⚡ Performance**: Optimized session operations for better startup performance and reliability

### Dependencies
- **📦 tsvesync**: Updated to 1.3.2 for enhanced JWT timestamp handling and session management improvements

### Summary of All Enhancements from v1.2.0 onwards

#### Session Management & Authentication System (v1.2.0-1.3.2)
- **💾 Complete Session Persistence**: Sessions survive across Homebridge restarts with enhanced validation
- **⏰ Advanced Proactive Token Refresh**: Intelligent refresh scheduling prevents JWT expiration (v1.3.0)
- **🔐 Enhanced Security**: Username validation and account isolation for multi-user environments
- **📊 JWT Token Mastery**: Complete lifecycle management with normalized timestamp handling
- **🛡️ Secure Storage**: Protected session storage with comprehensive validation and recovery
- **🚀 Performance Optimization**: Reduced authentication overhead with intelligent session reuse
- **🔄 Cross-Region Support**: Enhanced compatibility with different VeSync regional endpoints

#### Speed Control & HomeKit Integration (v1.2.0-1.3.1)
- **🎛️ Advanced Speed Control**: Dynamic support for 3-4+ speed air purifiers with model-specific logic
- **🌙 Intelligent Sleep Mode**: Sleep mode integration as first notch on HomeKit slider
- **🎯 Precision Mapping**: Accurate percentage-to-speed conversions for different device capabilities
- **📱 Enhanced UX**: Improved slider positions, speed transitions, and HomeKit responsiveness
- **🔄 Smart Notch System**: Automatic adjustment based on device capabilities and speed ranges

Full changelog: https://github.com/mickgiles/homebridge-tsvesync/blob/main/CHANGELOG.md

## 1.3.1 (2025-09-04)

### Fixed
- **🔐 Enhanced Session Management**: Improved session persistence and authentication flow
  - **👤 Username Validation**: Session reuse now validates username to prevent cross-account conflicts
  - **🔒 Account Isolation**: Persisted sessions are ignored if they belong to a different configured account
  - **⚡ Optimized Login Flow**: Authentication only occurs when necessary, relying on persisted tokens and library re-login
  - **🛡️ Session Security**: Enhanced session storage with username tracking for better account management

- **🎛️ Core 200S Speed Control Improvements**: Enhanced air purifier speed control for Core 200S devices
  - **🎯 Model-Specific Logic**: Core 200S now uses dedicated speed calculation method with proper 25% steps
  - **📊 Accurate Mapping**: Improved speed-to-percentage conversion for devices with 3 manual speeds
  - **🌙 Sleep Mode Integration**: Better sleep mode handling with model-specific speed ranges
  - **🔄 Precise Notch Calculation**: Enhanced notch-to-speed mapping for more accurate HomeKit control

### Enhanced
- **📝 Improved Logging**: Better debugging information for mode changes and device operations
  - **🔍 Mode Change Tracking**: Enhanced logging for manual, auto, and sleep mode transitions
  - **🎛️ Speed Control Logging**: More detailed logging for speed changes and slider operations
  - **📱 HomeKit Integration**: Better visibility into device state changes and characteristic updates

### Changed
- **🔄 Authentication Strategy**: Optimized authentication flow to reduce unnecessary login attempts
  - **💾 Token Persistence**: Improved reliance on persisted tokens with library-managed re-authentication
  - **⚡ Startup Performance**: Faster platform initialization by avoiding redundant login checks
  - **🎯 Smart Re-login**: Authentication only triggered when API returns 401/419 status codes

### Technical Details
- **🏗️ Session Architecture**: Enhanced session store with username tracking and validation
- **🎛️ Speed Control Algorithm**: Model-specific speed calculation methods for different device types
- **🔧 Authentication Flow**: Streamlined login logic with better token lifecycle management
- **📊 Core 200S Support**: Dedicated isCore200S() method for model-specific functionality

### Dependencies
- **📦 tsvesync**: Updated to 1.3.1 for enhanced token expiration detection and authentication improvements

## 1.3.0 (2025-09-04)

### Added
- **⏰ Enhanced Proactive Token Refresh**: Advanced JWT token refresh system with intelligent scheduling
  - **🎯 Smart Scheduling Policy**: Dynamic refresh timing based on token lifetime:
    - >7 days remaining: refresh 5 days before expiry
    - 1-7 days remaining: refresh 12 hours before expiry
    - 1-24 hours remaining: refresh 1 hour before expiry
    - <1 hour remaining: rely on 401-triggered re-login to prevent thrashing
  - **📊 Accurate Lifetime Tracking**: Uses actual token issuance time (iat) for precise calculations
  - **🛡️ Duplicate Prevention**: Guards against multiple timers for same token expiration
  - **🔄 State Management**: Concurrent refresh protection with in-progress tracking
  - **🧹 Clean Shutdown**: Proper timer cleanup on platform shutdown
  - **⚡ Background Operation**: Seamless token refresh without service interruption

- **🔧 Advanced Session Management**: Enhanced integration with tsvesync v1.3.0
  - **🔔 Token Change Integration**: Full utilization of tsvesync's onTokenChange callback system
  - **📈 Reliability**: Eliminates VeSync connectivity interruptions from expired tokens
  - **🎯 Optimal Timing**: Intelligent buffer calculation prevents both premature and late refreshes
  - **⏰ Safety Floor**: Never schedules refresh less than 30 minutes from current time

### Enhanced
- **🔐 Session Persistence**: Improved session management with proactive refresh integration
  - **💾 Complete Session Recovery**: Sessions survive across Homebridge restarts with enhanced refresh
  - **📊 JWT Integration**: Advanced token lifecycle management with expiration tracking
  - **🛡️ Secure Storage**: Protected session storage in tsvesync subdirectory
  - **🚀 Faster Startup**: Reduced authentication overhead via intelligent session reuse
  - **🔄 Seamless Recovery**: Automatic fallback when persisted sessions are invalid

### Changed
- **📚 Dependency Update**: Updated tsvesync dependency to 1.3.0 for enhanced session management
- **📝 Documentation**: Comprehensive release notes including all enhancements from 1.2.0 onwards
- **⚡ Performance**: Optimized token refresh logic for better performance and reliability

### Technical Details
- **🔧 Advanced Token Lifecycle**: Proactive refresh ensures tokens never expire during operation
- **🎯 Progressive Buffer Strategy**: Smart refresh timing based on token lifetime for optimal reliability
- **📈 Enhanced Error Handling**: Comprehensive try/finally blocks for robust operation
- **🔄 State Coordination**: Prevents concurrent refresh operations with proper synchronization
- **🛡️ Authentication Stability**: Eliminates authentication interruptions during long-running sessions

### Summary of All Features from v1.2.0 onwards

#### Session Management & Authentication (v1.2.0-1.3.0)
- **💾 Complete Session Persistence**: Sessions survive across Homebridge restarts
- **⏰ Enhanced Proactive Token Refresh**: Advanced refresh before JWT expiration (NEW in 1.3.0)
- **🔐 Automatic Recovery**: Seamless fallback when persisted sessions are invalid
- **📊 JWT Integration**: Full token lifecycle management with expiration tracking
- **🛡️ Secure Storage**: Protected session storage in tsvesync subdirectory
- **🚀 Faster Startup**: Reduced authentication overhead via session reuse

#### Speed Control & HomeKit Integration (v1.2.0)
- **🎛️ Advanced Speed Control**: Dynamic support for 3-4+ speed air purifiers
- **🌙 Sleep Mode Integration**: Sleep mode as first notch on HomeKit slider
- **🎯 Precision Mapping**: Accurate percentage-to-speed conversions
- **📱 Enhanced UX**: Improved slider positions and speed transitions
- **🔄 Smart Notch System**: Automatic adjustment based on device capabilities

Full changelog: https://github.com/mickgiles/homebridge-tsvesync/blob/main/CHANGELOG.md

## 1.2.2 (2025-09-04)

### Added
- **⏰ Proactive Token Refresh**: Intelligent JWT token refresh before expiration
  - **🔄 Smart Scheduling**: Automatically schedules token refresh before JWT expiry
  - **📊 Accurate Lifetime Tracking**: Uses actual token issuance time (iat) for precise calculations
  - **🎯 Dynamic Buffer Calculation**: Refresh buffer is earlier of 5 days or 10% of token lifetime
  - **🔔 Token Change Integration**: Leverages tsvesync's onTokenChange callback system
  - **🧹 Clean Shutdown**: Properly clears refresh timer on platform shutdown
  - **🛡️ Uninterrupted Service**: Prevents authentication failures during long-running sessions

### Changed
- **📚 Dependency Update**: Updated tsvesync dependency to 1.2.2
- **📝 Documentation**: Comprehensive release notes including all changes from 1.2.0 onwards

### Technical Details
- **🔧 Token Lifecycle**: Proactive refresh ensures tokens never expire during operation
- **📈 Reliability**: Eliminates VeSync connectivity interruptions from expired tokens
- **🎯 Buffer Strategy**: Minimum 1 day, maximum 5 days refresh buffer for optimal timing
- **⚡ Background Operation**: Token refresh happens seamlessly without service interruption

### Summary of All Features from v1.2.0 onwards

#### Session Management & Authentication (v1.2.0-1.2.2)
- **💾 Complete Session Persistence**: Sessions survive across Homebridge restarts
- **⏰ Proactive Token Refresh**: Automatic refresh before JWT expiration (NEW in 1.2.2)
- **🔐 Automatic Recovery**: Seamless fallback when persisted sessions are invalid
- **📊 JWT Integration**: Full token lifecycle management with expiration tracking
- **🛡️ Secure Storage**: Protected session storage in tsvesync subdirectory
- **🚀 Faster Startup**: Reduced authentication overhead via session reuse

#### Speed Control & HomeKit Integration (v1.2.0)
- **🎛️ Advanced Speed Control**: Dynamic support for 3-4+ speed air purifiers
- **🌙 Sleep Mode Integration**: Sleep mode as first notch on HomeKit slider
- **🎯 Precision Mapping**: Accurate percentage-to-speed conversions
- **📱 Enhanced UX**: Improved slider positions and speed transitions
- **🔄 Smart Notch System**: Automatic adjustment based on device capabilities

Full changelog: https://github.com/mickgiles/homebridge-tsvesync/blob/main/CHANGELOG.md

## 1.2.1 (2025-09-04)

### Changed
- **📦 Re-release**: Version 1.2.1 re-release with comprehensive release notes from 1.2.0
- **📝 Documentation**: Enhanced release documentation and changelog formatting
- **🔄 Version Alignment**: Synchronized version numbers across tsvesync and homebridge-tsvesync
- **📚 Dependency Update**: Updated tsvesync dependency to 1.2.1

## 1.2.0 (2025-09-04)

### Added
- **💾 Session Persistence**: Comprehensive session management for improved reliability
  - **🔐 Automatic Session Recovery**: VeSync sessions now persist across Homebridge restarts
  - **📊 Token Lifecycle Management**: JWT token expiration tracking and automatic refresh
  - **🛡️ Secure Storage**: Sessions stored with appropriate file permissions in tsvesync subdirectory
  - **🚀 Faster Startup**: Reduced authentication overhead on Homebridge startup via session reuse
  - **🔄 Seamless Recovery**: Automatic fallback to fresh login when persisted sessions are invalid

- **🎛️ Advanced Speed Control**: Enhanced speed control for air purifiers with 4+ manual speeds
  - **🌟 Multi-Speed Support**: Dynamic step calculation for devices with 4+ manual speed levels
  - **🎯 Precision Mapping**: Better percentage-to-speed conversion for devices with varying speed counts
  - **🔄 Smart Notch System**: Automatic adjustment of speed notches based on device capabilities
  - **📱 Improved HomeKit UX**: More accurate slider positions and speed transitions

### Enhanced
- **🔧 API Integration**: Enhanced tsvesync library integration with session management
  - **📦 Library Update**: Updated to tsvesync 1.2.0 with session persistence capabilities
  - **🔗 Session Callbacks**: Integration with tsvesync session store for automatic persistence
  - **⚡ Performance**: Reduced API calls through intelligent session reuse
  - **🛡️ Reliability**: Better handling of authentication failures with automatic recovery

- **🌙 Sleep Mode Control**: Refined sleep mode speed control logic
  - **🎛️ Dynamic Step Calculation**: Speed steps now adjust based on maximum device speeds (20% vs 25%)
  - **🎯 Better Speed Mapping**: More accurate conversion between HomeKit percentages and device speeds
  - **🔄 Consistent Behavior**: Unified speed control logic across all sleep-capable devices
  - **📱 UI Responsiveness**: Improved HomeKit characteristic updates during sleep mode transitions

### Fixed
- **🔧 Speed Control Accuracy**: Enhanced speed control precision for various device configurations
  - **📊 Speed Calculation**: Fixed percentage calculation for devices with 4+ manual speeds
  - **🎛️ Notch Mapping**: Improved notch-to-speed conversion with proper boundary checking
  - **🔄 State Synchronization**: Better synchronization between device state and HomeKit display
  - **🛡️ Edge Case Handling**: Enhanced handling of speed edge cases and boundary conditions

### Technical Details
- **🏗️ Session Architecture**: Complete integration with tsvesync 1.2.0 session management system
- **🔧 FileSessionStore**: Dedicated session storage in ~/.homebridge/tsvesync/session.json
- **📊 JWT Integration**: Automatic JWT token expiration tracking and session validation
- **🎛️ Speed Algorithm**: Enhanced speed calculation algorithms for multi-speed device support
- **🔄 Promise Coordination**: Better coordination with tsvesync library's promise-based login system

### Migration Notes
- **🚀 Automatic Enhancement**: Session persistence activates automatically after Homebridge restart
- **📁 New Storage**: Session files stored in new tsvesync subdirectory under Homebridge storage path
- **🔄 Backward Compatible**: All existing functionality preserved with enhanced capabilities
- **✅ No Configuration**: No configuration changes required - enhancements work automatically
- **🔧 Dependency Update**: tsvesync library automatically updated to version 1.2.0

## 1.1.2 (2025-09-03)

### Enhanced
- **🌙 Advanced Sleep Mode Speed Control**: Significantly improved HomeKit sleep mode integration
  - **🎯 Sleep as First Notch**: Sleep mode now appears as the first position (25%) on HomeKit speed slider for supported devices
  - **🎛️ Better Speed Mapping**: Enhanced speed control with 25%/50%/75%/100% positions for intuitive user control
  - **🔄 Smart Mode Transitions**: Automatic manual mode switching when adjusting speeds from sleep mode
  - **📱 Immediate UI Feedback**: Instant HomeKit characteristic updates for responsive user experience
  - **🛡️ Error Recovery**: Comprehensive error handling with state reversion on API failures

- **⚡ Performance Optimizations**: Streamlined speed control logic for better performance
  - **🔧 Consolidated Code**: Refactored speed conversion methods for improved maintainability
  - **📊 Efficient Calculations**: Optimized percentage-to-speed and speed-to-percentage conversions
  - **🎯 Reduced Complexity**: Simplified conditional logic while maintaining full functionality
  - **💾 Memory Efficiency**: Better resource utilization with consolidated helper methods

### Fixed
- **🌪️ Enhanced Speed Restoration**: Improved device speed handling across all air purifier models
  - **🎛️ Sleep Mode Detection**: Better detection and handling of sleep mode state transitions
  - **🔄 Mode Synchronization**: Improved synchronization between device mode and HomeKit display
  - **📱 Slider Accuracy**: More accurate speed slider positions for devices with sleep mode support
  - **🛡️ State Consistency**: Enhanced state management to prevent speed control conflicts

### Technical Details
- **🏗️ Refactored Architecture**: Consolidated speed calculation methods for better code organization
- **🎯 Feature Detection**: Enhanced hasFeature('sleep_mode') integration for dynamic behavior
- **🔧 Method Optimization**: Streamlined percentageToSpeed() and speedToPercentage() methods
- **📊 Improved Mapping**: Better notch-based speed mapping with rounding for discrete positions
- **🛡️ Enhanced Validation**: Improved input validation and boundary checking for speed values

### Affected Devices
- **Sleep Mode Devices**: Air purifiers with sleep mode support now have enhanced speed control
- **All Air Purifiers**: Benefit from optimized speed conversion logic and better performance
- **Core/Vital/LAP Series**: Improved HomeKit integration with consistent speed control behavior

### Migration Notes
- **🚀 Automatic Enhancement**: Speed control improvements activate automatically after Homebridge restart
- **📱 HomeKit Changes**: Supported devices will show sleep mode as first notch on speed slider
- **🔄 Backward Compatible**: All existing functionality preserved with enhanced capabilities
- **✅ No Configuration**: No configuration changes required - enhancements work automatically

### Dependencies
- **📦 tsvesync**: Updated to 1.1.2 for synchronized release versioning

## 1.1.1 (2025-08-30)

### Improved
- **⚡ Enhanced On/Off Responsiveness**: Significantly improved HomeKit control responsiveness
  - **🎯 Instant UI Feedback**: HomeKit characteristics now update immediately when on/off commands are issued
  - **⏳ Background Processing**: API calls are processed in the background while users see immediate state changes
  - **🛡️ Error Recovery**: Failed API calls now properly revert HomeKit state to maintain consistency
  - **📱 Better UX**: Users experience near-instantaneous response when toggling devices on/off in the Home app

- **🔧 Enhanced Speed Restoration**: Improved device speed handling when turning devices back on
  - **🌪️ Air131 Support**: Air131 devices now properly restore their previous speed setting when turned on
  - **⚡ All Device Types**: Enhanced speed restoration logic for all air purifier models
  - **🎛️ Speed Preservation**: Device speed settings are maintained and restored correctly after power cycling

### Fixed
- **🧪 Test Environment Compatibility**: Fixed setPrimaryService() calls in testing environments
  - **✅ Test Safety**: Added proper function existence check before calling setPrimaryService()
  - **🔧 Development**: Ensures compatibility across different testing and development environments
  - **🛡️ Defensive Coding**: Prevents errors when service methods are not available

### Technical Details
- **📦 Immediate State Updates**: Uses updateCharacteristic() for instant HomeKit feedback
- **🔄 Error Handling**: Comprehensive error recovery with state reversion on API failures
- **⚡ Performance**: Optimized to reduce perceived latency while maintaining API rate limits
- **🎯 Device State**: Enhanced device state persistence for consistent behavior across restarts

### Affected Devices
- **All Air Purifiers**: Improved on/off responsiveness and speed restoration
- **Air131 Models**: Enhanced speed restoration logic with immediate characteristic updates
- **Core Series**: Better HomeKit interaction consistency with instant feedback

## 1.1.0 (2025-08-29)

### Added
- **🆕 Separated Air Quality Sensors**: Air quality sensors now appear as independent HomeKit accessories
  - **📦 New AirQualitySensorAccessory Class**: Dedicated accessory for air quality monitoring with PM2.5 and PM10 support
  - **🎯 Core300S, Core400S, Core600S**: Air quality sensors appear as separate tiles in HomeKit for better organization
  - **📊 EPA AQI Standards**: Air quality levels calculated using official EPA Air Quality Index thresholds
  - **🔧 Smart Detection**: Automatic PM2.5 and PM10 characteristic setup based on device capabilities
  - **🌟 Better UX**: Air purifier controls and air quality readings are now clearly separated in HomeKit

### Fixed
- **🎯 Core Series Filter Life Detection**: Enhanced filter life detection for all Core series air purifiers
  - **✅ Core300S Filter Support**: Core300S devices now properly display filter life percentage in HomeKit
  - **🔧 Pattern Matching**: Improved device type detection to catch variants like "300S", "200S", "400S", "600S"
  - **🛡️ Defensive Logic**: Robust filter detection ensures all Core series devices get filter characteristics
  - **📱 HomeKit Integration**: Filter maintenance notifications now work correctly for all Core series models

- **🚨 Critical Air Quality Bug Fix**: Resolved phantom air quality services on devices without sensors
  - **⚡ hasFeature() Fix**: Fixed API proxy wrapping causing hasFeature() to return Promise instead of boolean
  - **🎯 Core200S Specific**: Core200S and LAP-C201S/C202S no longer show phantom air quality services
  - **🔧 Bypass Logic**: Moved bypass check before async wrapper to prevent Promise wrapping of sync methods
  - **✅ Accurate Detection**: Only devices with actual air quality sensors now show AQ characteristics

### Improved
- **🔇 Reduced Log Verbosity**: Changed excessive info logging to debug level for cleaner operation
  - **📊 Debug Level**: Feature detection, device type analysis, and configuration details moved to debug
  - **⚡ Performance**: Reduced log noise during normal operation while maintaining troubleshooting capability
  - **🎯 Focused Logging**: Important warnings and errors remain visible, routine operations moved to debug

- **🏗️ Enhanced HomeKit Service Architecture**: Proper service hierarchy for better HomeKit display
  - **🎯 Primary Service**: AirPurifier service marked as primary to show controls instead of info page
  - **🔗 Linked Services**: Air quality sensors properly linked to maintain service relationships
  - **📱 HomeKit UX**: All air purifiers now show control interface when tapped in Home app

### Technical Details
- **🔧 API Proxy Enhancement**: Improved rate limiting with proper bypass handling for sync methods
- **📦 Device Factory**: Enhanced device classification and feature detection logic
- **🎛️ Service Management**: Comprehensive service setup with primary/secondary hierarchy
- **🔍 Enhanced Logging**: Detailed debugging information available when needed

### Affected Devices
- **Core Series**: Core200S, Core300S, Core400S, Core600S - improved filter detection and service setup
- **LAP Series**: LAP-C201S, LAP-C202S, LAP-C301S, LAP-C401S, LAP-C601S - fixed phantom AQ services
- **All Air Purifiers**: Better HomeKit service hierarchy and consistent behavior across models

### Migration Notes
- **🚀 Automatic Upgrade**: Changes take effect after Homebridge restart, no configuration needed
- **📱 HomeKit Changes**: Air quality sensors will appear as separate accessories for supported devices
- **🔄 Backward Compatible**: All existing functionality preserved with enhanced capabilities
- **✅ Verification**: Check that Core series devices show filter life and separated AQ sensors work correctly

### Dependencies
- **📦 tsvesync**: Updated to 1.1.0 for synchronized release versioning

## 1.0.123 (2025-08-29)

### Fixed
- **🎯 Core300S HomeKit Controls Display**: Fixed Core300S showing info page instead of control settings in HomeKit
  - **✅ Primary Service**: AirPurifier service now marked as primary service to ensure control display instead of info page
  - **🔗 Service Hierarchy**: AirQualitySensor service properly linked as secondary service to primary AirPurifier service
  - **🔧 Technical Implementation**: Uses setPrimaryService(true) for AirPurifier and addLinkedService() for AirQualitySensor
  - **📱 HomeKit Impact**: Core300S devices now properly display controls (fan speed, mode, etc.) when tapped in Home app
  - **🛡️ Universal Fix**: Primary service configuration applied to all air purifiers for consistent HomeKit behavior

### Improved
- **🔍 Enhanced Service Configuration Logging**: Added comprehensive logging for service hierarchy setup debugging
  - **📊 Primary Service Tracking**: All primary service assignments now logged with device name context for troubleshooting
  - **🎯 Linked Service Detection**: Service linking operations logged with clear success confirmation messages  
  - **⚠️ Clear Notifications**: Service configuration now clearly logged for all air purifiers with hierarchy details
  - **🔧 Configuration Verification**: Detailed logging confirms proper service setup and linking for debugging purposes

### Technical Details
- **🏗️ HomeKit Service Architecture**: Proper primary/secondary service hierarchy implementation following HomeKit best practices
- **🔄 Service Priority**: AirPurifier service always set as primary to ensure control interface is displayed first
- **⚖️ Linked Services**: AirQualitySensor and other secondary services properly linked to maintain service relationships
- **📝 Code Enhancement**: Added clear comments explaining the critical nature of primary service configuration

### Affected Devices
- **Core300S** (primary fix target) - now shows controls instead of info page when tapped in HomeKit
- **All Air Purifiers** - benefit from consistent primary service configuration and proper service hierarchy
- **Multi-Service Devices** - proper service linking ensures all services remain accessible with correct display priority

### Migration Notes
- **🚀 Automatic Fix**: Service hierarchy changes will take effect automatically after Homebridge restart
- **📱 HomeKit Changes**: Core300S and other air purifiers should now show control interface when tapped in Home app
- **🔄 No Configuration**: Changes are automatic - no configuration updates required
- **✅ Verification**: Check air purifier devices in Home app to confirm control interface is displayed instead of info page

### Dependencies
- **📦 tsvesync**: Updated from 1.0.122 to 1.0.123 for synchronized release versioning

## 1.0.122 (2025-08-29)

### Fixed
- **🎯 Core300S HomeKit Tile Missing Features**: Fixed Core300S filter characteristics and mode settings not appearing in HomeKit tile
  - **✅ Filter Characteristics**: Filter characteristics now always registered for all air purifiers (matching reference implementation)
  - **🔧 Mode Switch**: Core300S auto/manual mode switcher now appears in HomeKit by using proper unified approach
  - **🛡️ Universal Setup**: Changed from conditional filter setup to always-register approach for all air purifiers
  - **📱 HomeKit Impact**: Core300S devices now properly display filter life percentage and auto/manual mode toggle in Home app
  - **🔧 Technical Fix**: Uses getCharacteristic() approach that auto-adds characteristics (like proven reference plugins)

### Improved
- **🔍 Enhanced Logging**: Added comprehensive device feature detection logging for troubleshooting
  - **📊 Feature Detection**: All hasFeature() calls now logged with device type context for debugging
  - **🎯 Device Classification**: Enhanced logging for auto mode support detection and characteristic setup
  - **⚠️ Clear Notifications**: Core300S auto mode enablement now clearly logged with success confirmation
  - **🔧 Characteristic Tracking**: Detailed logging confirms filter characteristics are registered for all air purifiers

### Technical Details
- **🏗️ Reference-Based Implementation**: Aligned implementation with proven working homebridge-levoit-air-purifier approach
- **🔄 Always-Register Pattern**: Filter characteristics now registered for ALL air purifiers without conditional logic
- **⚖️ Unified Logic**: Core300S now gets both auto and manual mode support explicitly enabled
- **📝 Simplified Code**: Removed complex conditional handling in favor of proven always-register approach

### Affected Devices
- **Core300S** (primary fix target) - filter and mode characteristics now reliably appear in HomeKit tile
- **All Air Purifiers** - benefit from unified filter characteristic setup approach
- **Core200S** - continues to work with enhanced logging and consistent setup

### Migration Notes
- **🚀 Automatic Fix**: Filter and mode characteristics will appear automatically after Homebridge restart
- **📱 HomeKit Changes**: Core300S tiles should now show filter life percentage and auto/manual mode toggle
- **🔄 No Configuration**: Changes are automatic - no configuration updates required
- **✅ Verification**: Check Core300S devices in Home app to confirm filter and mode controls are visible

### Dependencies
- **📦 tsvesync**: Updated from 1.0.121 to 1.0.122 for synchronized release versioning

## 1.0.121 (2025-08-29)

### Fixed
- **🔧 Simplified HomeKit Characteristic Setup**: Completely overhauled characteristic configuration based on working reference plugin analysis
  - **✅ Filter Characteristics**: Now using getCharacteristic() directly which auto-adds characteristics if missing (like reference plugin)
  - **🎯 Removed Complex Logic**: Eliminated special remove/re-add logic for Core200S and Core300S rotation speed handling
  - **🛡️ Unified Approach**: All devices now use the same simplified characteristic setup approach
  - **📱 HomeKit Impact**: Core300S filter and mode display issues resolved through simplified implementation
  - **🔧 Technical Enhancement**: Based on analysis of proven working homebridge-levoit-air-purifier plugin

### Improved  
- **🔍 Characteristic Configuration**: Streamlined approach eliminates duplicate and complex characteristic handling
  - **📊 Direct getCharacteristic**: Uses getCharacteristic() calls that auto-add characteristics (matching reference plugin)
  - **🎯 Consistent Setup**: Removed device-specific characteristic removal/addition logic
  - **⚠️ Simplified Code**: Eliminated complex conditional handling for different device models
  - **🔧 Proven Approach**: Aligns implementation with working reference plugin methodology

### Technical Details
- **🏗️ Reference Plugin Analysis**: Based implementation on working homebridge-levoit-air-purifier plugin approach
- **🔄 Characteristic Setup**: Uses direct getCharacteristic() calls that handle existence checking automatically  
- **⚖️ Unified Logic**: All devices use same characteristic setup pattern regardless of model
- **📝 Code Simplification**: Removed complex device-specific characteristic manipulation logic

### Affected Devices
- **Core300S** - Filter and mode characteristics now display properly through simplified setup
- **Core200S** - Benefits from unified approach while maintaining functionality
- **All devices** - More reliable and consistent characteristic setup across all models

### Dependencies
- **📦 tsvesync**: Updated from 1.0.120 to 1.0.121 (includes Core200S 4-speed level configuration fix)

## 1.0.120 (2025-08-29)

### Fixed
- **🔧 Core300S Filter and Mode Characteristics**: Comprehensive improvements to Core300S HomeKit characteristic display and device handling
  - **🎯 Enhanced Feature Detection**: Added explicit Core300S support checks for filter_life and auto_mode features with override logic
  - **✅ Characteristic Pre-Configuration**: Implemented characteristic pre-addition before handler setup to ensure HomeKit persistence
  - **🔧 Unified Speed Handling**: Added Core300S to special rotation speed handling alongside Core200S for proper characteristic rebuilding
  - **📱 HomeKit Impact**: Core300S devices now reliably display filter life percentage, mode switch (Auto/Manual), and all characteristics
  - **🛡️ Service Integrity**: Characteristic pre-addition and rebuild process ensures all features are recognized by HomeKit

### Improved
- **🔍 Enhanced Debugging**: Comprehensive diagnostic logging throughout device initialization and characteristic setup
  - **📊 Detailed Feature Logging**: All hasFeature() calls now logged at info level with device type context
  - **🎯 Device Classification**: Enhanced logging for device type detection, AirBypass status, and feature recognition
  - **⚠️ Override Warnings**: Clear warnings when Core300S feature detection is overridden to ensure proper functionality
  - **🔧 Characteristic Tracking**: Detailed logging of characteristic addition, removal, and handler setup processes

### Technical Details
- **🏗️ Characteristic Architecture**: Pre-adds FilterChangeIndication and FilterLifeLevel characteristics before handler setup
- **🔄 Service Rebuild Logic**: Core300S now uses same rotation speed rebuild process as Core200S for HomeKit compatibility
- **⚖️ Device-Specific Logic**: Enhanced Core300S and Core200S handling while maintaining compatibility with other devices
- **📝 Comprehensive Logging**: Info-level logging for all feature detection and characteristic operations

### Affected Devices
- **Core300S** (primary enhancement target) - comprehensive characteristic display improvements
- **Core200S** - continues to work with existing special handling
- **All Core series** - benefit from enhanced feature detection and debugging capabilities

### Dependencies
- **📦 tsvesync**: Updated from 1.0.119 to 1.0.120 for synchronized release versioning

## 1.0.119 (2025-08-29)

### Fixed
- **Core300S HomeKit Characteristic Display**: Fixed Core300S air purifier not displaying filter life and mode characteristics in HomeKit tile
  - **🎯 Root Cause**: Core300S was included in special rotation speed handling that was removing and re-adding the RotationSpeed characteristic, which disrupted the entire AirPurifier service
  - **✅ Solution**: Removed Core300S from the conditional on line 465 that triggers RotationSpeed characteristic removal/re-add logic
  - **🔧 Technical Fix**: Core300S now uses standard rotation speed setup, allowing filter and mode characteristics to display properly in HomeKit
  - **📱 HomeKit Impact**: Core300S devices now properly show filter life percentage and mode switch (Auto/Manual) in the Home app tile
  - **🛡️ Preserved Functionality**: Core200S continues to work with its special handling as needed for its specific requirements

### Technical Details
- **File Changed**: `src/accessories/air-purifier.accessory.ts`
- **Line Modified**: Line 465 - Updated conditional from `Core200S || Core300S` to `Core200S` only
- **Service Integrity**: Preserving service integrity for Core300S while maintaining Core200S functionality
- **Characteristic Setup**: Core300S now follows the same characteristic setup pattern as other Core series devices

### Affected Devices
- **Core300S**: Primary fix target - now properly displays all characteristics in HomeKit
- **Core200S**: Continues to work correctly with its existing special handling
- **Other Core devices**: Unaffected by this change

### Dependencies
- **📦 tsvesync**: Updated from 1.0.118 to 1.0.119 for synchronized release versioning

## 1.0.118 (2025-08-28)

### Fixed
- **Filter Characteristics Not Appearing**: Fixed Core300S filter life and mode characteristics not appearing in HomeKit despite being correctly detected
  - **🎯 Root Cause**: setupCharacteristic method uses getCharacteristic() which only works if the characteristic already exists
  - **✅ Solution**: Added explicit addCharacteristic() calls for FilterChangeIndication and FilterLifeLevel before configuring them
  - **🔧 Missing Features Restored**: Core300S now properly displays filter life percentage and change indicator in HomeKit
  - **📱 HomeKit Impact**: Filter characteristics are now visible for all air purifiers with filter_life feature
- **Core300S Mode Switch Simplified**: Removed complex remove/re-add logic for TargetAirPurifierState that was causing issues
  - **🛠️ Simplified Setup**: Now uses same characteristic setup pattern as other devices
  - **🔄 Consistent Behavior**: Mode switching (Auto/Manual) now works reliably across all device types
  - **📊 Better Logging**: Added info-level logs when creating new characteristics to track proper initialization

### Improved
- **Characteristic Addition Safety**: Added checks to prevent duplicate characteristic addition
  - **🔍 Smart Detection**: Uses testCharacteristic() to check if characteristics exist before adding
  - **⚡ Performance**: Avoids unnecessary characteristic operations
- **User Action Required**: Users may need to remove and re-add affected devices in HomeKit for new characteristics to appear

## 1.0.117 (2025-08-28)

### Fixed
- **Core300S Device Recognition**: Fixed case-sensitive device type check that prevented Core300S from being classified as AirBypass device
  - **🎯 Root Cause**: VeSync API returns device types like "Core300S" with mixed case, but code was checking for uppercase "CORE"
  - **✅ Solution**: Changed device type detection from `deviceType.includes('CORE')` to `deviceType.toUpperCase().includes('CORE')`
  - **🔧 Missing Features Restored**: Core300S now properly shows mode switch (Auto/Manual) and filter life characteristics
  - **📱 HomeKit Impact**: Core300S devices now display all expected features including mode switching and filter status
- **Enhanced Device Classification**: Applied case-insensitive fix to all device series for consistency
  - **🔄 Pattern Updates**: VITAL and EVERESTAIR device detection also made case-insensitive for preventive fixes
  - **🛡️ Future-Proofing**: Device classification now handles mixed-case device types from VeSync API
  - **🔍 Better Logging**: Added detailed device classification logging to help diagnose recognition issues

### Improved
- **Enhanced Device Logging**: Added comprehensive device type classification logging
  - **📊 Classification Details**: Now logs device type, AirBypass status, AirBaseV2 status, and Air131 status
  - **🎯 Feature Detection**: Logs which features are detected (auto_mode, filter_life) during initialization
  - **⚠️ Unknown Devices**: Unknown device classes now log warnings to help identify misconfigured devices
  - **🔧 Troubleshooting**: Enhanced logging makes it easier to diagnose device recognition and feature detection issues

### Technical Details
- **Device Type Detection**: Changed from case-sensitive `includes()` to case-insensitive `toUpperCase().includes()`
- **Applied to Series**: Core, Vital, and EverestAir device type checks now case-insensitive
- **Feature Classification**: Device classification now properly identifies Core300S as AirBypass device, enabling all features
- **Logging Enhancement**: Added comprehensive device classification and feature detection logging

### Affected Devices
- **Core300S** (primary fix target) - now properly recognized as AirBypass device
- **All Core series** devices with mixed-case type strings (preventive fix)
- **Vital series** devices (preventive case-insensitive fix)
- **EverestAir devices** (preventive case-insensitive fix)

### Verification
After updating, logs will show:
```
Device Classification for [Core300S Device Name]:
  - Device Type: "Core300S"
  - Is AirBypass: true  ← Should now be true
  - Is AirBaseV2: false
  - Is Air131: false
Features detected:
  - auto_mode: true (controls mode switch)
  - filter_life: true (controls filter display)
```

### Dependencies
- **📦 tsvesync**: Updated from 1.0.116 to 1.0.117 for synchronized release versioning

## 1.0.116 (2025-08-28)

### Fixed
- **Core300S Filter Life Detection**: Fixed Core300S and other Core series air purifiers not showing filter life characteristics due to device type detection issues
  - **🎯 Root Cause**: Some Core series devices report without the "Core" prefix (e.g., "300S" instead of "Core300S", "LAP-C301S" instead of standard pattern)
  - **✅ Solution**: Added explicit device type patterns for Core300S and other Core series models that may report without the "Core" prefix
  - **🧹 Enhanced Detection**: Improved pattern matching to catch variants like "300S", "200S", "400S", "600S" without requiring "Core" prefix
  - **🔧 Defensive Logic**: Enhanced filter life override logic to ensure all Core series devices get filter life support even if native detection fails
  - **📱 HomeKit Impact**: Core300S, LAP-C301S, LAP-C302S, and other Core series variants now properly display filter life in Home app

### Improved
- **Enhanced Device Type Detection**: Expanded device type pattern matching for Core series air purifiers
  - **📊 Pattern Matching**: Enhanced both the hasFeature override logic and fallback detection to catch all Core series variants
  - **🔍 Debugging Support**: Added detailed logging to show exact device type strings and filter feature detection results
  - **📝 Enhanced Logging**: Info-level logs now show hasFeature('filter_life') results for easier troubleshooting
  - **🎯 Filter Life Override**: Improved defensive logic to ensure all Core series devices get filter life support

### Technical Details
- **Device Type Patterns**: Added explicit checks for Core series models that may report as just model numbers
- **Logging Enhancement**: Filter life detection now shows device type in parentheses for all filter-related log messages
- **Pattern Detection**: Enhanced both override and fallback detection paths to catch device type string variations from VeSync API
- **Resilient Detection**: Filter life detection now more resilient to device type string variations

### Affected Devices
This fix ensures filter life works for all Core series variants:
- **Core200S** (and variants reporting as "200S")
- **Core300S** (and variants reporting as "300S", "LAP-C301S", "LAP-C302S")
- **Core400S** (and variants reporting as "400S")  
- **Core600S** (and variants reporting as "600S")

### Debugging
After updating, check logs for messages like:
- `[Device Name] (DeviceType): hasFeature('filter_life') returned: true/false`
- This shows the exact device type string and whether filter life is enabled

### Dependencies
- **📦 tsvesync**: Updated from 1.0.115 to 1.0.116 for synchronized release versioning

## 1.0.115 (2025-08-28)

### Fixed
- **🏠 Filter Life Display**: Fixed filter life characteristics not displaying in HomeKit by moving them from the separate FilterMaintenance service to the main AirPurifier service
  - **🎯 Root Cause**: FilterMaintenance service was not properly recognized by HomeKit, causing filter characteristics to be hidden
  - **✅ Solution**: Moved FilterChangeIndication and FilterLifeLevel characteristics directly to AirPurifier service (matches working implementations)
  - **🧹 Service Cleanup**: Automatically removes old FilterMaintenance services from cached accessories during migration
  - **📱 HomeKit Impact**: Filter life percentage and change indication now properly display in Home app on air purifier accessory

### Improved
- **🔧 Code Organization**: Created centralized `extractFilterLife()` helper method to eliminate code duplication
  - **📊 Data Parsing**: Maintains robust support for multiple filter data formats (number vs object with percent property)
  - **🎯 Error Handling**: Consistent fallback to 100% filter life for invalid or missing data
  - **🔄 State Updates**: Simplified filter characteristic updates to use main service instead of separate service
  - **📝 Logging**: Enhanced debug logging for filter service migration and characteristic setup

### Technical Details
- **🏗️ Service Architecture**: Filter characteristics now added directly to AirPurifier service instead of separate FilterMaintenance service
- **⚖️ Specification Trade-off**: This approach violates HomeKit specification but works correctly in practice (confirmed by reference implementations)
- **🔔 Filter Alerts**: Filter change indication still triggers at <10% life remaining as per HomeKit standards
- **🎛️ Device Compatibility**: All currently supported devices maintain correct filter_life feature mapping

### Affected Devices
All air purifiers with filter life support now properly display filter status in HomeKit:
- **Core Series**: Core200S, Core300S, Core400S, Core600S
- **LAP Series**: LAP-C201S, LAP-C301S, LAP-C401S, LAP-C601S, LAP-V102S, LAP-V201S, and all other LAP models
- **Legacy Models**: LV-PUR131S, LV-RH131S
- **📊 Filter Data**: Supports both numeric and object-based filter life formats from VeSync API

### Migration Notes
- **🚀 Homebridge Restart Required**: Filter life display requires Homebridge restart after update
- **🧹 Automatic Cleanup**: Old FilterMaintenance services will be automatically removed from cached accessories
- **📱 Home App Changes**: Filter life will now appear directly on the air purifier accessory instead of a separate service
- **✅ Zero Config**: No configuration changes required - migration is fully automatic

### Dependencies
- **📦 tsvesync**: Updated from 1.0.114 to 1.0.115 for synchronized release versioning

## 1.0.114 (2025-08-28)

### Fixed
- **Air Quality Sensor Detection**: Resolved issue where air purifiers without physical air quality sensors were incorrectly showing air quality characteristics in HomeKit
  - **🎯 Devices Fixed**: Core200S, Core Mini, Core P350, Vital 100/100S, Vista 200, LV-H128, LV-H132, LV-RH131S no longer show phantom air quality services
  - **🔧 Root Cause**: API proxy was wrapping synchronous methods like `hasFeature()` as async functions, causing them to return Promises instead of boolean values
  - **✅ Solution**: Fixed `hasFeature()` method in api-proxy.ts to return synchronous boolean values, ensuring proper feature detection
  - **🧹 Cache Cleanup**: Properly removes cached air quality services from accessories that don't support air quality sensors

### Changed
- **Logging Improvements**: Reduced verbose air quality diagnostic logging from warning to debug level
  - **📝 Impact**: Normal operation logs are cleaner while diagnostic information remains available in debug mode
  - **🔍 Debug Access**: Enable debug logging in Homebridge config to see detailed air quality detection information
  - **📊 Log Categories**: Changed 5 warning-level diagnostic messages to debug level for quieter operation

### Technical Details
- **Proxy Enhancement**: Enhanced API proxy to handle synchronous method bypassing correctly
- **Service Management**: Improved accessory service caching and cleanup for devices without air quality sensors
- **Feature Detection**: Restored proper boolean return values for device capability checking methods

### HomeKit Integration Notes
- **🏠 User Impact**: Air purifiers without air quality sensors no longer show confusing "unavailable" air quality readings in Home app
- **⚡ Performance**: No performance impact - fix maintains all existing functionality while correcting erroneous service exposure
- **🔄 Automatic**: Update will automatically clean up phantom services on next Homebridge restart

### Migration Notes
- **🚀 Seamless Update**: No configuration changes required - phantom services are automatically removed
- **📋 Verification Steps**:
  1. Update plugin to v1.0.114
  2. Restart Homebridge
  3. Check affected devices in Home app - air quality should only appear on devices that actually have sensors
  4. Enable debug logging if you want to see detailed feature detection information

### Dependencies
- Updated tsvesync from 1.0.113 to 1.0.114 for synchronized release versioning

## 1.0.113 (2025-08-28)

### Fixed
- **🚨 CRITICAL STABILITY FIX - v1.0.112 Crash Resolution**: Fixed crash issue introduced in v1.0.112 while maintaining Core 200S air quality fix
  - **🐛 The v1.0.112 Problem**: Attempted to return original function directly for bypassed methods, but this caused crashes when:
    - The function value might be undefined or not properly bound
    - Direct returns could break the proxy chain or cause type errors
    - Bypassed methods lost proper execution context leading to runtime failures
  - **✅ The v1.0.113 Solution**: Now returns a **synchronous wrapper function** instead of direct return:
    ```javascript
    // SAFE: Always returns a callable function
    return function(...args) {  // NOT async!
      return value.apply(target, args);
    };
    ```
  - **🎯 Benefits**: 
    - Always returns a callable function (prevents crashes)
    - Synchronous wrapper ensures `hasFeature()` returns `boolean`, not `Promise<boolean>`
    - Properly binds execution context with `apply()`
    - Maintains Core 200S air quality fix from v1.0.112
  - **📱 Impact**: Eliminates crashes while preserving correct air quality detection for all devices

### Changed
- **Enhanced Proxy Safety**: Improved bypass method handling in API proxy architecture
  - Replaced potentially unsafe direct function returns with guaranteed synchronous wrappers
  - Maintained performance benefits of bypassing rate limiting for configuration methods
  - Ensured all bypassed methods return proper types (boolean, number, string) not Promises
  - Improved code robustness and error prevention in proxy chain

### Dependencies
- Updated tsvesync from 1.0.112 to 1.0.113 for version synchronization

### HomeKit Integration Notes
- **🎉 STABLE OPERATION**: This release resolves the crashes introduced in v1.0.112
- **✅ Core 200S Still Fixed**: The Core 200S air quality phantom service fix remains active and working
- **⚠️ RECOMMENDED UPDATE**: Critical stability fix - highly recommended for all v1.0.112 users
- **🔄 No Manual Action**: Simply update and restart Homebridge - all functionality preserved

### Breaking Changes
- **None**: This is a critical stability fix with no API or configuration changes

### Migration Notes
- **🚀 Immediate Update Recommended**: Update from v1.0.112 to v1.0.113 to resolve crash issues
- **📋 Verification Steps**:
  1. Update the plugin to v1.0.113
  2. Restart Homebridge completely
  3. Verify stable operation without crashes
  4. Confirm Core 200S devices still work without phantom air quality services
- **⚡ Same Functionality**: All features from v1.0.112 maintained with improved stability

## 1.0.112 (2025-08-28)

### Fixed
- **🚨 CRITICAL FIX - Core 200S Air Quality Issue**: Fixed the definitive root cause that v1.0.111 missed
  - **🐛 The Remaining Bug**: In v1.0.111, we added `hasFeature` to the bypass list, but the bypass check was still happening INSIDE the async function wrapper
  - **⚙️ The Problem**: Even "bypassed" methods were first wrapped in async functions, then checked for bypass - so `hasFeature('air_quality')` still returned `Promise<boolean>` instead of `boolean`
  - **✅ The REAL Solution**: Moved the bypass check BEFORE creating the async wrapper in `api-proxy.ts`
    - Check if method is in bypass list FIRST, before any wrapping
    - If bypassed, return the original function directly (not wrapped in async)
    - Only wrap non-bypassed methods in async functions for rate limiting
  - **🎯 Result**: `hasFeature('air_quality')` now returns actual `boolean` values, not `Promise<boolean>`
  - **📱 Impact**: Core 200S and other devices without air quality sensors will finally work correctly

### Changed
- **API Proxy Architecture Enhancement**: Completely restructured the bypass logic flow
  - Bypass check now happens at the proxy level before any async wrapping
  - Configuration and feature detection methods return synchronously as intended
  - Rate limiting wrapper only applied to actual API methods
  - Improved code organization and method categorization

### Removed
- **Debug Logging**: Removed diagnostic comments that were added during investigation
  - Clean code without investigation artifacts
  - Focused implementation without temporary debugging elements

### Dependencies
- Updated tsvesync from 1.0.111 to 1.0.112 for version synchronization

### HomeKit Integration Notes
- **🎉 DEFINITIVE FIX**: This release contains the REAL fix for the Core 200S air quality phantom service issue
- **⚠️ RESTART REQUIRED**: Must restart Homebridge after updating for the fix to take effect
- **🗑️ Automatic Cleanup**: Phantom air quality services will be automatically removed after restart
- **✅ Verified Working**: Core 200S, LAP-C201S, LAP-C202S, LAP-C301S, LAP-C302S, LAP-C401S, LAP-C601S will no longer show phantom air quality characteristics
- **🔍 Confirmed Devices**: Core 300S+, Vital series, and EverestAir devices with actual sensors continue working correctly

### Breaking Changes
- **None**: This is a critical bug fix release with no breaking changes to the API or configuration

### Migration Notes
- **🚀 Simple Update**: Update to v1.0.112 and restart Homebridge - the fix is automatic and immediate
- **📋 Verification Steps**:
  1. Update the plugin to v1.0.112
  2. Restart Homebridge completely
  3. Check Home app - Core 200S should no longer show air quality tile
  4. Verify only devices with actual sensors show air quality characteristics
- **⏰ No Additional Setup**: The fix is implemented at the code level and requires no configuration changes

## 1.0.111 (2025-08-28)

### Fixed
- **🔧 Core 200S Air Quality Detection Bug**: Fixed the definitive root cause of the Core 200S air quality sensor issue
  - **The Bug**: `hasFeature('air_quality')` was returning a `Promise<boolean>` instead of a synchronous `boolean` because the API proxy wrapped ALL device methods as async functions for rate limiting
  - **The Problem**: Since `Promise` objects are always truthy when evaluated in boolean contexts, ALL devices appeared to have air quality sensors, causing phantom air quality services to be created for devices like Core 200S that don't have physical sensors
  - **The Solution**: Added configuration and feature detection methods to the proxy bypass list in `api-proxy.ts` since they don't make API calls and should return synchronously
  - **Methods Added to Bypass**: `hasFeature`, `getMaxFanSpeed`, `isFeatureSupportedInCurrentMode`, and property getters: `mode`, `filterLife`, `airQuality`, `airQualityValue`, `screenStatus`, `childLock`, `pm1`, `pm10`, `humidity`, `mistLevel`
  - **Impact**: Core 200S, LAP-C201S, LAP-C202S, LAP-C301S, LAP-C302S, LAP-C401S, LAP-C601S and other devices without physical air quality sensors will no longer show phantom air quality characteristics in HomeKit
  - **Devices Confirmed Working**: Core 300S, Core 400S, Core 600S, Vital100S, Vital200S, and EverestAir devices with actual air quality sensors continue to work correctly

### Changed
- **API Proxy Architecture**: Improved the rate limiting proxy to distinguish between API methods and configuration methods
  - Configuration methods that don't make network calls now bypass all rate limiting and return synchronously
  - API methods continue to be rate limited and debounced as before
  - Enhanced method categorization for better performance and reliability

### Removed
- **Diagnostic Logging**: Removed the enhanced diagnostic logging added in v1.0.110 as the root cause has been identified and fixed
  - No longer needed now that the underlying Promise/boolean issue has been resolved
  - Reduces log noise for normal operation

### Dependencies
- Updated tsvesync from 1.0.110 to 1.0.111 for version synchronization

### HomeKit Integration Notes
- **✅ Definitive Fix**: This release contains the definitive fix for the Core 200S air quality phantom service issue
- **🏠 Correct HomeKit Behavior**: Devices without physical air quality sensors will no longer show air quality characteristics in the Home app
- **📱 No Manual Action Required**: The fix is automatic and will take effect after plugin restart
- **🔄 Service Cleanup**: Phantom air quality services will be automatically removed during the next HomeKit accessory initialization

### Breaking Changes
- **None**: This is a bug fix release with no breaking changes to the API or configuration

### Migration Notes
- **✅ Automatic Fix**: Simply update to v1.0.111 and restart Homebridge - the fix is automatic
- **🗑️ Service Cleanup**: If you had phantom air quality services, they will be removed automatically after restart
- **📋 Verification**: Check your Home app - devices like Core 200S should no longer show air quality tiles
- **🔍 Device Support**: Only devices with actual hardware air quality sensors (Core 300S+, Vital series, EverestAir) will show air quality characteristics

## 1.0.110 (2025-08-28)

### Added
- **Enhanced Diagnostic Logging**: Added comprehensive diagnostic logging to identify Core 200S air quality detection issues
  - Enhanced logging in air purifier accessory to show exact device types alongside device names
  - Added detailed debugging for hasFeature('air_quality') method calls with device type information
  - Added warning logs specifically for Core 200S variants that incorrectly report air quality support
  - Improved service removal logic with better reference tracking and validation
  - Added defensive checks to detect and warn about inconsistent air quality sensor reporting

### Changed
- **Air Quality Debugging**: Enhanced air quality feature detection logging
  - All air quality related logs now include both device name and device type for better identification
  - Added extra debugging specifically for Core200S and LAP-C20 device variants
  - Improved logging granularity to help identify root cause of phantom air quality services
  - Enhanced hasFeature() debug output to show library configuration decisions with device context

### Fixed
- **Diagnostic Capabilities**: Improved diagnostic capabilities for troubleshooting air quality sensor detection
  - Enhanced debugging to identify why some Core 200S devices still show air quality characteristics
  - Better tracking of device type information in all air quality related logging
  - Improved warning detection for devices that shouldn't have air quality sensors but report having them
  - Enhanced service setup logging to track air quality service creation and removal decisions

### Dependencies
- Updated tsvesync from 1.0.109 to 1.0.110 for version synchronization

### HomeKit Integration Notes
- **Diagnostic Release**: This is a diagnostic release focused on identifying the root cause of Core 200S air quality issues
- **Enhanced Logging**: Users will see more detailed logging in Homebridge logs for air quality feature detection
- **Troubleshooting**: The enhanced logging will help identify why some Core 200S devices incorrectly show air quality services
- **No Breaking Changes**: All existing functionality remains unchanged with enhanced diagnostic capabilities

### Migration Notes
- **No Action Required**: This is a diagnostic release that maintains all existing functionality
- **Enhanced Debugging**: Users experiencing Core 200S air quality issues will see more detailed logging information
- **Log Monitoring**: Check Homebridge logs for warning messages about Core 200S devices with air quality sensors
- **Issue Reporting**: The enhanced logging will provide better information for troubleshooting and issue reports

## 1.0.109 (2025-08-28)

### Fixed
- **Air Quality Service Logic**: Fixed air quality service removal logic for Core 200S and other devices without sensors
  - Added proper tracking and clearing of air quality service references to prevent cached services
  - Enhanced defensive checks to remove cached air quality services from devices without sensors
  - Added early detection warnings for misconfigured devices during accessory initialization
  - Improved updateDeviceState() logic to handle service removal for devices without air quality support
  - Ensures cached HomeKit services are properly cleaned up when device capabilities change
  - Specifically addresses Core 200S devices that were incorrectly showing air quality characteristics
  - Added comprehensive service reference management throughout the accessory lifecycle

### Changed
- **Enhanced Air Quality Validation**: Improved air quality service management and validation
  - Better separation between devices that support air quality sensors vs those that don't
  - Enhanced logging to identify when cached services are found and removed
  - Improved service cleanup during both initialization and runtime state updates
  - More robust handling of service references to prevent phantom air quality services

### Dependencies
- Updated tsvesync from 1.0.108 to 1.0.109 for version synchronization

### HomeKit Integration Notes
- **Improved Service Accuracy**: Core 200S and similar devices without air quality sensors now properly exclude air quality services
- **Better Cache Management**: Cached air quality services are automatically detected and removed from incompatible devices
- **Enhanced Reliability**: Improved service lifecycle management prevents phantom services from appearing
- **Device-Specific Features**: Each device model now correctly reflects its actual sensor capabilities without cached service interference

### Migration Notes
- **Automatic Fix**: The service cleanup logic will automatically remove inappropriate air quality services
- **Core 200S Users**: Your device will no longer show unavailable air quality characteristics in HomeKit
- **No Configuration Required**: Changes are automatic and based on device hardware specifications
- **Improved Stability**: Better service management improves overall accessory reliability

## 1.0.108 (2025-08-28)

### Fixed
- **Air Quality Feature Detection**: Improved air quality service detection to properly respect tsvesync library configuration
  - Removed problematic fallback logic that checked for data presence instead of device capabilities
  - Added trust in tsvesync library's hasFeature() method for proper air quality sensor detection
  - Added service removal logic for devices that shouldn't have air quality sensors
  - Added defensive checks during device state updates to prevent air quality errors
  - Ensures devices without hardware air quality sensors (Core200S, LAP-C series, LV-RH131S) won't show air quality in HomeKit
  - Fixes issue where air quality service appeared for devices lacking physical sensors
  - Improves reliability of air quality feature detection across different device models

### Changed
- **Device Feature Detection**: Enhanced air quality feature validation
  - Now properly validates device capabilities before creating air quality services
  - Improved error handling for devices with inconsistent air quality data
  - Better alignment with tsvesync library's device capability detection

### Dependencies
- Updated tsvesync from 1.0.107 to 1.0.108 for version synchronization

### HomeKit Integration Notes
- **Enhanced Accuracy**: Air quality services now only appear for devices with actual hardware sensors
- **Better Reliability**: Reduced errors and improved stability for air quality monitoring
- **Device-Specific Features**: Each device model now correctly reflects its actual sensor capabilities
- **No Configuration Required**: Changes are automatic and based on device hardware specifications

### Migration Notes
- **No Action Required**: Air quality service improvements are automatic based on device capabilities
- **Service Updates**: Devices without air quality sensors will no longer show air quality services after restart
- **Enhanced Reliability**: Devices with air quality sensors benefit from improved error handling and validation

## 1.0.107 (2025-08-28)

### Fixed
- **Air Quality Sensor Configuration**: Enhanced device compatibility with accurate air quality sensor detection
  - Inherits air quality sensor configuration fixes from tsvesync v1.0.107
  - Removed air quality service for devices without physical sensors (LAP-C series, Core200S, LV-RH131S)
  - Kept air quality service for devices with confirmed hardware sensors (Core300S/400S/600S, Vital series, EverestAir series, LV-PUR131S)
  - HomeKit now only displays air quality data for devices that actually support it
  - Eliminates user confusion from non-functional air quality readings and invalid sensor data
  - Improves device accuracy and prevents HomeKit showing "unavailable" air quality characteristics

### Dependencies
- Updated tsvesync from 1.0.106 to 1.0.107 for air quality sensor configuration fixes

### HomeKit Integration Notes
- **Improved Device Accuracy**: Air quality services now only appear for devices with actual hardware sensors
- **Better User Experience**: Eliminates confusing "unavailable" air quality readings in Home app
- **Device-Specific Features**: Each device model now correctly reflects its actual sensor capabilities
- **No Configuration Required**: Changes are automatic and based on device hardware specifications

### Migration Notes
- **No Action Required**: Air quality service changes are automatic based on device capabilities
- **Existing Functionality**: All other device features remain unchanged
- **Service Updates**: Devices without air quality sensors will no longer show air quality services after restart
- **Enhanced Accuracy**: Devices with air quality sensors continue to work with improved reliability

## 1.0.106 (2025-08-26)

### Fixed
- **CRITICAL: International Account Device Discovery**: Fixed device discovery for international accounts
  - Inherits critical endpoint switching bug fix from tsvesync v1.0.106
  - After successful authentication, maintains the endpoint that authenticated successfully
  - Fixes AU/NZ/Asia-Pacific accounts that authenticate via EU endpoint
  - Resolves "no devices found" issues for international users whose accounts authenticate via unexpected regional endpoints
  - International users should now see their devices properly in HomeKit

### Dependencies
- Updated tsvesync from 1.0.105 to 1.0.106 for critical international account fix

### Migration Notes
- **International Users**: This release should resolve device discovery issues
- **All Users**: No configuration changes required - the fix is automatic
- If you were experiencing device discovery issues, restart Homebridge to apply the fix

## 1.0.105 (2025-08-26)

### Changed
- **Improved Country Code UI**: Country list now sorted alphabetically for easier navigation
  - Users can now quickly find their country in the Homebridge UI dropdown
  - All 76 countries remain available, just in alphabetical order
  - Makes configuration significantly more user-friendly for international users

## 1.0.104 (2025-08-26)

### Added
- **Country Code Configuration**: New country code setting for international account support
  - Added comprehensive country code dropdown in Homebridge UI with 80+ countries
  - Full list of country names mapped to ISO country codes for easy selection
  - Smart endpoint selection based on country codes (EU countries → EU endpoint, others → US endpoint)
  - Default country code set to 'US' for backward compatibility

### Fixed
- **International Authentication**: Complete fix for accounts worldwide
  - Australian and New Zealand accounts now authenticate correctly with US endpoint + country codes
  - All Asia-Pacific accounts (JP, SG, CN, KR) now work properly
  - European accounts continue to work with EU endpoint
  - Fixed constructor issues with country code parameter passing

### Changed
- **Enhanced Error Messages**: Improved user guidance for authentication issues
  - Clear instructions when country code configuration is needed
  - Helpful error messages listing common country codes (AU, NZ, JP, etc.)
  - Warning messages for country code mismatches with specific fix instructions
  - Better cross-region error handling with actionable guidance

### Documentation
- Added comprehensive International Account Support section to README
- Added country code configuration instructions with examples
- Added troubleshooting guide for country code related errors
- Updated configuration examples to include country code field

### Dependencies
- Updated tsvesync from 1.0.103 to 1.0.104 for international account support

### Migration Notes
- **US Users**: No action required - default 'US' country code maintains backward compatibility
- **International Users**: Set your country code in Homebridge UI or config.json for proper authentication
- **EU Users**: Continue to work automatically with EU country codes
- **AU/NZ Users**: Must set country code to 'AU' or 'NZ' respectively

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
