/**
 *  VeSync Air Purifier
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
 *  VeSync Air Purifier Driver
 *
 *  Supports: Core200S, Core300S, Core400S, Core600S, Vital100S, Vital200S, LAP-C/V/EL series, LV-PUR131S
 *
 */

import groovy.transform.Field

@Field static final String VERSION = "1.0.0"

metadata {
    definition(name: "VeSync Air Purifier", namespace: "vesync", author: "VeSync Hubitat Integration") {
        capability "Switch"
        capability "FanControl"
        capability "Refresh"
        capability "Actuator"
        capability "Sensor"

        // Custom attributes
        attribute "mode", "string"
        attribute "speed", "number"
        attribute "speedLevel", "number"
        attribute "filterLife", "number"
        attribute "airQuality", "string"
        attribute "airQualityIndex", "number"
        attribute "pm25", "number"
        attribute "pm10", "number"
        attribute "childLock", "string"
        attribute "display", "string"
        attribute "deviceStatus", "string"

        // Commands
        command "setSpeed", [[name: "Speed Level*", type: "NUMBER", description: "Fan speed level (1-4)"]]
        command "setMode", [[name: "Mode*", type: "ENUM", constraints: ["manual", "auto", "sleep", "pet", "turbo"]]]
        command "speedUp"
        command "speedDown"
        command "setChildLock", [[name: "State*", type: "ENUM", constraints: ["on", "off"]]]
        command "setDisplay", [[name: "State*", type: "ENUM", constraints: ["on", "off"]]]
        command "cycleSpeed"
    }

    preferences {
        input name: "logEnable", type: "bool", title: "Enable debug logging", defaultValue: false
        input name: "txtEnable", type: "bool", title: "Enable description text logging", defaultValue: true
        input name: "maxSpeed", type: "number", title: "Maximum Speed Level", defaultValue: 4, range: "1..12"
    }
}

def installed() {
    log.info "VeSync Air Purifier installed"
    initialize()
}

def updated() {
    log.info "VeSync Air Purifier updated"
    initialize()
}

def initialize() {
    if (logEnable) runIn(1800, "logsOff")
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

// FanControl Capability
def setSpeed(speed) {
    if (speed instanceof String) {
        // Handle standard fan speed names
        switch(speed.toLowerCase()) {
            case "off":
                off()
                return
            case "on":
            case "auto":
                setMode("auto")
                return
            case "low":
                setSpeedLevel(1)
                return
            case "medium-low":
                setSpeedLevel(2)
                return
            case "medium":
                def max = settings.maxSpeed ?: 4
                setSpeedLevel(Math.round(max / 2))
                return
            case "medium-high":
                def max = settings.maxSpeed ?: 4
                setSpeedLevel(Math.round(max * 0.75))
                return
            case "high":
                setSpeedLevel(settings.maxSpeed ?: 4)
                return
        }
    }

    // Numeric speed (percentage)
    def max = settings.maxSpeed ?: 4
    def level = Math.round((speed / 100.0) * max)
    level = Math.max(1, Math.min(max, level))
    setSpeedLevel(level)
}

def setSpeedLevel(level) {
    def max = settings.maxSpeed ?: 4
    level = Math.max(1, Math.min(max, level.toInteger()))

    logDebug "Setting speed level to ${level}"
    parent.childSetSpeed(device.deviceNetworkId, level)

    sendEvent(name: "speedLevel", value: level)
    sendEvent(name: "speed", value: Math.round((level / max) * 100))

    // Update fan speed name
    def speedName = getSpeedName(level, max)
    sendEvent(name: "fanSpeed", value: speedName)

    // Ensure device is on when setting speed
    if (device.currentValue("switch") != "on") {
        sendEvent(name: "switch", value: "on")
    }
}

def getSpeedName(level, max) {
    def ratio = level / max
    if (ratio <= 0.25) return "low"
    if (ratio <= 0.5) return "medium-low"
    if (ratio <= 0.75) return "medium-high"
    return "high"
}

def speedUp() {
    def current = device.currentValue("speedLevel") ?: 1
    def max = settings.maxSpeed ?: 4
    if (current < max) {
        setSpeedLevel(current + 1)
    }
}

def speedDown() {
    def current = device.currentValue("speedLevel") ?: 2
    if (current > 1) {
        setSpeedLevel(current - 1)
    }
}

def cycleSpeed() {
    def current = device.currentValue("speedLevel") ?: 0
    def max = settings.maxSpeed ?: 4

    def next = current + 1
    if (next > max) next = 1

    setSpeedLevel(next)
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
