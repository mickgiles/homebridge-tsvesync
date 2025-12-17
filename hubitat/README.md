# VeSync Integration for Hubitat

This Hubitat integration provides support for VeSync/Levoit/Etekcity smart home devices.

## Supported Devices

### Air Purifiers
- Core200S, Core300S, Core400S, Core600S
- Vital100S, Vital200S
- LAP-C201S, LAP-C202S, LAP-C301S, LAP-C302S, LAP-C401S, LAP-C601S
- LAP-V201S, LAP-EL551S
- LV-PUR131S, LV-RH131S

### Humidifiers
- Classic200S, Classic300S
- Dual200S, LV600S
- OasisMist, OasisMist600S, OasisMist1000S
- Superior6000S
- LUH and LEH series

### Smart Bulbs
- ESL100 (Basic White)
- ESL100CW (Tunable White)
- ESL100MC (RGB Color)
- XYD0001 (RGB Color)

### Smart Outlets
- ESO15-TB, ESW15-USA
- ESW03-USA, ESW01-EU, ESW10-USA
- wifi-switch-1.3

### Fans
- LTF-F422S series (Tower Fans)

### Wall Switches & Dimmers
- ESWL01, ESWL03 (Basic Switches)
- ESWD16 (Dimmer with RGB Indicator)

## Installation

### Step 1: Install the App

1. Go to **Apps Code** in your Hubitat hub
2. Click **+ New App**
3. Copy and paste the contents of `apps/vesync-integration.groovy`
4. Click **Save**

### Step 2: Install the Drivers

For each driver you need, repeat the following:

1. Go to **Drivers Code** in your Hubitat hub
2. Click **+ New Driver**
3. Copy and paste the contents of the driver file
4. Click **Save**

**Required drivers based on your devices:**
- `vesync-air-purifier.groovy` - For air purifiers
- `vesync-humidifier.groovy` - For humidifiers
- `vesync-light.groovy` - For smart bulbs
- `vesync-outlet.groovy` - For smart outlets
- `vesync-fan.groovy` - For tower fans
- `vesync-switch.groovy` - For basic wall switches
- `vesync-dimmer.groovy` - For dimmer switches
- `vesync-air-quality-sensor.groovy` - For air quality monitoring (auto-created for compatible purifiers)

### Step 3: Configure the App

1. Go to **Apps** in your Hubitat hub
2. Click **+ Add User App**
3. Select **VeSync Integration**
4. Enter your VeSync credentials:
   - Email address
   - Password
   - Country code
5. Click **Test Authentication** to verify
6. Go to **Manage Devices** to discover and install your devices

## Features

### Device Discovery
The app automatically discovers all VeSync devices associated with your account. You can select which devices to install.

### Automatic Polling
Device states are automatically updated at a configurable interval (default: 2 minutes).

### Device Capabilities

#### Air Purifiers
- On/Off control
- Fan speed control (1-4 levels)
- Mode selection (Manual, Auto, Sleep, Pet, Turbo)
- Air quality monitoring (PM2.5, PM10)
- Filter life tracking
- Child lock control
- Display on/off

#### Humidifiers
- On/Off control
- Target humidity setting (30-80%)
- Mist level control
- Mode selection (Manual, Auto, Sleep)
- Current humidity reading
- Water level monitoring
- Night light control

#### Smart Bulbs
- On/Off control
- Brightness (0-100%)
- Color temperature (2700K-6500K)
- RGB color control (for color bulbs)

#### Smart Outlets
- On/Off control
- Power monitoring (watts)
- Voltage monitoring
- Energy tracking (kWh)

#### Fans
- On/Off control
- Speed control (1-12 levels)
- Oscillation control
- Mode selection (Normal, Auto, Sleep, Turbo)
- Timer support

### Exclusions
You can exclude devices by:
- Device type (purifier, humidifier, bulb, etc.)
- Device name (comma-separated list)

## Troubleshooting

### Authentication Issues
- Verify your VeSync email and password
- Ensure you selected the correct country
- Try clicking "Re-authenticate" in the app

### Devices Not Discovered
- Click "Discover Devices" in the device management page
- Check that your devices appear in the VeSync mobile app
- Verify the device types aren't excluded in settings

### Device Not Responding
- Check the device's connection status in the VeSync app
- Try clicking "Refresh" on the device page
- Verify your hub has internet connectivity

### Debug Logging
Enable debug logging in the app or driver preferences to see detailed logs:
1. Open the app or device
2. Enable "Debug Logging"
3. Check Logs for detailed information

## API Information

This integration communicates with the VeSync cloud API. The following endpoints are used:
- US: `https://smartapi.vesync.com`
- EU: `https://smartapi.vesync.eu`

The integration uses JWT token authentication with automatic refresh before expiration.

## Version History

### 1.0.0
- Initial release
- Support for air purifiers, humidifiers, bulbs, outlets, fans, and switches
- Automatic device discovery
- JWT token management with auto-refresh
- Configurable polling interval
- Device exclusion support

## License

Apache License 2.0
