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

- 10A Outlets (ESW03-USA, ESW01-EU)
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
            "password": "YOUR_VESYNC_PASSWORD"
        }
    ]
}
```

### Configuration Options

* `platform` (required): Must be set to "TSVESyncPlatform"
* `name` (required): Can be anything, this is the name that will appear in your Homebridge log
* `username` (required): Your VeSync account email
* `password` (required): Your VeSync account password

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