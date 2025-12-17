/**
 *  VeSync Humidifier
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
 *  VeSync Humidifier Driver
 *
 *  Supports: Classic200S, Classic300S, Dual200S, LV600S, OasisMist series, Superior6000S
 *
 */

import groovy.transform.Field

@Field static final String VERSION = "1.0.0"

metadata {
    definition(name: "VeSync Humidifier", namespace: "vesync", author: "VeSync Hubitat Integration") {
        capability "Switch"
        capability "RelativeHumidityMeasurement"
        capability "Refresh"
        capability "Actuator"
        capability "Sensor"

        // Custom attributes
        attribute "mode", "string"
        attribute "targetHumidity", "number"
        attribute "mistLevel", "number"
        attribute "waterLevel", "string"
        attribute "nightLightBrightness", "number"
        attribute "childLock", "string"
        attribute "display", "string"
        attribute "autoStop", "string"
        attribute "deviceStatus", "string"

        // Commands
        command "setTargetHumidity", [[name: "Humidity*", type: "NUMBER", description: "Target humidity (30-80%)", range: "30..80"]]
        command "setMistLevel", [[name: "Level*", type: "NUMBER", description: "Mist level (1-9)", range: "1..9"]]
        command "setMode", [[name: "Mode*", type: "ENUM", constraints: ["manual", "auto", "sleep"]]]
        command "mistLevelUp"
        command "mistLevelDown"
        command "setChildLock", [[name: "State*", type: "ENUM", constraints: ["on", "off"]]]
        command "setDisplay", [[name: "State*", type: "ENUM", constraints: ["on", "off"]]]
        command "setNightLight", [[name: "Brightness*", type: "NUMBER", description: "Night light brightness (0-100)", range: "0..100"]]
        command "setAutoStop", [[name: "State*", type: "ENUM", constraints: ["on", "off"]]]
    }

    preferences {
        input name: "logEnable", type: "bool", title: "Enable debug logging", defaultValue: false
        input name: "txtEnable", type: "bool", title: "Enable description text logging", defaultValue: true
        input name: "maxMistLevel", type: "number", title: "Maximum Mist Level", defaultValue: 9, range: "1..9"
        input name: "minHumidity", type: "number", title: "Minimum Target Humidity", defaultValue: 30, range: "0..100"
        input name: "maxHumidity", type: "number", title: "Maximum Target Humidity", defaultValue: 80, range: "0..100"
    }
}

def installed() {
    log.info "VeSync Humidifier installed"
    initialize()
}

def updated() {
    log.info "VeSync Humidifier updated"
    initialize()
}

def initialize() {
    if (logEnable) runIn(1800, "logsOff")

    // Set default target humidity if not set
    if (device.currentValue("targetHumidity") == null) {
        sendEvent(name: "targetHumidity", value: 50, unit: "%")
    }
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

// Humidity Control
def setTargetHumidity(humidity) {
    def min = settings.minHumidity ?: 30
    def max = settings.maxHumidity ?: 80
    humidity = Math.max(min, Math.min(max, humidity.toInteger()))

    logDebug "Setting target humidity to ${humidity}%"
    parent.childSetTargetHumidity(device.deviceNetworkId, humidity)
    sendEvent(name: "targetHumidity", value: humidity, unit: "%")

    // Ensure device is on
    if (device.currentValue("switch") != "on") {
        sendEvent(name: "switch", value: "on")
    }
}

// Mist Level Control
def setMistLevel(level) {
    def max = settings.maxMistLevel ?: 9
    level = Math.max(1, Math.min(max, level.toInteger()))

    logDebug "Setting mist level to ${level}"
    parent.childSetMistLevel(device.deviceNetworkId, level)
    sendEvent(name: "mistLevel", value: level)

    // Ensure device is on
    if (device.currentValue("switch") != "on") {
        sendEvent(name: "switch", value: "on")
    }
}

def mistLevelUp() {
    def current = device.currentValue("mistLevel") ?: 1
    def max = settings.maxMistLevel ?: 9
    if (current < max) {
        setMistLevel(current + 1)
    }
}

def mistLevelDown() {
    def current = device.currentValue("mistLevel") ?: 2
    if (current > 1) {
        setMistLevel(current - 1)
    }
}

// Mode Control
def setMode(mode) {
    logDebug "Setting mode to ${mode}"
    parent.childSetMode(device.deviceNetworkId, mode)
    sendEvent(name: "mode", value: mode)

    // Ensure device is on
    if (device.currentValue("switch") != "on") {
        sendEvent(name: "switch", value: "on")
    }
}

// Child Lock
def setChildLock(state) {
    logDebug "Setting child lock to ${state}"
    parent.childSetChildLock(device.deviceNetworkId, state)
    sendEvent(name: "childLock", value: state)
}

// Display Control
def setDisplay(state) {
    logDebug "Setting display to ${state}"
    parent.childSetDisplay(device.deviceNetworkId, state)
    sendEvent(name: "display", value: state)
}

// Night Light
def setNightLight(brightness) {
    brightness = Math.max(0, Math.min(100, brightness.toInteger()))
    logDebug "Setting night light brightness to ${brightness}"

    // Night light control varies by model - some use 0-100, some use levels
    def params = [brightness: brightness]
    parent.sendDeviceCommand(device.deviceNetworkId, "setNightLight", params)
    sendEvent(name: "nightLightBrightness", value: brightness)
}

// Auto Stop
def setAutoStop(state) {
    logDebug "Setting auto stop to ${state}"
    def enabled = state == "on" || state == true
    parent.sendDeviceCommand(device.deviceNetworkId, "setAutoStop", [state: enabled])
    sendEvent(name: "autoStop", value: state)
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
