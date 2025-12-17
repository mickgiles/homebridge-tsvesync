/**
 *  VeSync Light
 *
 *  Copyright 2024
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License. You may obtain a copy of the License at:
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 *  for the specific language governing permissions and limitations under the License.
 *
 *  VeSync Light/Bulb Driver
 *
 *  Supports: ESL100, ESL100CW, ESL100MC, XYD0001, ESWD16 (dimmer)
 *
 */

import groovy.transform.Field
import hubitat.helper.ColorUtils

@Field static final String VERSION = "1.0.0"

// Color temperature range
@Field static final Integer CT_MIN_KELVIN = 2700
@Field static final Integer CT_MAX_KELVIN = 6500

metadata {
    definition(name: "VeSync Light", namespace: "vesync", author: "VeSync Hubitat Integration") {
        capability "Switch"
        capability "SwitchLevel"
        capability "ColorControl"
        capability "ColorTemperature"
        capability "ColorMode"
        capability "Refresh"
        capability "Actuator"
        capability "Light"
        capability "ChangeLevel"

        // Custom attributes
        attribute "deviceStatus", "string"
        attribute "effectName", "string"

        // Commands
        command "setColorTemperatureKelvin", [[name: "Temperature*", type: "NUMBER", description: "Color temperature in Kelvin (2700-6500)"]]
        command "startLevelChange", [[name: "Direction*", type: "ENUM", constraints: ["up", "down"]]]
        command "stopLevelChange"
        command "presetLevel", [[name: "Level*", type: "NUMBER", description: "Preset brightness level 1-100"]]
    }

    preferences {
        input name: "logEnable", type: "bool", title: "Enable debug logging", defaultValue: false
        input name: "txtEnable", type: "bool", title: "Enable description text logging", defaultValue: true
        input name: "transitionTime", type: "number", title: "Transition Time (seconds)", defaultValue: 0, range: "0..10"
        input name: "levelChangeStep", type: "number", title: "Level Change Step Size", defaultValue: 10, range: "1..25"
        input name: "prestaging", type: "bool", title: "Enable Level Prestaging", defaultValue: false,
            description: "Allow level changes while off without turning on"
    }
}

def installed() {
    log.info "VeSync Light installed"
    initialize()
}

def updated() {
    log.info "VeSync Light updated"
    initialize()
}

def initialize() {
    if (logEnable) runIn(1800, "logsOff")
    sendEvent(name: "colorMode", value: "CT")
}

def logsOff() {
    log.warn "Debug logging disabled"
    device.updateSetting("logEnable", [value: "false", type: "bool"])
}

// Switch Capability
def on() {
    logDebug "Turning on"
    parent.childOn(device.deviceNetworkId)
    sendEvent(name: "switch", value: "on")
}

def off() {
    logDebug "Turning off"
    parent.childOff(device.deviceNetworkId)
    sendEvent(name: "switch", value: "off")
}

// SwitchLevel Capability
def setLevel(level, duration = null) {
    level = Math.max(0, Math.min(100, level.toInteger()))

    if (level == 0) {
        off()
        return
    }

    logDebug "Setting level to ${level}%"
    parent.childSetBrightness(device.deviceNetworkId, level)
    sendEvent(name: "level", value: level, unit: "%")

    // Turn on if not prestaging
    if (!settings.prestaging || level > 0) {
        if (device.currentValue("switch") != "on") {
            sendEvent(name: "switch", value: "on")
        }
    }
}

// ChangeLevel Capability
def startLevelChange(direction) {
    logDebug "Starting level change: ${direction}"
    state.levelChangeDirection = direction
    state.levelChangeRunning = true
    doLevelChange()
}

def stopLevelChange() {
    logDebug "Stopping level change"
    state.levelChangeRunning = false
    unschedule("doLevelChange")
}

def doLevelChange() {
    if (!state.levelChangeRunning) return

    def currentLevel = device.currentValue("level") ?: 50
    def step = settings.levelChangeStep ?: 10

    if (state.levelChangeDirection == "up") {
        currentLevel = Math.min(100, currentLevel + step)
    } else {
        currentLevel = Math.max(1, currentLevel - step)
    }

    setLevel(currentLevel)

    if ((state.levelChangeDirection == "up" && currentLevel < 100) ||
        (state.levelChangeDirection == "down" && currentLevel > 1)) {
        runIn(1, "doLevelChange")
    } else {
        state.levelChangeRunning = false
    }
}

// ColorTemperature Capability
def setColorTemperature(kelvin, level = null, transitionTime = null) {
    kelvin = Math.max(CT_MIN_KELVIN, Math.min(CT_MAX_KELVIN, kelvin.toInteger()))

    logDebug "Setting color temperature to ${kelvin}K"
    parent.childSetColorTemperature(device.deviceNetworkId, kelvin)
    sendEvent(name: "colorTemperature", value: kelvin, unit: "K")
    sendEvent(name: "colorMode", value: "CT")

    // Also set level if provided
    if (level != null) {
        setLevel(level)
    } else if (device.currentValue("switch") != "on") {
        sendEvent(name: "switch", value: "on")
    }
}

def setColorTemperatureKelvin(kelvin) {
    setColorTemperature(kelvin)
}

// ColorControl Capability
def setColor(colorMap) {
    logDebug "Setting color: ${colorMap}"

    def hue = colorMap.hue != null ? colorMap.hue : device.currentValue("hue") ?: 0
    def saturation = colorMap.saturation != null ? colorMap.saturation : device.currentValue("saturation") ?: 100
    def level = colorMap.level != null ? colorMap.level : device.currentValue("level") ?: 100

    // Convert Hubitat hue (0-100) to degrees (0-360)
    def hueDegrees = Math.round(hue * 3.6)

    parent.childSetColor(device.deviceNetworkId, hueDegrees, saturation, level)

    sendEvent(name: "hue", value: hue)
    sendEvent(name: "saturation", value: saturation)
    sendEvent(name: "level", value: level, unit: "%")
    sendEvent(name: "colorMode", value: "RGB")

    if (device.currentValue("switch") != "on") {
        sendEvent(name: "switch", value: "on")
    }

    // Update color name
    def colorName = getColorName(hue)
    sendEvent(name: "colorName", value: colorName)
}

def setHue(hue) {
    setColor([hue: hue])
}

def setSaturation(saturation) {
    setColor([saturation: saturation])
}

def getColorName(hue) {
    // Convert Hubitat hue (0-100) to approximate color name
    def hueDegrees = hue * 3.6

    if (hueDegrees < 15 || hueDegrees >= 345) return "Red"
    if (hueDegrees < 45) return "Orange"
    if (hueDegrees < 75) return "Yellow"
    if (hueDegrees < 105) return "Yellow-Green"
    if (hueDegrees < 135) return "Green"
    if (hueDegrees < 165) return "Green-Cyan"
    if (hueDegrees < 195) return "Cyan"
    if (hueDegrees < 225) return "Blue-Cyan"
    if (hueDegrees < 255) return "Blue"
    if (hueDegrees < 285) return "Blue-Magenta"
    if (hueDegrees < 315) return "Magenta"
    return "Magenta-Red"
}

// Preset Level (for scenes/automations)
def presetLevel(level) {
    level = Math.max(0, Math.min(100, level.toInteger()))
    logDebug "Presetting level to ${level}%"

    // Store the level without turning on
    state.presetLevel = level
    sendEvent(name: "level", value: level, unit: "%")
}

// Refresh
def refresh() {
    logDebug "Refreshing device status"
    parent.refreshChildDevice([cid: device.deviceNetworkId])
}

// Helper methods
def logDebug(msg) {
    if (logEnable) log.debug "${device.label ?: device.name}: ${msg}"
}

def logInfo(msg) {
    if (txtEnable) log.info "${device.label ?: device.name}: ${msg}"
}

// Parse method for handling events from parent
def parse(String description) {
    logDebug "parse: ${description}"
}
