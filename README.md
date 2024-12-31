# homebridge-tsvesync

This is a Homebridge plugin that allows you to control your TSVESync devices through HomeKit.

## Installation

1. Install Homebridge if you haven't already (see [homebridge.io](https://homebridge.io))
2. Install this plugin: `npm install -g homebridge-tsvesync`
3. Update your Homebridge configuration file to add the platform (see Configuration section below)

## Configuration

Add the following to your Homebridge `config.json`:

```json
{
    "platforms": [
        {
            "platform": "TSVESyncPlatform",
            "name": "TSVESync",
            "username": "YOUR_USERNAME",
            "password": "YOUR_PASSWORD"
        }
    ]
}
```

### Configuration Options

* `platform` (required): Must be set to "TSVESyncPlatform"
* `name` (required): Can be anything, this is the name that will appear in your Homebridge log
* `username` (required): Your TSVESync account username
* `password` (required): Your TSVESync account password

## Features

* Automatically discovers all your TSVESync devices
* Supports turning devices on and off
* Real-time status updates

## Development

* Clone this repository
* Install dependencies: `npm install`
* Build the plugin: `npm run build`
* Link it to your local Homebridge installation: `npm link`

## Troubleshooting

1. Make sure your TSVESync credentials are correct
2. Check the Homebridge logs for any error messages
3. Ensure your devices are properly set up in the TSVESync app

## License

MIT 