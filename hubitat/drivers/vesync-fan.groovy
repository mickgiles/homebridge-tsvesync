/**
 *  VeSync Fan
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
 *  VeSync Tower Fan Driver
 *
 *  Supports: LTF-F422S series tower fans
 *
 */

import groovy.transform.Field

@Field static final String VERSION = "1.0.0"

metadata {
    definition(name: "VeSync Fan", namespace: "vesync", author: "VeSync Hubitat Integration") {
        capability "Switch"
        capability "FanControl"
        capability "Refresh"
        capability "Actuator"

        // Custom attributes
        attribute "mode", "string"
        attribute "speedLevel", "number"
        attribute "oscillation", "string"
        attribute "childLock", "string"
        attribute "display", "string"
        attribute "timer", "number"
        attribute "deviceStatus", "string"

        // Commands
        command "setSpeed", [[name: "Speed*", type: "ENUM", constraints: ["off", "low", "medium-low", "medium", "medium-high", "high", "auto"]]]
        command "setSpeedLevel", [[name: "Level*", type: "NUMBER", description: "Speed level (1-12)"]]
        command "setMode", [[name: "Mode*", type: "ENUM", constraints: ["normal", "auto", "sleep", "turbo"]]]
        command "setOscillation", [[name: "State*", type: "ENUM", constraints: ["on", "off"]]]
        command "setChildLock", [[name: "State*", type: "ENUM", constraints: ["on", "off"]]]
        command "setDisplay", [[name: "State*", type: "ENUM", constraints: ["on", "off"]]]
        command "setTimer", [[name: "Hours*", type: "NUMBER", description: "Timer in hours (0-12)", range: "0..12"]]
        command "speedUp"
        command "speedDown"
        command "cycleSpeed"
        command "toggleOscillation"
    }

    preferences {
        input name: "logEnable", type: "bool", title: "Enable debug logging", defaultValue: false
        input name: "txtEnable", type: "bool", title: "Enable description text logging", defaultValue: true
        input name: "maxSpeed", type: "number", title: "Maximum Speed Level", defaultValue: 12, range: "1..12"
    }
}

def installed() {
    log.info "VeSync Fan installed"
    initialize()
}

def updated() {
    log.info "VeSync Fan updated"
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
                setSpeedLevel(3)
                return
            case "medium":
                def max = settings.maxSpeed ?: 12
                setSpeedLevel(Math.round(max / 2))
                return
            case "medium-high":
                def max = settings.maxSpeed ?: 12
                setSpeedLevel(Math.round(max * 0.75))
                return
            case "high":
                setSpeedLevel(settings.maxSpeed ?: 12)
                return
        }
    }

    // Numeric speed (percentage 0-100)
    def max = settings.maxSpeed ?: 12
    def level = Math.round((speed / 100.0) * max)
    level = Math.max(1, Math.min(max, level))
    setSpeedLevel(level)
}

def setSpeedLevel(level) {
    def max = settings.maxSpeed ?: 12
    level = Math.max(1, Math.min(max, level.toInteger()))

    logDebug "Setting speed level to ${level}"
    parent.childSetSpeed(device.deviceNetworkId, level)

    sendEvent(name: "speedLevel", value: level)
    sendEvent(name: "speed", value: Math.round((level / max) * 100))

    // Update fan speed name for FanControl capability
    def speedName = getSpeedName(level, max)
    sendEvent(name: "fanSpeed", value: speedName)

    // Ensure device is on when setting speed
    if (device.currentValue("switch") != "on") {
        sendEvent(name: "switch", value: "on")
    }

    // Set to normal mode when manually changing speed
    sendEvent(name: "mode", value: "normal")
}

def getSpeedName(level, max) {
    def ratio = level / max
    if (ratio <= 0.2) return "low"
    if (ratio <= 0.4) return "medium-low"
    if (ratio <= 0.6) return "medium"
    if (ratio <= 0.8) return "medium-high"
    return "high"
}

def speedUp() {
    def current = device.currentValue("speedLevel") ?: 1
    def max = settings.maxSpeed ?: 12
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
    def max = settings.maxSpeed ?: 12

    // Cycle through low -> medium -> high -> low
    def next
    if (current <= max / 3) {
        next = Math.round(max / 2)
    } else if (current <= max * 2 / 3) {
        next = max
    } else {
        next = 1
    }

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

// Oscillation
def setOscillation(state) {
    logDebug "Setting oscillation to ${state}"
    parent.childSetOscillation(device.deviceNetworkId, state)
    sendEvent(name: "oscillation", value: state)
}

def toggleOscillation() {
    def current = device.currentValue("oscillation") ?: "off"
    setOscillation(current == "on" ? "off" : "on")
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

// Timer
def setTimer(hours) {
    hours = Math.max(0, Math.min(12, hours.toInteger()))
    logDebug "Setting timer to ${hours} hours"

    parent.sendDeviceCommand(device.deviceNetworkId, "setTimer", [hours: hours])
    sendEvent(name: "timer", value: hours)

    if (hours > 0) {
        // Schedule to update timer status
        runIn(hours * 3600, "timerExpired")
    } else {
        unschedule("timerExpired")
    }
}

def timerExpired() {
    logInfo "Timer expired"
    sendEvent(name: "timer", value: 0)
    sendEvent(name: "switch", value: "off")
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
