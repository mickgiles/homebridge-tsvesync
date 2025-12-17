/**
 *  VeSync Air Quality Sensor
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
 *  VeSync Air Quality Sensor Driver
 *
 *  Standalone air quality sensor for purifiers with AQ monitoring
 *  (Core300S, Core400S, Core600S, Vital100S, Vital200S, LAP-C/V/EL series)
 *
 */

import groovy.transform.Field

@Field static final String VERSION = "1.0.0"

// Air Quality Index Thresholds (based on PM2.5)
@Field static final Map AQ_LEVELS = [
    excellent: [max: 12, index: 1],
    good: [max: 35, index: 2],
    fair: [max: 55, index: 3],
    inferior: [max: 150, index: 4],
    veryPoor: [max: 1000, index: 5]
]

metadata {
    definition(name: "VeSync Air Quality Sensor", namespace: "vesync", author: "VeSync Hubitat Integration") {
        capability "AirQuality"
        capability "Sensor"
        capability "Refresh"

        // Custom attributes
        attribute "pm25", "number"
        attribute "pm10", "number"
        attribute "airQualityLevel", "string"
        attribute "airQualityDescription", "string"
        attribute "lastUpdate", "string"
    }

    preferences {
        input name: "logEnable", type: "bool", title: "Enable debug logging", defaultValue: false
        input name: "txtEnable", type: "bool", title: "Enable description text logging", defaultValue: true
        input name: "aqAlertThreshold", type: "enum", title: "Air Quality Alert Threshold",
            defaultValue: "fair",
            options: ["excellent": "Excellent (>12 PM2.5)", "good": "Good (>35 PM2.5)",
                     "fair": "Fair (>55 PM2.5)", "inferior": "Inferior (>150 PM2.5)", "none": "No alerts"]
    }
}

def installed() {
    log.info "VeSync Air Quality Sensor installed"
    initialize()
}

def updated() {
    log.info "VeSync Air Quality Sensor updated"
    initialize()
}

def initialize() {
    if (logEnable) runIn(1800, "logsOff")
}

def logsOff() {
    log.warn "Debug logging disabled"
    device.updateSetting("logEnable", [value: "false", type: "bool"])
}

// Update air quality readings (called from parent app)
def updateAirQuality(pm25, pm10 = null) {
    logDebug "Updating air quality: PM2.5=${pm25}, PM10=${pm10}"

    // PM2.5
    if (pm25 != null) {
        pm25 = pm25.toDouble()
        sendEvent(name: "pm25", value: pm25, unit: "μg/m³")

        // Calculate AQI and level
        def aqData = calculateAirQuality(pm25)
        sendEvent(name: "airQualityIndex", value: aqData.index)
        sendEvent(name: "airQualityLevel", value: aqData.level)
        sendEvent(name: "airQualityDescription", value: aqData.description)

        // Check for alerts
        checkAirQualityAlert(pm25, aqData.level)
    }

    // PM10 (if available)
    if (pm10 != null) {
        sendEvent(name: "pm10", value: pm10.toDouble(), unit: "μg/m³")
    }

    // Update timestamp
    sendEvent(name: "lastUpdate", value: new Date().format("yyyy-MM-dd HH:mm:ss"))
}

def calculateAirQuality(pm25) {
    def level
    def index
    def description

    if (pm25 <= AQ_LEVELS.excellent.max) {
        level = "excellent"
        index = AQ_LEVELS.excellent.index
        description = "Air quality is excellent. Safe for all activities."
    } else if (pm25 <= AQ_LEVELS.good.max) {
        level = "good"
        index = AQ_LEVELS.good.index
        description = "Air quality is good. Acceptable for most people."
    } else if (pm25 <= AQ_LEVELS.fair.max) {
        level = "fair"
        index = AQ_LEVELS.fair.index
        description = "Air quality is moderate. Sensitive groups may experience effects."
    } else if (pm25 <= AQ_LEVELS.inferior.max) {
        level = "inferior"
        index = AQ_LEVELS.inferior.index
        description = "Air quality is unhealthy. Limit outdoor activities."
    } else {
        level = "veryPoor"
        index = AQ_LEVELS.veryPoor.index
        description = "Air quality is very unhealthy. Avoid outdoor activities."
    }

    return [level: level, index: index, description: description]
}

def checkAirQualityAlert(pm25, currentLevel) {
    def threshold = settings.aqAlertThreshold ?: "fair"

    if (threshold == "none") return

    def thresholdValue = AQ_LEVELS[threshold]?.max ?: 55

    if (pm25 > thresholdValue) {
        def previousLevel = state.previousAqLevel

        // Only alert on transition to worse air quality
        if (previousLevel != currentLevel) {
            logInfo "Air quality alert: PM2.5 is ${pm25} μg/m³ (${currentLevel})"

            // You could add notification sending here if desired
            // sendPush("Air quality alert: ${device.label} PM2.5 is ${pm25}")
        }
    }

    state.previousAqLevel = currentLevel
}

// Get human-readable air quality level
def getAirQualityText() {
    def level = device.currentValue("airQualityLevel")
    def pm25 = device.currentValue("pm25")

    return "${level?.capitalize() ?: 'Unknown'} (PM2.5: ${pm25 ?: '--'} μg/m³)"
}

// Refresh
def refresh() {
    logDebug "Refreshing air quality sensor"

    // Get parent device CID
    def parentCid = getDataValue("parentCid")
    if (parentCid) {
        parent.refreshChildDevice([cid: parentCid])
    }
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
