/**
 *  VeSync Integration
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
 *  VeSync Integration - Parent App
 *
 *  Integrates VeSync/Levoit/Etekcity smart home devices into Hubitat
 *  Supports: Air Purifiers, Humidifiers, Smart Bulbs, Outlets, Fans, and Switches
 *
 */

import groovy.json.JsonSlurper
import groovy.json.JsonOutput
import groovy.transform.Field
import java.security.MessageDigest

@Field static final String VERSION = "1.0.0"
@Field static final String NAMESPACE = "vesync"

// API Endpoints
@Field static final String API_BASE_URL_US = "https://smartapi.vesync.com"
@Field static final String API_BASE_URL_EU = "https://smartapi.vesync.eu"

// EU Country Codes
@Field static final List<String> EU_COUNTRIES = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
    "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "GB"]

// Device Type Mappings
@Field static final Map DEVICE_TYPE_MAP = [
    // Air Purifiers
    "Core200S": "purifier", "Core300S": "purifier", "Core400S": "purifier", "Core600S": "purifier",
    "Vital100S": "purifier", "Vital200S": "purifier",
    "LAP-C201S": "purifier", "LAP-C202S": "purifier", "LAP-C301S": "purifier", "LAP-C302S": "purifier",
    "LAP-C401S": "purifier", "LAP-C601S": "purifier",
    "LAP-V201S": "purifier", "LAP-EL551S": "purifier",
    "LV-PUR131S": "purifier", "LV-RH131S": "purifier",
    // Humidifiers
    "Classic200S": "humidifier", "Classic300S": "humidifier",
    "Dual200S": "humidifier", "LV600S": "humidifier",
    "OasisMist": "humidifier", "OasisMist600S": "humidifier", "OasisMist1000S": "humidifier",
    "Superior6000S": "humidifier",
    "LUH-": "humidifier", "LEH-": "humidifier",
    // Bulbs
    "ESL100": "bulb", "ESL100CW": "bulb", "ESL100MC": "bulb", "XYD0001": "bulb",
    "ESWD16": "dimmer",
    // Outlets
    "ESO15-TB": "outlet", "ESW15-USA": "outlet", "ESW03-USA": "outlet",
    "ESW01-EU": "outlet", "ESW10-USA": "outlet", "wifi-switch-1.3": "outlet",
    // Fans
    "LTF-F422S": "fan",
    // Switches
    "ESWL01": "switch", "ESWL03": "switch"
]

definition(
    name: "VeSync Integration",
    namespace: NAMESPACE,
    author: "VeSync Hubitat Integration",
    description: "Integrates VeSync/Levoit/Etekcity smart home devices",
    category: "Convenience",
    iconUrl: "",
    iconX2Url: "",
    iconX3Url: "",
    singleInstance: true,
    importUrl: ""
)

preferences {
    page(name: "mainPage")
    page(name: "credentialsPage")
    page(name: "devicePage")
    page(name: "advancedPage")
}

def mainPage() {
    dynamicPage(name: "mainPage", title: "VeSync Integration", install: true, uninstall: true) {
        section {
            paragraph "Version: ${VERSION}"
        }

        if (state.token) {
            section("Status") {
                paragraph "Connected to VeSync as: ${settings.username}"
                paragraph "Token expires: ${state.tokenExpiry ? new Date(state.tokenExpiry).format("yyyy-MM-dd HH:mm:ss") : 'Unknown'}"
            }
            section("Devices") {
                href "devicePage", title: "Manage Devices", description: "Discover and manage VeSync devices"
            }
        }

        section("Configuration") {
            href "credentialsPage", title: "VeSync Credentials", description: state.token ? "Connected" : "Configure credentials"
            href "advancedPage", title: "Advanced Settings", description: "Configure polling interval and debug options"
        }

        section("Actions") {
            input "refreshDevices", "button", title: "Refresh All Devices"
            input "reAuthenticate", "button", title: "Re-authenticate"
        }
    }
}

def credentialsPage() {
    dynamicPage(name: "credentialsPage", title: "VeSync Credentials") {
        section {
            input "username", "text", title: "VeSync Email", required: true, submitOnChange: true
            input "password", "password", title: "VeSync Password", required: true, submitOnChange: true
            input "countryCode", "enum", title: "Country", required: true, defaultValue: "US",
                options: ["US": "United States", "CA": "Canada", "GB": "United Kingdom", "DE": "Germany",
                         "FR": "France", "IT": "Italy", "ES": "Spain", "AU": "Australia", "NZ": "New Zealand",
                         "JP": "Japan", "CN": "China", "KR": "South Korea", "IN": "India", "BR": "Brazil",
                         "MX": "Mexico", "NL": "Netherlands", "BE": "Belgium", "AT": "Austria", "CH": "Switzerland",
                         "SE": "Sweden", "NO": "Norway", "DK": "Denmark", "FI": "Finland", "PL": "Poland",
                         "CZ": "Czech Republic", "HU": "Hungary", "RO": "Romania", "GR": "Greece", "PT": "Portugal",
                         "IE": "Ireland", "IL": "Israel", "AE": "UAE", "SA": "Saudi Arabia", "SG": "Singapore",
                         "MY": "Malaysia", "TH": "Thailand", "PH": "Philippines", "ID": "Indonesia", "VN": "Vietnam",
                         "TW": "Taiwan", "HK": "Hong Kong", "RU": "Russia", "UA": "Ukraine", "TR": "Turkey",
                         "ZA": "South Africa", "EG": "Egypt", "NG": "Nigeria", "KE": "Kenya", "CO": "Colombia",
                         "AR": "Argentina", "CL": "Chile", "PE": "Peru", "VE": "Venezuela"]
        }

        section {
            input "testAuth", "button", title: "Test Authentication"
            if (state.authMessage) {
                paragraph state.authMessage
            }
        }
    }
}

def devicePage() {
    dynamicPage(name: "devicePage", title: "Device Management") {
        if (!state.token) {
            section {
                paragraph "Please configure credentials first"
            }
            return
        }

        section("Discovered Devices") {
            input "discoverDevices", "button", title: "Discover Devices"

            if (state.discoveredDevices) {
                state.discoveredDevices.each { device ->
                    def deviceType = getDeviceCategory(device.deviceType)
                    def isInstalled = getChildDevice(device.cid) != null
                    paragraph "${device.deviceName} (${device.deviceType}) - ${deviceType} ${isInstalled ? '[Installed]' : ''}"
                }
            }
        }

        section("Device Selection") {
            def deviceOptions = state.discoveredDevices?.collectEntries { d ->
                [(d.cid): "${d.deviceName} (${d.deviceType})"]
            } ?: [:]
            input "selectedDevices", "enum", title: "Select Devices to Install", multiple: true, options: deviceOptions
        }

        section {
            input "installSelected", "button", title: "Install Selected Devices"
            input "removeAll", "button", title: "Remove All Devices"
        }

        section("Installed Devices") {
            def children = getChildDevices()
            if (children) {
                children.each { child ->
                    paragraph "${child.label ?: child.name} (${child.deviceNetworkId})"
                }
            } else {
                paragraph "No devices installed"
            }
        }
    }
}

def advancedPage() {
    dynamicPage(name: "advancedPage", title: "Advanced Settings") {
        section("Polling") {
            input "pollingInterval", "enum", title: "Polling Interval", defaultValue: "120",
                options: ["60": "1 minute", "120": "2 minutes", "300": "5 minutes", "600": "10 minutes"]
        }

        section("Logging") {
            input "debugLogging", "bool", title: "Enable Debug Logging", defaultValue: false
            input "descriptionLogging", "bool", title: "Enable Description Logging", defaultValue: true
        }

        section("Exclusions") {
            input "excludedTypes", "enum", title: "Exclude Device Types", multiple: true,
                options: ["purifier": "Air Purifiers", "humidifier": "Humidifiers", "bulb": "Bulbs",
                         "outlet": "Outlets", "fan": "Fans", "switch": "Switches"]
            input "excludedNames", "text", title: "Exclude Devices by Name (comma-separated)", required: false
        }
    }
}

def installed() {
    logDebug "Installed VeSync Integration"
    initialize()
}

def updated() {
    logDebug "Updated VeSync Integration"
    unschedule()
    initialize()
}

def uninstalled() {
    logDebug "Uninstalling VeSync Integration"
    unschedule()
    getChildDevices().each { deleteChildDevice(it.deviceNetworkId) }
}

def initialize() {
    logDebug "Initializing VeSync Integration"

    if (settings.username && settings.password && !state.token) {
        authenticate()
    }

    if (state.token) {
        scheduleTokenRefresh()
        schedulePolling()
    }
}

// Button Handlers
def appButtonHandler(btn) {
    switch(btn) {
        case "testAuth":
            authenticate()
            break
        case "discoverDevices":
            discoverDevices()
            break
        case "installSelected":
            installSelectedDevices()
            break
        case "removeAll":
            removeAllDevices()
            break
        case "refreshDevices":
            refreshAllDevices()
            break
        case "reAuthenticate":
            state.token = null
            state.accountId = null
            authenticate()
            break
    }
}

// Authentication
def authenticate() {
    logDebug "Authenticating with VeSync API"

    if (!settings.username || !settings.password) {
        state.authMessage = "Please enter username and password"
        logError "Authentication failed: missing credentials"
        return
    }

    def apiUrl = getApiUrl()
    def hashedPassword = hashPassword(settings.password)

    def body = [
        acceptLanguage: "en",
        appVersion: "2.8.6",
        phoneBrand: "Hubitat",
        phoneOS: "Hubitat",
        email: settings.username,
        password: hashedPassword,
        devToken: "",
        userType: "1",
        method: "login",
        token: "",
        traceId: UUID.randomUUID().toString()
    ]

    def params = [
        uri: "${apiUrl}/cloud/v1/user/login",
        requestContentType: "application/json",
        contentType: "application/json",
        body: body,
        timeout: 30
    ]

    try {
        httpPostJson(params) { resp ->
            if (resp.status == 200) {
                def data = resp.data
                if (data.code == 0 && data.result) {
                    state.token = data.result.token
                    state.accountId = data.result.accountID
                    state.tokenExpiry = now() + (30 * 24 * 60 * 60 * 1000) // 30 days
                    state.authMessage = "Authentication successful!"
                    logInfo "Successfully authenticated with VeSync"
                    scheduleTokenRefresh()
                } else {
                    state.authMessage = "Authentication failed: ${data.msg ?: 'Unknown error'}"
                    logError "Authentication failed: ${data.msg}"
                }
            }
        }
    } catch (e) {
        state.authMessage = "Authentication error: ${e.message}"
        logError "Authentication error: ${e.message}"
    }
}

def hashPassword(password) {
    MessageDigest md = MessageDigest.getInstance("MD5")
    md.update(password.getBytes())
    byte[] digest = md.digest()
    return digest.collect { String.format('%02x', it) }.join()
}

def getApiUrl() {
    def country = settings.countryCode ?: "US"
    return EU_COUNTRIES.contains(country) ? API_BASE_URL_EU : API_BASE_URL_US
}

def scheduleTokenRefresh() {
    // Refresh token 5 days before expiry
    def refreshTime = state.tokenExpiry ? state.tokenExpiry - (5 * 24 * 60 * 60 * 1000) : now() + (25 * 24 * 60 * 60 * 1000)
    def delay = refreshTime - now()

    if (delay > 0) {
        runIn((delay / 1000).toInteger(), "authenticate")
        logDebug "Token refresh scheduled in ${(delay / (24 * 60 * 60 * 1000)).round(1)} days"
    } else {
        authenticate()
    }
}

def schedulePolling() {
    def interval = (settings.pollingInterval ?: "120").toInteger()
    schedule("0/${interval} * * * * ?", "refreshAllDevices")
    logDebug "Polling scheduled every ${interval} seconds"
}

// Device Discovery
def discoverDevices() {
    logDebug "Discovering VeSync devices"

    if (!state.token) {
        logError "Not authenticated"
        return
    }

    def apiUrl = getApiUrl()

    def body = [
        acceptLanguage: "en",
        appVersion: "2.8.6",
        phoneBrand: "Hubitat",
        phoneOS: "Hubitat",
        accountID: state.accountId,
        token: state.token,
        method: "devices",
        pageNo: 1,
        pageSize: 100,
        traceId: UUID.randomUUID().toString()
    ]

    def params = [
        uri: "${apiUrl}/cloud/v1/deviceManaged/devices",
        requestContentType: "application/json",
        contentType: "application/json",
        body: body,
        timeout: 30
    ]

    try {
        httpPostJson(params) { resp ->
            if (resp.status == 200) {
                def data = resp.data
                if (data.code == 0 && data.result?.list) {
                    def devices = data.result.list
                    state.discoveredDevices = devices.collect { d ->
                        [
                            cid: d.cid,
                            uuid: d.uuid,
                            deviceName: d.deviceName,
                            deviceType: d.deviceType,
                            deviceStatus: d.deviceStatus,
                            connectionStatus: d.connectionStatus,
                            configModule: d.configModule,
                            subDeviceNo: d.subDeviceNo,
                            deviceRegion: d.deviceRegion
                        ]
                    }

                    // Filter excluded types
                    if (settings.excludedTypes) {
                        state.discoveredDevices = state.discoveredDevices.findAll { d ->
                            def category = getDeviceCategory(d.deviceType)
                            !settings.excludedTypes.contains(category)
                        }
                    }

                    // Filter excluded names
                    if (settings.excludedNames) {
                        def excludedList = settings.excludedNames.split(",").collect { it.trim().toLowerCase() }
                        state.discoveredDevices = state.discoveredDevices.findAll { d ->
                            !excludedList.contains(d.deviceName.toLowerCase())
                        }
                    }

                    logInfo "Discovered ${state.discoveredDevices.size()} devices"
                } else {
                    logError "Failed to get devices: ${data.msg}"
                }
            }
        }
    } catch (e) {
        logError "Device discovery error: ${e.message}"
    }
}

def getDeviceCategory(deviceType) {
    // Check exact match first
    if (DEVICE_TYPE_MAP.containsKey(deviceType)) {
        return DEVICE_TYPE_MAP[deviceType]
    }

    // Check prefix match
    def matchedType = DEVICE_TYPE_MAP.find { key, value ->
        deviceType.startsWith(key)
    }

    if (matchedType) {
        return matchedType.value
    }

    // Categorize by common patterns
    if (deviceType.contains("Core") || deviceType.contains("Vital") || deviceType.contains("LAP-") || deviceType.contains("PUR")) {
        return "purifier"
    }
    if (deviceType.contains("Humid") || deviceType.contains("LUH") || deviceType.contains("LEH") || deviceType.contains("Oasis") || deviceType.contains("LV600")) {
        return "humidifier"
    }
    if (deviceType.contains("ESL") || deviceType.contains("XYD")) {
        return "bulb"
    }
    if (deviceType.contains("ESO") || deviceType.contains("ESW") && !deviceType.contains("ESWL")) {
        return "outlet"
    }
    if (deviceType.contains("LTF")) {
        return "fan"
    }
    if (deviceType.contains("ESWL")) {
        return "switch"
    }

    return "unknown"
}

def getDriverName(category) {
    switch(category) {
        case "purifier": return "VeSync Air Purifier"
        case "humidifier": return "VeSync Humidifier"
        case "bulb": return "VeSync Light"
        case "dimmer": return "VeSync Dimmer"
        case "outlet": return "VeSync Outlet"
        case "fan": return "VeSync Fan"
        case "switch": return "VeSync Switch"
        default: return null
    }
}

// Device Management
def installSelectedDevices() {
    if (!settings.selectedDevices) {
        logDebug "No devices selected"
        return
    }

    settings.selectedDevices.each { cid ->
        def deviceInfo = state.discoveredDevices?.find { it.cid == cid }
        if (deviceInfo) {
            createChildDevice(deviceInfo)
        }
    }
}

def createChildDevice(deviceInfo) {
    def category = getDeviceCategory(deviceInfo.deviceType)
    def driverName = getDriverName(category)

    if (!driverName) {
        logError "Unknown device type: ${deviceInfo.deviceType}"
        return null
    }

    def existingDevice = getChildDevice(deviceInfo.cid)
    if (existingDevice) {
        logDebug "Device already exists: ${deviceInfo.deviceName}"
        return existingDevice
    }

    try {
        def child = addChildDevice(NAMESPACE, driverName, deviceInfo.cid, [
            name: driverName,
            label: deviceInfo.deviceName,
            isComponent: false
        ])

        child.updateDataValue("deviceType", deviceInfo.deviceType)
        child.updateDataValue("uuid", deviceInfo.uuid)
        child.updateDataValue("configModule", deviceInfo.configModule ?: "")
        child.updateDataValue("deviceRegion", deviceInfo.deviceRegion ?: "")
        child.updateDataValue("subDeviceNo", deviceInfo.subDeviceNo?.toString() ?: "0")

        logInfo "Created device: ${deviceInfo.deviceName} (${driverName})"

        // Initial refresh
        runIn(2, "refreshChildDevice", [data: [cid: deviceInfo.cid]])

        // Check if purifier has air quality sensor - create separate device
        if (category == "purifier" && hasAirQualitySensor(deviceInfo.deviceType)) {
            createAirQualitySensorDevice(deviceInfo)
        }

        return child
    } catch (e) {
        logError "Failed to create device ${deviceInfo.deviceName}: ${e.message}"
        return null
    }
}

def hasAirQualitySensor(deviceType) {
    def aqDevices = ["Core300S", "Core400S", "Core600S", "Vital100S", "Vital200S",
                     "LAP-C201S", "LAP-C202S", "LAP-C301S", "LAP-C302S", "LAP-C401S", "LAP-C601S",
                     "LAP-V201S", "LAP-EL551S"]
    return aqDevices.any { deviceType.startsWith(it) }
}

def createAirQualitySensorDevice(deviceInfo) {
    def sensorCid = "${deviceInfo.cid}-AQ"
    def existingDevice = getChildDevice(sensorCid)

    if (existingDevice) {
        return existingDevice
    }

    try {
        def child = addChildDevice(NAMESPACE, "VeSync Air Quality Sensor", sensorCid, [
            name: "VeSync Air Quality Sensor",
            label: "${deviceInfo.deviceName} Air Quality",
            isComponent: false
        ])

        child.updateDataValue("parentCid", deviceInfo.cid)
        child.updateDataValue("deviceType", deviceInfo.deviceType)

        logInfo "Created air quality sensor for: ${deviceInfo.deviceName}"
        return child
    } catch (e) {
        logError "Failed to create air quality sensor: ${e.message}"
        return null
    }
}

def removeAllDevices() {
    getChildDevices().each {
        deleteChildDevice(it.deviceNetworkId)
    }
    logInfo "Removed all child devices"
}

// Device Refresh
def refreshAllDevices() {
    logDebug "Refreshing all devices"

    if (!state.token) {
        logError "Not authenticated"
        return
    }

    getChildDevices().each { child ->
        // Skip AQ sensor devices - they get updated with their parent
        if (!child.deviceNetworkId.endsWith("-AQ")) {
            refreshChildDevice([cid: child.deviceNetworkId])
        }
    }
}

def refreshChildDevice(data) {
    def cid = data.cid
    def child = getChildDevice(cid)

    if (!child) {
        logDebug "Child device not found: ${cid}"
        return
    }

    def deviceType = child.getDataValue("deviceType")
    def uuid = child.getDataValue("uuid")
    def configModule = child.getDataValue("configModule")

    getDeviceDetails(cid, deviceType, uuid, configModule)
}

// API Communication
def getDeviceDetails(cid, deviceType, uuid, configModule) {
    logDebug "Getting details for device: ${cid}"

    def apiUrl = getApiUrl()
    def category = getDeviceCategory(deviceType)

    // Determine API method based on device type
    def apiMethod = getApiMethod(deviceType, category)
    def apiEndpoint = getApiEndpoint(category, apiMethod)

    def body = [
        acceptLanguage: "en",
        appVersion: "2.8.6",
        phoneBrand: "Hubitat",
        phoneOS: "Hubitat",
        accountID: state.accountId,
        token: state.token,
        uuid: uuid,
        cid: cid,
        configModule: configModule ?: deviceType,
        deviceRegion: "US",
        method: apiMethod,
        traceId: UUID.randomUUID().toString()
    ]

    def params = [
        uri: "${apiUrl}${apiEndpoint}",
        requestContentType: "application/json",
        contentType: "application/json",
        body: body,
        timeout: 30
    ]

    try {
        httpPostJson(params) { resp ->
            if (resp.status == 200) {
                def data = resp.data
                if (data.code == 0 && data.result) {
                    updateChildDevice(cid, data.result, category)
                } else {
                    logError "Failed to get device details: ${data.msg}"
                }
            }
        }
    } catch (e) {
        logError "Error getting device details: ${e.message}"
    }
}

def getApiMethod(deviceType, category) {
    switch(category) {
        case "purifier":
            if (deviceType.startsWith("Core") || deviceType.startsWith("LAP-C")) {
                return "getAirPurifierStatus"
            }
            if (deviceType.startsWith("Vital") || deviceType.startsWith("LAP-V") || deviceType.startsWith("LAP-EL")) {
                return "getPurifierStatus"
            }
            return "getAirPurifierStatus"
        case "humidifier":
            return "getHumidifierStatus"
        case "bulb":
        case "dimmer":
            return "getLightStatus"
        case "outlet":
            return "getOutletStatus"
        case "fan":
            return "getTowerFanStatus"
        case "switch":
            return "getSwitchStatus"
        default:
            return "devicestatus"
    }
}

def getApiEndpoint(category, method) {
    switch(category) {
        case "purifier":
            return "/cloud/v2/deviceManaged/bypassV2"
        case "humidifier":
            return "/cloud/v2/deviceManaged/bypassV2"
        case "bulb":
        case "dimmer":
            return "/SmartBulb/v1/device/devicedetail"
        case "outlet":
            return "/v1/device/${method}"
        case "fan":
            return "/cloud/v2/deviceManaged/bypassV2"
        case "switch":
            return "/inwallswitch/v1/device/devicedetail"
        default:
            return "/cloud/v1/deviceManaged/deviceDetail"
    }
}

def updateChildDevice(cid, data, category) {
    def child = getChildDevice(cid)
    if (!child) return

    switch(category) {
        case "purifier":
            updatePurifierDevice(child, data)
            break
        case "humidifier":
            updateHumidifierDevice(child, data)
            break
        case "bulb":
        case "dimmer":
            updateLightDevice(child, data)
            break
        case "outlet":
            updateOutletDevice(child, data)
            break
        case "fan":
            updateFanDevice(child, data)
            break
        case "switch":
            updateSwitchDevice(child, data)
            break
    }
}

def updatePurifierDevice(child, data) {
    def status = data.result ?: data

    // Power state
    def powerState = status.enabled != null ? status.enabled : (status.deviceStatus == "on")
    child.sendEvent(name: "switch", value: powerState ? "on" : "off")

    // Fan speed
    def speed = status.level ?: status.fan_level ?: status.speed ?: 0
    child.sendEvent(name: "speed", value: speed)

    // Mode
    def mode = status.mode ?: "manual"
    child.sendEvent(name: "mode", value: mode)

    // Filter life
    def filterLife = status.filter_life ?: status.filterLife ?: 100
    child.sendEvent(name: "filterLife", value: filterLife, unit: "%")

    // Air quality
    if (status.air_quality != null || status.airQuality != null) {
        def aq = status.air_quality ?: status.airQuality
        child.sendEvent(name: "airQuality", value: aq)

        // Update AQ sensor device if exists
        def aqDevice = getChildDevice("${child.deviceNetworkId}-AQ")
        if (aqDevice) {
            aqDevice.sendEvent(name: "airQuality", value: aq)
        }
    }

    // PM2.5
    if (status.air_quality_value != null || status.pm25 != null) {
        def pm25 = status.air_quality_value ?: status.pm25 ?: 0
        child.sendEvent(name: "pm25", value: pm25, unit: "μg/m³")

        def aqDevice = getChildDevice("${child.deviceNetworkId}-AQ")
        if (aqDevice) {
            aqDevice.sendEvent(name: "pm25", value: pm25, unit: "μg/m³")
            aqDevice.sendEvent(name: "airQualityIndex", value: calculateAQI(pm25))
        }
    }

    // Child lock
    if (status.child_lock != null || status.childLock != null) {
        def childLock = status.child_lock ?: status.childLock
        child.sendEvent(name: "childLock", value: childLock ? "on" : "off")
    }

    // Display
    if (status.display != null || status.screenStatus != null) {
        def display = status.display ?: (status.screenStatus == 1)
        child.sendEvent(name: "display", value: display ? "on" : "off")
    }

    logDebug "Updated purifier ${child.label}: power=${powerState}, speed=${speed}, mode=${mode}"
}

def updateHumidifierDevice(child, data) {
    def status = data.result ?: data

    // Power state
    def powerState = status.enabled != null ? status.enabled : (status.deviceStatus == "on")
    child.sendEvent(name: "switch", value: powerState ? "on" : "off")

    // Current humidity
    def humidity = status.humidity ?: 0
    child.sendEvent(name: "humidity", value: humidity, unit: "%")

    // Target humidity
    def targetHumidity = status.target_humidity ?: status.configuration?.auto_target_humidity ?: 50
    child.sendEvent(name: "targetHumidity", value: targetHumidity, unit: "%")

    // Mist level
    def mistLevel = status.mist_level ?: status.mistLevel ?: status.level ?: 0
    child.sendEvent(name: "mistLevel", value: mistLevel)

    // Mode
    def mode = status.mode ?: "manual"
    child.sendEvent(name: "mode", value: mode)

    // Water level / tank status
    def waterLack = status.water_lacks ?: status.waterLack ?: false
    child.sendEvent(name: "waterLevel", value: waterLack ? "low" : "ok")

    // Night light
    if (status.night_light_brightness != null) {
        child.sendEvent(name: "nightLightBrightness", value: status.night_light_brightness)
    }

    logDebug "Updated humidifier ${child.label}: power=${powerState}, humidity=${humidity}%, target=${targetHumidity}%"
}

def updateLightDevice(child, data) {
    def status = data

    // Power state
    def powerState = status.deviceStatus == "on"
    child.sendEvent(name: "switch", value: powerState ? "on" : "off")

    // Brightness
    if (status.brightness != null) {
        child.sendEvent(name: "level", value: status.brightness, unit: "%")
    }

    // Color temperature
    if (status.colorTemp != null) {
        // Convert from device range (0-100) to Kelvin
        def kelvin = Math.round(2700 + (status.colorTemp / 100.0) * (6500 - 2700))
        child.sendEvent(name: "colorTemperature", value: kelvin, unit: "K")
    }

    // RGB Color
    if (status.hue != null && status.saturation != null) {
        child.sendEvent(name: "hue", value: status.hue)
        child.sendEvent(name: "saturation", value: status.saturation)
        child.sendEvent(name: "colorMode", value: "RGB")
    } else if (status.colorTemp != null) {
        child.sendEvent(name: "colorMode", value: "CT")
    }

    logDebug "Updated light ${child.label}: power=${powerState}, brightness=${status.brightness}"
}

def updateOutletDevice(child, data) {
    def status = data

    // Power state
    def powerState = status.deviceStatus == "on"
    child.sendEvent(name: "switch", value: powerState ? "on" : "off")

    // Power monitoring
    if (status.power != null) {
        child.sendEvent(name: "power", value: status.power, unit: "W")
    }

    if (status.voltage != null) {
        child.sendEvent(name: "voltage", value: status.voltage, unit: "V")
    }

    if (status.energy != null) {
        child.sendEvent(name: "energy", value: status.energy, unit: "kWh")
    }

    logDebug "Updated outlet ${child.label}: power=${powerState}, watts=${status.power}"
}

def updateFanDevice(child, data) {
    def status = data.result ?: data

    // Power state
    def powerState = status.enabled != null ? status.enabled : (status.deviceStatus == "on")
    child.sendEvent(name: "switch", value: powerState ? "on" : "off")

    // Speed
    def speed = status.level ?: status.fan_level ?: 0
    def maxSpeed = getMaxFanSpeed(child.getDataValue("deviceType"))
    def speedPercent = Math.round((speed / maxSpeed) * 100)
    child.sendEvent(name: "speed", value: speedPercent, unit: "%")
    child.sendEvent(name: "speedLevel", value: speed)

    // Mode
    def mode = status.mode ?: "normal"
    child.sendEvent(name: "mode", value: mode)

    // Oscillation
    def oscillation = status.oscillation_state ?: status.oscillationState ?: false
    child.sendEvent(name: "oscillation", value: oscillation ? "on" : "off")

    logDebug "Updated fan ${child.label}: power=${powerState}, speed=${speed}"
}

def updateSwitchDevice(child, data) {
    def status = data

    // Power state
    def powerState = status.deviceStatus == "on"
    child.sendEvent(name: "switch", value: powerState ? "on" : "off")

    logDebug "Updated switch ${child.label}: power=${powerState}"
}

def getMaxFanSpeed(deviceType) {
    if (deviceType?.startsWith("LTF-F422S")) return 12
    if (deviceType?.startsWith("Core200S")) return 3
    if (deviceType?.startsWith("Core300S")) return 3
    if (deviceType?.startsWith("Core400S")) return 4
    if (deviceType?.startsWith("Core600S")) return 4
    return 4
}

def calculateAQI(pm25) {
    if (pm25 <= 12) return 1  // Excellent
    if (pm25 <= 35) return 2  // Good
    if (pm25 <= 55) return 3  // Fair
    if (pm25 <= 150) return 4 // Poor
    return 5                   // Very Poor
}

// Device Control Methods (called by child devices)
def childOn(cid) {
    sendDeviceCommand(cid, "turnOn", [:])
}

def childOff(cid) {
    sendDeviceCommand(cid, "turnOff", [:])
}

def childSetSpeed(cid, level) {
    sendDeviceCommand(cid, "setSpeed", [level: level])
}

def childSetMode(cid, mode) {
    sendDeviceCommand(cid, "setMode", [mode: mode])
}

def childSetBrightness(cid, brightness) {
    sendDeviceCommand(cid, "setBrightness", [brightness: brightness])
}

def childSetColorTemperature(cid, kelvin) {
    // Convert Kelvin to device range (0-100)
    def deviceTemp = Math.round(((kelvin - 2700) / (6500 - 2700)) * 100)
    deviceTemp = Math.max(0, Math.min(100, deviceTemp))
    sendDeviceCommand(cid, "setColorTemperature", [colorTemp: deviceTemp])
}

def childSetColor(cid, hue, saturation, level) {
    sendDeviceCommand(cid, "setColor", [hue: hue, saturation: saturation, brightness: level])
}

def childSetTargetHumidity(cid, humidity) {
    sendDeviceCommand(cid, "setTargetHumidity", [humidity: humidity])
}

def childSetMistLevel(cid, level) {
    sendDeviceCommand(cid, "setMistLevel", [level: level])
}

def childSetOscillation(cid, state) {
    sendDeviceCommand(cid, "setOscillation", [state: state])
}

def childSetChildLock(cid, state) {
    sendDeviceCommand(cid, "setChildLock", [state: state])
}

def childSetDisplay(cid, state) {
    sendDeviceCommand(cid, "setDisplay", [state: state])
}

def sendDeviceCommand(cid, command, params) {
    def child = getChildDevice(cid)
    if (!child) {
        logError "Device not found: ${cid}"
        return false
    }

    def deviceType = child.getDataValue("deviceType")
    def uuid = child.getDataValue("uuid")
    def configModule = child.getDataValue("configModule")
    def category = getDeviceCategory(deviceType)

    def apiUrl = getApiUrl()
    def endpoint = getCommandEndpoint(category)
    def payload = buildCommandPayload(command, params, deviceType, category)

    def body = [
        acceptLanguage: "en",
        appVersion: "2.8.6",
        phoneBrand: "Hubitat",
        phoneOS: "Hubitat",
        accountID: state.accountId,
        token: state.token,
        uuid: uuid,
        cid: cid,
        configModule: configModule ?: deviceType,
        deviceRegion: "US",
        method: payload.method,
        payload: payload.data,
        traceId: UUID.randomUUID().toString()
    ]

    def httpParams = [
        uri: "${apiUrl}${endpoint}",
        requestContentType: "application/json",
        contentType: "application/json",
        body: body,
        timeout: 30
    ]

    try {
        httpPostJson(httpParams) { resp ->
            if (resp.status == 200) {
                def data = resp.data
                if (data.code == 0) {
                    logInfo "Command ${command} sent to ${child.label}"
                    // Refresh device state after command
                    runIn(2, "refreshChildDevice", [data: [cid: cid]])
                    return true
                } else {
                    logError "Command failed: ${data.msg}"
                }
            }
        }
    } catch (e) {
        logError "Error sending command: ${e.message}"
    }

    return false
}

def getCommandEndpoint(category) {
    switch(category) {
        case "purifier":
        case "humidifier":
        case "fan":
            return "/cloud/v2/deviceManaged/bypassV2"
        case "bulb":
        case "dimmer":
            return "/SmartBulb/v1/device/devicestatus"
        case "outlet":
            return "/10a/v1/device/devicestatus"
        case "switch":
            return "/inwallswitch/v1/device/devicestatus"
        default:
            return "/cloud/v1/deviceManaged/bypass"
    }
}

def buildCommandPayload(command, params, deviceType, category) {
    def method = ""
    def data = [:]

    switch(command) {
        case "turnOn":
            method = category == "purifier" || category == "humidifier" || category == "fan" ? "setSwitch" : "devicestatus"
            data = category == "purifier" || category == "humidifier" || category == "fan" ?
                [enabled: true, id: 0] : [status: "on"]
            break

        case "turnOff":
            method = category == "purifier" || category == "humidifier" || category == "fan" ? "setSwitch" : "devicestatus"
            data = category == "purifier" || category == "humidifier" || category == "fan" ?
                [enabled: false, id: 0] : [status: "off"]
            break

        case "setSpeed":
            method = category == "purifier" ? "setLevel" : "setFanSpeed"
            data = [level: params.level, id: 0, type: "wind"]
            break

        case "setMode":
            method = "setPurifierMode"
            data = [mode: params.mode]
            break

        case "setBrightness":
            method = "devicestatus"
            data = [brightness: params.brightness, status: "on"]
            break

        case "setColorTemperature":
            method = "devicestatus"
            data = [colorTemp: params.colorTemp, status: "on"]
            break

        case "setColor":
            method = "devicestatus"
            data = [
                hue: params.hue,
                saturation: params.saturation,
                brightness: params.brightness ?: 100,
                status: "on",
                colorMode: "hsv"
            ]
            break

        case "setTargetHumidity":
            method = "setTargetHumidity"
            data = [target_humidity: params.humidity]
            break

        case "setMistLevel":
            method = "setVirtualLevel"
            data = [level: params.level, id: 0, type: "mist"]
            break

        case "setOscillation":
            method = "setOscillationSwitch"
            data = [enabled: params.state == "on" || params.state == true]
            break

        case "setChildLock":
            method = "setChildLock"
            data = [child_lock: params.state == "on" || params.state == true]
            break

        case "setDisplay":
            method = "setDisplay"
            data = [state: params.state == "on" || params.state == true]
            break
    }

    return [method: method, data: data]
}

// Logging
def logDebug(msg) {
    if (settings.debugLogging) {
        log.debug "[VeSync] ${msg}"
    }
}

def logInfo(msg) {
    if (settings.descriptionLogging != false) {
        log.info "[VeSync] ${msg}"
    }
}

def logError(msg) {
    log.error "[VeSync] ${msg}"
}
