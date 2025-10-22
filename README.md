# homebridge-tsvesync

This is a Homebridge plugin that allows you to control your VeSync/Levoit/Etekcity devices through HomeKit. It provides native HomeKit integration for a wide range of VeSync-enabled devices.

## 🆕 Recent Updates

- **ESWD16 Toggle Parity (v1.3.12)**: HomeKit power buttons now drive the real dimmer toggle API and restore the previous brightness, keeping the slider and wall plate in sync.
- **ESWD16 Improvements (v1.3.11)**: Dimmer tiles now use the new tsvesync bypass API, restoring reliable on/off control and removing the phantom colour widget for this white-only switch.
- **ESL Bulb Reliability (v1.3.10)**: Updated to tsvesync 1.3.10 so ESL100/ESL100CW/ESL100MC track the latest payloads for brightness and colour adjustments.
- **International Account Support**: Full support for accounts worldwide! Australian, New Zealand, European, and Asian users can now authenticate successfully
- **Country Code Configuration**: New country code dropdown in Homebridge UI for easy international account setup
- **Enhanced Authentication**: Supports the new VeSync authentication flow (pyvesync PR #340) with automatic fallback to legacy authentication
- **Regional API Support**: Automatic detection and routing for US and EU regional endpoints
- **Improved Error Messages**: Clear guidance when authentication fails, including specific instructions for country code configuration

## Supported Devices

### Air Purifiers
All air purifiers are exposed as HomeKit air purifiers with the following features:
- Core200S, Core300S, Core400S, Core600S
  * On/Off control
  * Fan speed control
  * Filter life monitoring
  * Auto/Manual/Sleep mode selection
  * Air quality monitoring (300S/400S/600S only)

- LV-PUR131S
  * On/Off control
  * Air quality monitoring
  * Filter life monitoring

- Vital100S, Vital200S
  * On/Off control
  * Fan speed control (1-4)
  * Mode selection (Manual, Auto, Sleep, Pet)
  * Air quality monitoring
  * Filter life monitoring

- EverestAir
  * On/Off control
  * Fan speed control (1-3)
  * Mode selection (Manual, Auto, Sleep, Turbo)
  * Air quality monitoring
  * Filter life monitoring

### Humidifiers
All humidifiers are exposed as HomeKit humidifiers with the following features:
- Classic300S, Classic200S
  * On/Off control
  * Target humidity setting
  * Current humidity reading
  * Auto/Manual mode selection
  * Mist level control (1-9)
  * Night light control (300S only)

- Dual200S
  * On/Off control
  * Target humidity setting
  * Current humidity reading
  * Auto/Manual mode selection
  * Mist level control (1-2)

- LV600S, OasisMist Series, Superior6000S
  * On/Off control
  * Target humidity setting
  * Current humidity reading
  * Mode selection (Auto/Manual/Sleep)
  * Mist level control
  * Warm mist control (where supported)
  * Night light control (where supported)

### Smart Bulbs
All bulbs are exposed as HomeKit lights with their respective capabilities:
- ESL100
  * On/Off control
  * Brightness control

- ESL100CW
  * On/Off control
  * Brightness control
  * Color temperature control

- ESL100MC, XYD0001
  * On/Off control
  * Brightness control
  * Full RGB color control
  * Color temperature control

### Smart Outlets
All outlets are exposed as HomeKit outlets with the following features:
- 15A Outlets (ESO15-TB, ESW15-USA)
  * On/Off control
  * Power/Energy monitoring
  * Voltage monitoring

- 10A Outlets (ESW03-USA, ESW01-EU, ESW10-USA)
  * On/Off control
  * Power/Energy monitoring
  * Voltage monitoring

- 7A Outlet (wifi-switch-1.3)
  * On/Off control
  * Basic energy usage tracking

### Tower Fans
- LTF-F422S Series
  * On/Off control
  * Fan speed control (1-12)
  * Mode selection (Normal, Auto, Sleep, Turbo)
  * Oscillation control

### Wall Switches
- ESWL01
  - Basic on/off control
  - Status monitoring
- ESWL03
  - Basic on/off control
  - Status monitoring
- ESWD16
  - Dimming control
  - RGB indicator light control
  - Status monitoring

## Installation

1. Install Homebridge if you haven't already (see [homebridge.io](https://homebridge.io))
2. Install this plugin:
   ```bash
   npm install -g homebridge-tsvesync
   ```
3. Configure the plugin in your Homebridge `config.json`

## Configuration

Add the following to your Homebridge `config.json`:

```json
{
    "platforms": [
        {
            "platform": "TSVESyncPlatform",
            "name": "TSVESync",
            "username": "YOUR_VESYNC_EMAIL",
            "password": "YOUR_VESYNC_PASSWORD",
            "countryCode": "US",
            "updateInterval": 30,
            "debug": false,
            "exclude": {
                "type": ["fan", "outlet"],
                "model": ["Core300S", "LV600S"],
                "name": ["Living Room Light"],
                "namePattern": ["Bedroom.*"],
                "id": ["cid123456"]
            }
        }
    ]
}
```

### Configuration Options

* `platform` (required): Must be set to "TSVESyncPlatform"
* `name` (required): Can be anything, this is the name that will appear in your Homebridge log
* `username` (required): Your VeSync account email
* `password` (required): Your VeSync account password
* `countryCode` (optional): Your country code - **IMPORTANT for international users!** (default: "US")
  * Use the dropdown in Homebridge UI to select your country
  * Must match the country where your VeSync account was created
  * See [International Account Support](#international-account-support) section below
* `updateInterval` (optional): How often to update device states in seconds (default: 300)
* `debug` (optional): Enable debug logging (default: false)

### Device Exclusions

You can exclude specific devices from being added to HomeKit using the `exclude` configuration. All exclusion options are optional and can be combined:

* `type`: Array of device types to exclude. Valid types are:
  * `fan` - All fan devices
  * `outlet` - All outlet devices
  * `switch` - All switch devices
  * `bulb` - All light bulb devices
  * `purifier` - All air purifier devices
  * `humidifier` - All humidifier devices

* `model`: Array of device models to exclude. Examples:
  * `Core300S` - Levoit Core 300S Air Purifier
  * `LV600S` - Levoit LV600S Humidifier
  * `ESL100` - Etekcity ESL100 Light Bulb

* `name`: Array of exact device names to exclude (case-sensitive)
  * Matches the name shown in the VeSync app
  * Must match exactly (including spaces and case)
  * Example: `["Living Room Light", "Bedroom Fan"]`

* `namePattern`: Array of regex patterns to match device names
  * Uses JavaScript regular expressions
  * Case-sensitive matching
  * Examples:
    * `"Bedroom.*"` - Excludes all devices with names starting with "Bedroom"
    * `".*Light"` - Excludes all devices with names ending in "Light"
    * `"(Kitchen|Living Room).*"` - Excludes all devices with names starting with "Kitchen" or "Living Room"

* `id`: Array of device IDs to exclude
  * Can use either the device's `cid` or `uuid`
  * Useful for excluding specific devices when you have multiple of the same model
  * You can find the ID in the VeSync app or Homebridge logs

Example configuration with all exclusion options:
```json
{
    "platforms": [
        {
            "platform": "TSVESyncPlatform",
            "name": "TSVESync",
            "username": "YOUR_VESYNC_EMAIL",
            "password": "YOUR_VESYNC_PASSWORD",
            "exclude": {
                "type": ["fan", "outlet"],
                "model": ["Core300S", "LV600S"],
                "name": ["Living Room Light", "Kitchen Outlet"],
                "namePattern": ["Bedroom.*", ".*Nightlight"],
                "id": ["cid123456", "cid789012"]
            }
        }
    ]
}
```

## Features

* Automatic device discovery
* Real-time status updates
* Native HomeKit integration
* Power consumption monitoring (supported outlets)
* Air quality monitoring (supported purifiers)
* Humidity control (supported humidifiers)
* RGB and white color control (supported bulbs)
* Fan speed and mode control (purifiers and fans)

## International Account Support

### Important for Non-US Users

If your VeSync account was created outside the United States, you **must** configure your country code for authentication to work properly.

#### How to Configure Your Country Code

**Option 1: Using Homebridge UI (Recommended)**
1. Navigate to your Homebridge UI
2. Go to the TSVESync plugin settings
3. Click on the "Country Code" dropdown
4. Select your country from the list
5. Save and restart Homebridge

**Option 2: Manual Configuration**
Add the `countryCode` field to your config.json:

```json
{
    "platforms": [
        {
            "platform": "TSVESyncPlatform",
            "name": "TSVESync",
            "username": "YOUR_EMAIL",
            "password": "YOUR_PASSWORD",
            "countryCode": "AU"  // Replace with your country code
        }
    ]
}
```

#### Common Country Codes

**Americas (US endpoint):**
- 🇺🇸 United States: `US` (default)
- 🇨🇦 Canada: `CA`
- 🇲🇽 Mexico: `MX`

**Europe (EU endpoint):**
- 🇬🇧 United Kingdom: `GB`
- 🇩🇪 Germany: `DE`
- 🇫🇷 France: `FR`
- 🇮🇹 Italy: `IT`
- 🇪🇸 Spain: `ES`
- 🇳🇱 Netherlands: `NL`
- 🇸🇪 Sweden: `SE`
- 🇳🇴 Norway: `NO`
- 🇩🇰 Denmark: `DK`
- 🇫🇮 Finland: `FI`
- 🇵🇱 Poland: `PL`
- All other European countries

**Asia-Pacific (US endpoint):**
- 🇦🇺 Australia: `AU`
- 🇳🇿 New Zealand: `NZ`
- 🇯🇵 Japan: `JP`
- 🇸🇬 Singapore: `SG`
- 🇨🇳 China: `CN`
- 🇰🇷 South Korea: `KR`

#### How It Works

1. **European accounts** are automatically routed to the EU endpoint (`smartapi.vesync.eu`)
2. **All other accounts** use the US endpoint (`smartapi.vesync.com`)
3. The country code must match where your VeSync account was created
4. If you see "country code mismatch" errors, you need to set your country code

#### Common Error Messages and Solutions

**"COUNTRY CODE MISMATCH DETECTED"**
- Solution: Set your country code in the plugin configuration

**"Both US and EU endpoints rejected your account"**
- Solution: You must specify your country code - the plugin cannot automatically detect it

**"Cross-region error"**
- Solution: Your account is trying to authenticate with the wrong regional endpoint. Set your country code.

## Troubleshooting

### Authentication Issues

If you're experiencing authentication problems, you can test your credentials and determine your authentication type using the included test script:

```bash
# Test your VeSync authentication
./scripts/vesync-auth-test.sh

# Or provide credentials directly
./scripts/vesync-auth-test.sh user@example.com password

# For detailed output
./scripts/vesync-auth-test.sh -v
```

The script will:
- Test both NEW and LEGACY authentication methods
- Detect your account's regional endpoint (US/EU)
- Provide clear recommendations for configuration
- Show any error codes with explanations

### Common Issues

1. **Authentication Failed**
   - **For international users**: Check if you need to set your country code (see [International Account Support](#international-account-support))
   - Verify your VeSync credentials are correct
   - Try logging into the VeSync app to confirm they work
   - Run the authentication test script to diagnose issues

2. **"Country Code Mismatch" or "Cross-Region Error"**
   - You need to configure your country code in the plugin settings
   - See the [International Account Support](#international-account-support) section above
   - The country code must match where your VeSync account was created

3. **Devices Not Appearing**
   - Check the Homebridge logs for any error messages
   - Ensure your devices are properly set up in the VeSync app
   - Verify your devices are running the latest firmware
   - For international users, ensure your country code is set correctly

4. **Regional Issues**
   - The plugin automatically routes to the correct endpoint based on your country code
   - EU accounts (with EU country codes) use `smartapi.vesync.eu`
   - All other accounts use `smartapi.vesync.com`
   - Australian/NZ users: Use your country code (AU/NZ) with the US endpoint

5. **API Rate Limiting**
   - The plugin includes automatic rate limiting
   - If you see quota errors, increase the `updateInterval` in your config
   - Premium accounts have higher quotas than free accounts

6. **General Tips**
   - Check that your devices are online in the VeSync app
   - Enable debug mode to see detailed API communication
   - Restart Homebridge after changing configuration

## Development

* Clone this repository
* Install dependencies: `npm install`
* Build the plugin: `npm run build`
* Link it to your local Homebridge installation: `npm link`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Credits

This plugin uses the [tsvesync](https://github.com/mickgiles/tsvesync) library for device communication. 
