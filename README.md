# homebridge-tsvesync

This is a Homebridge plugin that allows you to control your VeSync/Levoit/Etekcity devices through HomeKit. It provides native HomeKit integration for a wide range of VeSync-enabled devices.

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

## Troubleshooting

1. Make sure your VeSync credentials are correct
2. Check the Homebridge logs for any error messages
3. Ensure your devices are properly set up in the VeSync app
4. Verify your devices are running the latest firmware
5. Check that your devices are online in the VeSync app

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
