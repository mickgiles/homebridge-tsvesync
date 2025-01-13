#!/bin/bash

# Default values
DEFAULT_USERNAME="test@example.com"
DEFAULT_PASSWORD="test123"
DEFAULT_BASE_URL="https://smartapi.vesync.com"

# Initialize variables with defaults
VESYNC_USERNAME="$DEFAULT_USERNAME"
VESYNC_PASSWORD="$DEFAULT_PASSWORD"
BASE_URL="$DEFAULT_BASE_URL"
DEVICE_FILTER=""
DEBUG=false

# Function to normalize model numbers
normalize_model() {
    local model=$1
    
    # Convert to lowercase for comparison
    model=$(echo "$model" | tr '[:upper:]' '[:lower:]')
    
    # Special case mappings
    case $model in
        *"leh-s601s"*) echo "6000s" ;;
        *) echo "$model" ;;
    esac
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -u|--username)
      VESYNC_USERNAME="$2"
      shift 2
      ;;
    -p|--password)
      VESYNC_PASSWORD="$2"
      shift 2
      ;;
    -b|--base-url)
      BASE_URL="$2"
      shift 2
      ;;
    -d|--device-type)
      DEVICE_FILTER=$(echo "$2" | tr '[:upper:]' '[:lower:]')
      shift 2
      ;;
    --debug)
      DEBUG=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [-u|--username USERNAME] [-p|--password PASSWORD] [-b|--base-url BASE_URL] [-d|--device-type DEVICE_TYPE] [--debug]"
      echo ""
      echo "Options:"
      echo "  -u, --username USERNAME     VeSync username (default: $DEFAULT_USERNAME)"
      echo "  -p, --password PASSWORD     VeSync password (default: $DEFAULT_PASSWORD)"
      echo "  -b, --base-url BASE_URL     Base URL for VeSync API (default: $DEFAULT_BASE_URL)"
      echo "  -d, --device-type TYPE      Filter devices by type (case-insensitive partial match, optional)"
      echo "  --debug                     Enable debug output"
      echo "  -h, --help                  Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Convert password to MD5
MD5_PASS=$(echo -n "$VESYNC_PASSWORD" | md5sum | cut -d ' ' -f 1)

# Step 1: Login to get token and account ID
echo "Logging in to VeSync..."

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/cloud/v1/user/login" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -H "Accept-Language: en" \
    -H "Connection: keep-alive" \
    -H "User-Agent: VeSync/VeSync 4.1.50 (iPhone; iOS 14.0; Scale/2.00)" \
    -d '{
        "timeZone": "America/New_York",
        "acceptLanguage": "en",
        "appVersion": "4.1.50",
        "phoneBrand": "iPhone",
        "phoneOS": "iOS",
        "traceId": "1234567890",
        "email": "'"$VESYNC_USERNAME"'",
        "password": "'"$MD5_PASS"'",
        "devToken": "",
        "userType": "1",
        "method": "login"
    }')

# Extract token and accountID
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.result.token')
ACCOUNT_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.result.accountID')

if [ "$TOKEN" == "null" ] || [ "$ACCOUNT_ID" == "null" ]; then
    echo "Error: Failed to login. Response:"
    echo "$LOGIN_RESPONSE" | jq '.'
    exit 1
fi

echo "Successfully logged in"

# Step 2: Get list of devices
echo "Getting device list..."
DEVICES_RESPONSE=$(curl -s -X POST "$BASE_URL/cloud/v2/deviceManaged/devices" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -H "Accept-Language: en" \
    -H "Connection: keep-alive" \
    -H "User-Agent: VeSync/VeSync 4.1.50 (iPhone; iOS 14.0; Scale/2.00)" \
    -d '{
        "token": "'"$TOKEN"'",
        "accountID": "'"$ACCOUNT_ID"'",
        "timeZone": "America/New_York",
        "acceptLanguage": "en",
        "appVersion": "4.1.50",
        "phoneBrand": "iPhone",
        "phoneOS": "iOS",
        "traceId": "1234567890",
        "method": "devices",
        "pageNo": "1",
        "pageSize": "100"
    }')

#echo "Devices response:"
#echo "$DEVICES_RESPONSE" | jq '.'

# Debug: Show all devices before filtering
#echo "All devices before filtering:"
#echo "$DEVICES_RESPONSE" | jq -r '.result.list[] | .deviceType'

# Process each device
FOUND_DEVICES=0
ALL_DEVICE_TYPES=()

echo "$DEVICES_RESPONSE" | jq -c '.result.list[]' | while read -r device; do
    DEVICE_NAME=$(echo "$device" | jq -r '.deviceName')
    DEVICE_TYPE=$(echo "$device" | jq -r '.deviceType')
    
    # Store all device types for later display if needed
    ALL_DEVICE_TYPES+=("$DEVICE_TYPE")
    
    # Skip if device type doesn't match filter (when filter is set)
    if [ -n "$DEVICE_FILTER" ]; then
        DEVICE_TYPE_LOWER=$(echo "$DEVICE_TYPE" | tr '[:upper:]' '[:lower:]')
        FILTER_LOWER=$(echo "$DEVICE_FILTER" | tr '[:upper:]' '[:lower:]')
        NORMALIZED_TYPE=$(normalize_model "$DEVICE_TYPE_LOWER")
        NORMALIZED_FILTER=$(normalize_model "$FILTER_LOWER")
        
        if [ "$DEBUG" = true ]; then
            echo "Debug: Comparing device type '$DEVICE_TYPE_LOWER' (normalized: $NORMALIZED_TYPE) with filter '$FILTER_LOWER' (normalized: $NORMALIZED_FILTER)"
        fi
        
        # Try different matching patterns
        if [[ "$DEVICE_TYPE_LOWER" =~ .*"$FILTER_LOWER".* ]] || \
           [[ "$DEVICE_TYPE_LOWER" =~ ^"$FILTER_LOWER".* ]] || \
           [[ "$DEVICE_TYPE_LOWER" == *"$FILTER_LOWER" ]] || \
           [[ "${DEVICE_TYPE_LOWER//[^a-z0-9]/}" == *"${FILTER_LOWER//[^a-z0-9]}"* ]] || \
           [[ "$NORMALIZED_TYPE" == "$NORMALIZED_FILTER" ]]; then
            FOUND_DEVICES=$((FOUND_DEVICES + 1))
        else
            if [ "$DEBUG" = true ]; then
                echo "Debug: No match for device $DEVICE_NAME ($DEVICE_TYPE)"
            fi
            continue
        fi
    fi
    
    DEVICE_CID=$(echo "$device" | jq -r '.cid')
    DEVICE_UUID=$(echo "$device" | jq -r '.uuid')
    CONFIG_MODULE=$(echo "$device" | jq -r '.configModule')
    
    echo "Processing device: $DEVICE_NAME (Type: $DEVICE_TYPE)"
    
    # Get device details based on device type
    if [[ "$DEVICE_TYPE" == "ESO15-TB" ]]; then
        echo "Getting device details..."
        DETAILS_RESPONSE=$(curl -s -X POST "$BASE_URL/outdoorsocket15a/v1/device/devicedetail" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "method": "devicedetail",
                "mobileId": "1234567890123456",
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID",
                "uuid": "'"$DEVICE_UUID"'"
            }')
    elif [[ "$DEVICE_TYPE" == "ESW15-USA" ]]; then
        echo "Getting 15A outlet details..."
        DETAILS_RESPONSE=$(curl -s -X POST "$BASE_URL/15a/v1/device/devicedetail" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "method": "devicedetail",
                "mobileId": "1234567890123456",
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID",
                "uuid": "'"$DEVICE_UUID"'"
            }')
        
        echo "Details for $DEVICE_NAME:"
        echo "$DETAILS_RESPONSE" | jq '.'
        
        # Get energy data
        for period in week month year; do
            echo "Getting $period energy data..."
            ENERGY_RESPONSE=$(curl -s -X POST "$BASE_URL/15a/v1/device/energy$period" \
                -H "Content-Type: application/json" \
                -H "accept-language: en" \
                -H "accountId: $ACCOUNT_ID" \
                -H "appVersion: 2.8.6" \
                -H "tk: $TOKEN" \
                -H "tz: America/New_York" \
                -d '{
                    "acceptLanguage": "en",
                    "accountID": "'"$ACCOUNT_ID"'",
                    "appVersion": "2.8.6",
                    "method": "energy'"$period"'",
                    "mobileId": "1234567890123456",
                    "phoneBrand": "SM N9005",
                    "phoneOS": "Android",
                    "timeZone": "America/New_York",
                    "token": "'"$TOKEN"'",
                    "traceId": "TRACE_ID",
                    "uuid": "'"$DEVICE_UUID"'"
                }')
            echo "$period energy for $DEVICE_NAME:"
            echo "$ENERGY_RESPONSE" | jq '.'
        done
    elif [[ "$DEVICE_TYPE" == "ESW01-EU" ]]; then
        echo "Getting EU outlet details..."
        DETAILS_RESPONSE=$(curl -s -X POST "$BASE_URL/10a/v1/device/devicedetail" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "method": "devicedetail",
                "mobileId": "1234567890123456",
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID",
                "uuid": "'"$DEVICE_UUID"'"
            }')
        
        echo "Details for $DEVICE_NAME:"
        echo "$DETAILS_RESPONSE" | jq '.'
        
        # Get energy data
        for period in week month year; do
            echo "Getting $period energy data..."
            ENERGY_RESPONSE=$(curl -s -X POST "$BASE_URL/10a/v1/device/energy$period" \
                -H "Content-Type: application/json" \
                -H "accept-language: en" \
                -H "accountId: $ACCOUNT_ID" \
                -H "appVersion: 2.8.6" \
                -H "tk: $TOKEN" \
                -H "tz: America/New_York" \
                -d '{
                    "acceptLanguage": "en",
                    "accountID": "'"$ACCOUNT_ID"'",
                    "appVersion": "2.8.6",
                    "method": "energy'"$period"'",
                    "mobileId": "1234567890123456",
                    "phoneBrand": "SM N9005",
                    "phoneOS": "Android",
                    "timeZone": "America/New_York",
                    "token": "'"$TOKEN"'",
                    "traceId": "TRACE_ID",
                    "uuid": "'"$DEVICE_UUID"'"
                }')
            echo "$period energy for $DEVICE_NAME:"
            echo "$ENERGY_RESPONSE" | jq '.'
        done
    elif [[ "$DEVICE_TYPE" =~ ^ESL100(CW|MC)?$ ]]; then
        echo "Getting smart bulb details..."
        DETAILS_RESPONSE=$(curl -s -X POST "$BASE_URL/SmartBulb/v1/device/devicedetail" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "method": "devicedetail",
                "mobileId": "1234567890123456",
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID",
                "uuid": "'"$DEVICE_UUID"'"
            }')
        
        echo "Details for $DEVICE_NAME:"
        echo "$DETAILS_RESPONSE" | jq '.'
        
        # Get device status
        echo "Getting smart bulb status..."
        STATUS_RESPONSE=$(curl -s -X POST "$BASE_URL/SmartBulb/v1/device/devicestatus" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "uuid": "'"$DEVICE_UUID"'"
            }')
        
        echo "Status for $DEVICE_NAME:"
        echo "$STATUS_RESPONSE" | jq '.'
    elif [[ "$DEVICE_TYPE" == "XYD0001" ]]; then
        echo "Getting XYD0001 smart bulb details..."
        DETAILS_RESPONSE=$(curl -s -X POST "$BASE_URL/cloud/v2/deviceManaged/bypassV2" \
            -H "Content-Type: application/json; charset=UTF-8" \
            -H "User-Agent: okhttp/3.12.1" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "cid": "'"$DEVICE_CID"'",
                "configModule": "'"$CONFIG_MODULE"'",
                "debugMode": false,
                "deviceRegion": "US",
                "method": "bypassV2",
                "payload": {
                    "data": {},
                    "method": "getLightStatus",
                    "source": "APP"
                },
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID"
            }')
        
        echo "Details for $DEVICE_NAME:"
        echo "$DETAILS_RESPONSE" | jq '.'
        
        # Get device status
        echo "Getting XYD0001 smart bulb status..."
        STATUS_RESPONSE=$(curl -s -X POST "$BASE_URL/cloud/v2/deviceManaged/bypassV2" \
            -H "Content-Type: application/json; charset=UTF-8" \
            -H "User-Agent: okhttp/3.12.1" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "cid": "'"$DEVICE_CID"'",
                "configModule": "'"$CONFIG_MODULE"'",
                "debugMode": false,
                "deviceRegion": "US",
                "method": "bypassV2",
                "payload": {
                    "data": {},
                    "method": "getLightStatus",
                    "source": "APP"
                },
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID"
            }')
        
        echo "Status for $DEVICE_NAME:"
        echo "$STATUS_RESPONSE" | jq '.'
    elif [[ "$DEVICE_TYPE" =~ ^ESWL0[13]$ ]]; then
        echo "Getting wall switch details..."
        DETAILS_RESPONSE=$(curl -s -X POST "$BASE_URL/inwallswitch/v1/device/devicedetail" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "method": "devicedetail",
                "mobileId": "1234567890123456",
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID",
                "uuid": "'"$DEVICE_UUID"'"
            }')
        
        echo "Details for $DEVICE_NAME:"
        echo "$DETAILS_RESPONSE" | jq '.'
    elif [[ "$DEVICE_TYPE" == "ESWD16" ]]; then
        echo "Getting dimmer switch details..."
        DETAILS_RESPONSE=$(curl -s -X POST "$BASE_URL/dimmer/v1/device/devicedetail" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "method": "devicedetail",
                "mobileId": "1234567890123456",
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID",
                "uuid": "'"$DEVICE_UUID"'"
            }')
        
        echo "Details for $DEVICE_NAME:"
        echo "$DETAILS_RESPONSE" | jq '.'
        
        # Get RGB status for dimmer
        echo "Getting dimmer RGB status..."
        RGB_RESPONSE=$(curl -s -X POST "$BASE_URL/dimmer/v1/device/devicergbstatus" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "uuid": "'"$DEVICE_UUID"'"
            }')
        
        echo "RGB status for $DEVICE_NAME:"
        echo "$RGB_RESPONSE" | jq '.'
    elif [[ "$DEVICE_TYPE" == "wifi-switch-1.3" ]]; then
        echo "Getting device details..."
        DETAILS_RESPONSE=$(curl -s -X GET "$BASE_URL/v1/device/$DEVICE_CID/detail" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York")
    elif [[ "$DEVICE_TYPE" == *"Core"* ]] || [[ "$DEVICE_TYPE" == *"LAP"* ]] || [[ "$DEVICE_TYPE" == "Dual200S" ]] || [[ "$DEVICE_TYPE" == *"LTF-"* ]] || [[ "$DEVICE_TYPE" == *"Classic"* ]] || [[ "$DEVICE_TYPE" == *"LUH"* ]] || [[ "$DEVICE_TYPE" == *"LEH"* ]]; then
        echo "Getting device details..."
        DETAILS_RESPONSE=$(curl -s -X POST "$BASE_URL/cloud/v2/deviceManaged/bypassV2" \
            -H "Content-Type: application/json; charset=UTF-8" \
            -H "User-Agent: okhttp/3.12.1" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "cid": "'"$DEVICE_CID"'",
                "configModule": "'"$CONFIG_MODULE"'",
                "debugMode": false,
                "deviceRegion": "US",
                "method": "bypassV2",
                "payload": {
                    "method": "getHumidifierStatus",
                    "source": "APP",
                    "data": {}
                },
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID"
            }')
    elif [[ "$DEVICE_TYPE" == *"LV-"* ]]; then
        echo "Getting device details..."
        DETAILS_RESPONSE=$(curl -s -X POST "$BASE_URL/131airPurifier/v1/device/deviceDetail" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "method": "devicedetail",
                "mobileId": "1234567890123456",
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID",
                "uuid": "'"$DEVICE_UUID"'"
            }')
        
        echo "Details for $DEVICE_NAME:"
        echo "$DETAILS_RESPONSE" | jq '.'
        
        # Get device status
        echo "Getting device status..."
        STATUS_RESPONSE=$(curl -s -X POST "$BASE_URL/131airPurifier/v1/device/deviceStatus" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "uuid": "'"$DEVICE_UUID"'"
            }')
        
        echo "Status for $DEVICE_NAME:"
        echo "$STATUS_RESPONSE" | jq '.'
    fi
    
    echo "Details for $DEVICE_NAME:"
    echo "$DETAILS_RESPONSE" | jq '.'
    
    # Get device status based on device type
    if [[ "$DEVICE_TYPE" == *"Core"* ]] || [[ "$DEVICE_TYPE" == *"LAP"* ]]; then
        # Air purifiers
        echo "Getting purifier status..."
        STATUS_RESPONSE=$(curl -s -X POST "$BASE_URL/cloud/v2/deviceManaged/bypassV2" \
            -H "Content-Type: application/json; charset=UTF-8" \
            -H "User-Agent: okhttp/3.12.1" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "cid": "'"$DEVICE_CID"'",
                "configModule": "'"$CONFIG_MODULE"'",
                "debugMode": false,
                "deviceRegion": "US",
                "method": "bypassV2",
                "payload": {
                    "data": {
                        "type": "air",
                        "id": 0
                    },
                    "method": "getPurifierStatus",
                    "source": "APP"
                },
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID"
            }')
        
        echo "Purifier status for $DEVICE_NAME:"
        echo "$STATUS_RESPONSE" | jq '.'

    elif [[ "$DEVICE_TYPE" == "Dual200S" ]] || [[ "$DEVICE_TYPE" == *"Classic"* ]] || [[ "$DEVICE_TYPE" == *"LUH"* ]] || [[ "$DEVICE_TYPE" == *"LEH"* ]]; then
        # Humidifiers
        echo "Getting humidifier status..."
        STATUS_RESPONSE=$(curl -s -X POST "$BASE_URL/cloud/v2/deviceManaged/bypassV2" \
            -H "Content-Type: application/json; charset=UTF-8" \
            -H "User-Agent: okhttp/3.12.1" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "cid": "'"$DEVICE_CID"'",
                "configModule": "'"$CONFIG_MODULE"'",
                "debugMode": false,
                "deviceRegion": "US",
                "method": "bypassV2",
                "payload": {
                    "method": "getHumidifierStatus",
                    "source": "APP",
                    "data": {}
                },
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID"
            }')
        
        echo "Humidifier status for $DEVICE_NAME:"
        echo "$STATUS_RESPONSE" | jq '.'

    elif [[ "$DEVICE_TYPE" == *"LTF-"* ]]; then
        # Tower Fans
        echo "Getting tower fan status..."
        STATUS_RESPONSE=$(curl -s -X POST "$BASE_URL/cloud/v2/deviceManaged/bypassV2" \
            -H "Content-Type: application/json; charset=UTF-8" \
            -H "User-Agent: okhttp/3.12.1" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "cid": "'"$DEVICE_CID"'",
                "configModule": "'"$CONFIG_MODULE"'",
                "debugMode": false,
                "deviceRegion": "US",
                "method": "bypassV2",
                "payload": {
                    "method": "getTowerFanStatus",
                    "source": "APP",
                    "data": {}
                },
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID"
            }')
        
        echo "Tower fan status for $DEVICE_NAME:"
        echo "$STATUS_RESPONSE" | jq '.'
    fi
    
    # For outlets with energy monitoring
    if [[ "$DEVICE_TYPE" == "wifi-switch-1.3" ]]; then
        echo "Getting energy details for wifi-switch-1.3..."
        
        # Get weekly energy
        WEEKLY_RESPONSE=$(curl -s -X GET "$BASE_URL/v1/device/$DEVICE_CID/energy/week" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York")
        
        echo "Weekly energy for $DEVICE_NAME:"
        echo "$WEEKLY_RESPONSE" | jq '.'
        
        # Get monthly energy
        MONTHLY_RESPONSE=$(curl -s -X GET "$BASE_URL/v1/device/$DEVICE_CID/energy/month" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York")
        
        echo "Monthly energy for $DEVICE_NAME:"
        echo "$MONTHLY_RESPONSE" | jq '.'
        
        # Get yearly energy
        YEARLY_RESPONSE=$(curl -s -X GET "$BASE_URL/v1/device/$DEVICE_CID/energy/year" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York")
        
        echo "Yearly energy for $DEVICE_NAME:"
        echo "$YEARLY_RESPONSE" | jq '.'
    elif [[ "$DEVICE_TYPE" == "ESO15-TB" ]]; then
        echo "Getting energy details for ESO15-TB..."
        
        # Get weekly energy
        WEEKLY_RESPONSE=$(curl -s -X POST "$BASE_URL/outdoorsocket15a/v1/device/energyweek" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "method": "energyweek",
                "mobileId": "1234567890123456",
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID",
                "uuid": "'"$DEVICE_UUID"'"
            }')
        
        echo "Weekly energy for $DEVICE_NAME:"
        echo "$WEEKLY_RESPONSE" | jq '.'
        
        # Get monthly energy
        MONTHLY_RESPONSE=$(curl -s -X POST "$BASE_URL/outdoorsocket15a/v1/device/energymonth" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "method": "energymonth",
                "mobileId": "1234567890123456",
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID",
                "uuid": "'"$DEVICE_UUID"'"
            }')
        
        echo "Monthly energy for $DEVICE_NAME:"
        echo "$MONTHLY_RESPONSE" | jq '.'
        
        # Get yearly energy
        YEARLY_RESPONSE=$(curl -s -X POST "$BASE_URL/outdoorsocket15a/v1/device/energyyear" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "method": "energyyear",
                "mobileId": "1234567890123456",
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID",
                "uuid": "'"$DEVICE_UUID"'"
            }')
        
        echo "Yearly energy for $DEVICE_NAME:"
        echo "$YEARLY_RESPONSE" | jq '.'
    elif [[ "$DEVICE_TYPE" == "ESW03-USA" ]]; then
        echo "Getting energy details for ESW03-USA..."
        
        # Get weekly energy
        WEEKLY_RESPONSE=$(curl -s -X POST "$BASE_URL/10a/v1/device/energyweek" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "method": "energyweek",
                "mobileId": "1234567890123456",
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID",
                "uuid": "'"$DEVICE_UUID"'"
            }')
        
        echo "Weekly energy for $DEVICE_NAME:"
        echo "$WEEKLY_RESPONSE" | jq '.'
        
        # Get monthly energy
        MONTHLY_RESPONSE=$(curl -s -X POST "$BASE_URL/10a/v1/device/energymonth" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "method": "energymonth",
                "mobileId": "1234567890123456",
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID",
                "uuid": "'"$DEVICE_UUID"'"
            }')
        
        echo "Monthly energy for $DEVICE_NAME:"
        echo "$MONTHLY_RESPONSE" | jq '.'
        
        # Get yearly energy
        YEARLY_RESPONSE=$(curl -s -X POST "$BASE_URL/10a/v1/device/energyyear" \
            -H "Content-Type: application/json" \
            -H "accept-language: en" \
            -H "accountId: $ACCOUNT_ID" \
            -H "appVersion: 2.8.6" \
            -H "tk: $TOKEN" \
            -H "tz: America/New_York" \
            -d '{
                "acceptLanguage": "en",
                "accountID": "'"$ACCOUNT_ID"'",
                "appVersion": "2.8.6",
                "method": "energyyear",
                "mobileId": "1234567890123456",
                "phoneBrand": "SM N9005",
                "phoneOS": "Android",
                "timeZone": "America/New_York",
                "token": "'"$TOKEN"'",
                "traceId": "TRACE_ID",
                "uuid": "'"$DEVICE_UUID"'"
            }')
        
        echo "Yearly energy for $DEVICE_NAME:"
        echo "$YEARLY_RESPONSE" | jq '.'
    fi
    
    echo "----------------------------------------"
done

# If no devices were found with the filter, show available device types
if [ -n "$DEVICE_FILTER" ] && [ "$FOUND_DEVICES" -eq 0 ]; then
    echo "No devices found matching filter: $DEVICE_FILTER"
    echo "Available device types:"
    printf '%s\n' "${ALL_DEVICE_TYPES[@]}" | sort -u
fi

echo "Done!" 