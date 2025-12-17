/**
 *  VeSync Outlet
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
 *  VeSync Smart Outlet Driver
 *
 *  Supports: ESO15-TB, ESW15-USA, ESW03-USA, ESW01-EU, ESW10-USA, wifi-switch-1.3
 *  Features: Power monitoring (watts, voltage, energy)
 *
 */

import groovy.transform.Field

@Field static final String VERSION = "1.0.0"

metadata {
    definition(name: "VeSync Outlet", namespace: "vesync", author: "VeSync Hubitat Integration") {
        capability "Switch"
        capability "Outlet"
        capability "PowerMeter"
        capability "VoltageMeasurement"
        capability "EnergyMeter"
        capability "Refresh"
        capability "Actuator"
        capability "Sensor"

        // Custom attributes
        attribute "amperage", "number"
        attribute "outletInUse", "string"
        attribute "deviceStatus", "string"
        attribute "nightLightStatus", "string"
        attribute "nightLightMode", "string"

        // Commands
        command "resetEnergy"
        command "setNightLightMode", [[name: "Mode*", type: "ENUM", constraints: ["auto", "manual", "off"]]]
    }

    preferences {
        input name: "logEnable", type: "bool", title: "Enable debug logging", defaultValue: false
        input name: "txtEnable", type: "bool", title: "Enable description text logging", defaultValue: true
        input name: "powerThreshold", type: "number", title: "Power Threshold for 'In Use' (watts)",
            defaultValue: 5, range: "0..100",
            description: "Power level above which outlet is considered 'in use'"
        input name: "energyReportInterval", type: "enum", title: "Energy Report Interval",
            defaultValue: "daily",
            options: ["hourly": "Hourly", "daily": "Daily", "weekly": "Weekly", "monthly": "Monthly"]
    }
}

def installed() {
    log.info "VeSync Outlet installed"
    initialize()
}

def updated() {
    log.info "VeSync Outlet updated"
    initialize()
}

def initialize() {
    if (logEnable) runIn(1800, "logsOff")

    // Initialize energy tracking
    if (state.lastEnergyReset == null) {
        state.lastEnergyReset = now()
    }

    // Schedule energy logging based on preference
    scheduleEnergyLogging()
}

def logsOff() {
    log.warn "Debug logging disabled"
    device.updateSetting("logEnable", [value: "false", type: "bool"])
}

def scheduleEnergyLogging() {
    unschedule("logEnergyUsage")

    switch(settings.energyReportInterval) {
        case "hourly":
            schedule("0 0 * * * ?", "logEnergyUsage")
            break
        case "daily":
            schedule("0 0 0 * * ?", "logEnergyUsage")
            break
        case "weekly":
            schedule("0 0 0 ? * SUN", "logEnergyUsage")
            break
        case "monthly":
            schedule("0 0 0 1 * ?", "logEnergyUsage")
            break
    }
}

def logEnergyUsage() {
    def energy = device.currentValue("energy") ?: 0
    logInfo "Energy usage: ${energy} kWh since ${new Date(state.lastEnergyReset).format('yyyy-MM-dd HH:mm')}"
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

// Energy Reset
def resetEnergy() {
    logDebug "Resetting energy counter"
    state.lastEnergyReset = now()
    state.energyAtReset = device.currentValue("energy") ?: 0
    sendEvent(name: "energy", value: 0, unit: "kWh")
    logInfo "Energy counter reset"
}

// Night Light Control (some outlets have RGB night lights)
def setNightLightMode(mode) {
    logDebug "Setting night light mode to ${mode}"
    parent.sendDeviceCommand(device.deviceNetworkId, "setNightLightMode", [mode: mode])
    sendEvent(name: "nightLightMode", value: mode)
}

// Power Monitoring Event Handler (called from parent)
def updatePowerMetrics(power, voltage, energy) {
    // Power in watts
    if (power != null) {
        sendEvent(name: "power", value: power, unit: "W")

        // Calculate amperage if we have voltage
        if (voltage && voltage > 0) {
            def amperage = power / voltage
            sendEvent(name: "amperage", value: Math.round(amperage * 100) / 100, unit: "A")
        }

        // Update outlet in use status
        def threshold = settings.powerThreshold ?: 5
        def inUse = power > threshold ? "true" : "false"
        sendEvent(name: "outletInUse", value: inUse)
    }

    // Voltage
    if (voltage != null) {
        sendEvent(name: "voltage", value: voltage, unit: "V")
    }

    // Energy in kWh
    if (energy != null) {
        // Adjust for reset
        def adjustedEnergy = energy
        if (state.energyAtReset) {
            adjustedEnergy = energy - state.energyAtReset
        }
        sendEvent(name: "energy", value: Math.round(adjustedEnergy * 1000) / 1000, unit: "kWh")
    }
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
