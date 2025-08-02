#!/bin/bash

# VeSync Authentication Debug Tool
# Helps diagnose authentication issues with new VeSync accounts

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Default values
API_BASE="https://smartapi.vesync.com"
APP_VERSION="VeSync 5.0.53"
PHONE_BRAND="SM N9005"
PHONE_OS="Android"
MOBILE_ID="1234567890123456"
USER_TYPE="1"
ACCEPT_LANGUAGE="en"
TZ="America/Chicago"
DEBUG_MODE=0
VERBOSE=0

# Function to display usage
usage() {
    echo "Usage: $0 -u EMAIL -p PASSWORD [OPTIONS]"
    echo ""
    echo "Required:"
    echo "  -u EMAIL       VeSync account email"
    echo "  -p PASSWORD    VeSync account password"
    echo ""
    echo "Options:"
    echo "  -a APP_VERSION App version string [default: VeSync 5.0.53]"
    echo "  -t TIMEZONE    Timezone [default: America/Chicago]"
    echo "  -d             Enable debug mode (saves all responses)"
    echo "  -v             Verbose output"
    echo "  -h             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -u user@example.com -p mypassword"
    echo "  $0 -u user@example.com -p mypassword -d -v"
    exit 1
}

# Parse command line arguments
while getopts "u:p:a:t:dvh" opt; do
    case $opt in
        u) EMAIL="$OPTARG" ;;
        p) PASSWORD="$OPTARG" ;;
        a) APP_VERSION="$OPTARG" ;;
        t) TZ="$OPTARG" ;;
        d) DEBUG_MODE=1 ;;
        v) VERBOSE=1 ;;
        h) usage ;;
        ?) usage ;;
    esac
done

# Check required parameters
if [ -z "${EMAIL:-}" ] || [ -z "${PASSWORD:-}" ]; then
    echo -e "${RED}Error: Email and password are required${NC}"
    usage
fi

# Create debug directory if debug mode is enabled
if [ $DEBUG_MODE -eq 1 ]; then
    DEBUG_DIR="vesync-debug-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$DEBUG_DIR"
    echo -e "${BLUE}Debug mode enabled. Saving responses to: $DEBUG_DIR${NC}"
fi

# Function to log messages
log() {
    if [ $VERBOSE -eq 1 ]; then
        echo -e "$1"
    fi
}

# Function to save debug data
save_debug() {
    if [ $DEBUG_MODE -eq 1 ]; then
        local filename="$1"
        local data="$2"
        echo "$data" > "$DEBUG_DIR/$filename"
    fi
}

# Function to redact PII from output
redact_pii() {
    local text="${1:-}"
    # Redact email (keep domain)
    local redacted=$(echo "$text" | sed -E "s/${EMAIL%%@*}@/[REDACTED]@/g")
    # Redact all tokens
    redacted=$(echo "$redacted" | sed -E 's/"token":"[^"]*"/"token":"[REDACTED]"/g')
    redacted=$(echo "$redacted" | sed -E 's/"accountID":"[^"]*"/"accountID":"[REDACTED]"/g')
    redacted=$(echo "$redacted" | sed -E 's/"password":"[^"]*"/"password":"[REDACTED]"/g')
    redacted=$(echo "$redacted" | sed -E 's/"nickName":"[^"]*"/"nickName":"[REDACTED]"/g')
    redacted=$(echo "$redacted" | sed -E 's/"mobileId":"[^"]*"/"mobileId":"[REDACTED]"/g')
    redacted=$(echo "$redacted" | sed -E 's/"avatarIcon":"[^"]*"/"avatarIcon":"[REDACTED]"/g')
    redacted=$(echo "$redacted" | sed -E 's/"email":"[^"]*@([^"]*)"/"email":"[REDACTED]@\1"/g')
    redacted=$(echo "$redacted" | sed -E 's/"verifyEmail":"[^"]*@([^"]*)"/"verifyEmail":"[REDACTED]@\1"/g')
    redacted=$(echo "$redacted" | sed -E 's/"uuid":"[^"]*"/"uuid":"[REDACTED]"/g')
    redacted=$(echo "$redacted" | sed -E 's/"cid":"[^"]*"/"cid":"[REDACTED]"/g')
    redacted=$(echo "$redacted" | sed -E 's/"macID":"[^"]*"/"macID":"[REDACTED]"/g')
    redacted=$(echo "$redacted" | sed -E 's/"deviceName":"[^"]*"/"deviceName":"[REDACTED]"/g')
    redacted=$(echo "$redacted" | sed -E 's/"traceId":"[^"]*"/"traceId":"[REDACTED]"/g')
    echo "$redacted"
}

# Function to make API request with redirect tracking
api_request() {
    local endpoint="$1"
    local data="$2"
    local description="$3"
    local full_url="$API_BASE$endpoint"
    
    echo -e "\n${YELLOW}Testing: $description${NC}"
    echo -e "${MAGENTA}URL: $full_url${NC}"
    
    # Always show request data with PII redacted
    echo -e "${BLUE}Request Payload:${NC}"
    echo "$data" | jq --arg email_domain "${EMAIL#*@}" '
        . | 
        if .email then .email = ("[REDACTED]@" + $email_domain) else . end |
        if .password then .password = "[REDACTED]" else . end |
        if .token and .token != "" then .token = "[REDACTED]" else . end |
        if .accountID and .accountID != "" then .accountID = "[REDACTED]" else . end |
        if .mobileId then .mobileId = "[REDACTED]" else . end
    ' 2>/dev/null || echo "$data"
    
    # Create temp file for headers
    headers_file=$(mktemp)
    
    # Make the request with redirect tracking
    response=$(curl -s -L \
        -w "\n%{http_code}\n%{url_effective}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "User-Agent: okhttp/4.12.0" \
        -H "Accept-Language: $ACCEPT_LANGUAGE" \
        -H "accept: application/json" \
        -D "$headers_file" \
        -d "$data" \
        "$full_url")
    
    # Split response parts
    url_effective=$(echo "$response" | tail -n1)
    http_code=$(echo "$response" | tail -n2 | head -n1)
    body=$(echo "$response" | sed '$d' | sed '$d')
    
    # Check for redirects
    if [ "$url_effective" != "$full_url" ]; then
        echo -e "${MAGENTA}⚠ Redirected to: $url_effective${NC}"
    fi
    
    # Always show key headers
    if [ -f "$headers_file" ]; then
        echo -e "${BLUE}Response Headers:${NC}"
        cat "$headers_file" | grep -E "^(HTTP|Location|Set-Cookie|Content-Type|X-)" | sed 's/Set-Cookie:.*/Set-Cookie: [REDACTED]/' | head -10
    fi
    
    # Clean up temp file
    rm -f "$headers_file"
    
    # Save debug data (unredacted for debugging)
    save_debug "${endpoint//\//_}-request.json" "$data"
    save_debug "${endpoint//\//_}-response.json" "$body"
    save_debug "${endpoint//\//_}-http-code.txt" "$http_code"
    save_debug "${endpoint//\//_}-url-effective.txt" "$url_effective"
    
    # Display results
    echo -e "${BLUE}HTTP Status: $http_code${NC}"
    
    # Parse and display response (with PII redacted)
    if [ -n "$body" ]; then
        # Try to parse as JSON
        if echo "$body" | jq . >/dev/null 2>&1; then
            local code=$(echo "$body" | jq -r '.code // .result.code // "N/A"')
            local msg=$(echo "$body" | jq -r '.msg // .result.msg // "N/A"')
            
            if [ "$code" = "0" ]; then
                echo -e "${GREEN}✓ Success${NC}"
            else
                echo -e "${RED}✗ Failed - Code: $code, Message: $msg${NC}"
            fi
            
            # Always show key response fields
            echo -e "${BLUE}Response Details:${NC}"
            
            # Check if this is a device list response
            if echo "$body" | jq -e '.result.list' >/dev/null 2>&1; then
                # Device list response
                echo "$body" | jq '{
                    code: .code,
                    msg: .msg,
                    traceId: .traceId // null | if . then "[REDACTED]" else null end,
                    result: {
                        total: .result.total // 0,
                        pageNo: .result.pageNo // null,
                        pageSize: .result.pageSize // null,
                        devices: .result.list // [] | length,
                        deviceList: .result.list // [] | map({
                            deviceType: .deviceType,
                            deviceName: "[REDACTED]",
                            deviceStatus: .deviceStatus,
                            connectionStatus: .connectionStatus,
                            connectionType: .connectionType,
                            model: .model // .deviceImg // null,
                            cid: "[REDACTED]",
                            uuid: "[REDACTED]",
                            macID: "[REDACTED]"
                        })
                    }
                }' 2>/dev/null || (echo "$body" | redact_pii | jq . 2>/dev/null || echo "$body")
            elif echo "$body" | jq -e '.result' >/dev/null 2>&1; then
                # Login or other response
                echo "$body" | jq --arg email_domain "${EMAIL#*@}" '{
                    code: .code,
                    msg: .msg,
                    traceId: .traceId // null | if . then "[REDACTED]" else null end,
                    result: {
                        accountID: .result.accountID // null | if . then "[REDACTED]" else null end,
                        token: .result.token // null | if . then "[REDACTED]" else null end,
                        userType: .result.userType // null,
                        nickName: .result.nickName // null | if . then "[REDACTED]" else null end,
                        email: .result.verifyEmail // .result.email // null | if . then ("[REDACTED]@" + ($email_domain)) else null end,
                        registerTime: .result.registerTime // null,
                        registerAppVersion: .result.registerAppVersion // null,
                        isRequiredVerify: .result.isRequiredVerify // null,
                        mailConfirmation: .result.mailConfirmation // null,
                        acceptLanguage: .result.acceptLanguage // null,
                        countryCode: .result.countryCode // null,
                        termsStatus: .result.termsStatus // null,
                        gdprStatus: .result.gdprStatus // null,
                        avatarIcon: .result.avatarIcon // null | if . then "[REDACTED]" else null end,
                        devices: .result.devices // null | if type == "array" then length else . end,
                        phoneBrand: .result.phoneBrand // null,
                        phoneOS: .result.phoneOS // null
                    } | with_entries(select(.value != null))
                } | with_entries(select(.value != null))' 2>/dev/null || (echo "$body" | redact_pii | jq . 2>/dev/null || echo "$body")
            else
                echo "$body" | redact_pii | jq . 2>/dev/null || echo "$body"
            fi
        else
            echo -e "${RED}✗ Invalid JSON response${NC}"
            log "$(echo "$body" | head -20 | redact_pii)"
        fi
    else
        echo -e "${RED}✗ Empty response${NC}"
    fi
    
    # Don't echo the body here - it's already been displayed
}

# Calculate MD5 hash
calculate_md5() {
    echo -n "$1" | md5sum | cut -d' ' -f1
}

# Function to test URL with curl verbose
test_connectivity() {
    local url="$1"
    local description="$2"
    
    echo -e "\n${YELLOW}$description${NC}"
    echo -e "${MAGENTA}Testing URL: $url${NC}"
    
    # Use curl with verbose output to see redirects
    local temp_file=$(mktemp)
    curl -s -L -v -X GET "$url" > "$temp_file" 2>&1
    
    # Extract relevant info
    local redirects=$(grep -E "< HTTP|< Location:" "$temp_file" | head -10)
    local final_code=$(grep "< HTTP" "$temp_file" | tail -1 | awk '{print $3}')
    
    if [ -n "$redirects" ]; then
        echo -e "${BLUE}HTTP Flow:${NC}"
        echo "$redirects"
    fi
    
    echo -e "${BLUE}Final HTTP Status: $final_code${NC}"
    
    rm -f "$temp_file"
}

# Redact email for display
DISPLAY_EMAIL="[REDACTED]@${EMAIL#*@}"

echo -e "\n${BLUE}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     VeSync Authentication Debug Tool          ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════╝${NC}"
echo -e "${BLUE}Account:${NC} $DISPLAY_EMAIL"
echo -e "${BLUE}API Base:${NC} $API_BASE"
echo -e "${BLUE}App Version:${NC} $APP_VERSION"

# Test 1: Basic connectivity with redirect tracking
echo -e "\n${YELLOW}Test 1: API Connectivity & Redirect Check${NC}"
test_connectivity "$API_BASE" "Base API URL"
test_connectivity "$API_BASE/cloud/v1/user/login" "Login Endpoint"

# Test 2: Login with different app versions
echo -e "\n${YELLOW}Test 2: Login Attempts${NC}"

# Prepare login data
HASHED_PASSWORD=$(calculate_md5 "$PASSWORD")
TIMESTAMP=$(date +%s)

# Try with current app version
login_data=$(cat <<EOF
{
    "email": "$EMAIL",
    "password": "$HASHED_PASSWORD",
    "appVersion": "$APP_VERSION",
    "phoneBrand": "$PHONE_BRAND",
    "phoneOS": "$PHONE_OS",
    "mobileId": "$MOBILE_ID",
    "userType": "$USER_TYPE",
    "acceptLanguage": "$ACCEPT_LANGUAGE",
    "timeZone": "$TZ",
    "method": "login",
    "token": "",
    "accountID": "",
    "devToken": "",
    "traceId": "$TIMESTAMP"
}
EOF
)

# Test standard login
api_request "/cloud/v1/user/login" "$login_data" "Standard Login"
# Capture the response separately for token extraction
login_response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "User-Agent: okhttp/4.12.0" \
    -H "Accept-Language: $ACCEPT_LANGUAGE" \
    -H "accept: application/json" \
    -d "$login_data" \
    "$API_BASE/cloud/v1/user/login")

# Check if we got a token
if echo "$login_response" | jq -e '.result.token' >/dev/null 2>&1; then
    TOKEN=$(echo "$login_response" | jq -r '.result.token')
    ACCOUNT_ID=$(echo "$login_response" | jq -r '.result.accountID')
    echo -e "${GREEN}✓ Login successful!${NC}"
    echo -e "Token: [REDACTED]"
    echo -e "Account ID: [REDACTED]"
    
    # Test 3: Try to get devices
    echo -e "\n${YELLOW}Test 3: Device List${NC}"
    device_data=$(cat <<EOF
{
    "token": "$TOKEN",
    "accountID": "$ACCOUNT_ID",
    "appVersion": "$APP_VERSION",
    "phoneBrand": "$PHONE_BRAND",
    "phoneOS": "$PHONE_OS",
    "acceptLanguage": "$ACCEPT_LANGUAGE",
    "timeZone": "$TZ",
    "method": "devices",
    "pageNo": 1,
    "pageSize": 100,
    "traceId": "$TIMESTAMP"
}
EOF
)
    
    api_request "/cloud/v2/deviceManaged/devices" "$device_data" "Get Device List"
else
    # Try alternative app versions
    echo -e "\n${YELLOW}Trying alternative app versions...${NC}"
    
    for version in "VeSync 3.2.55" "VeSync 5.6.53" "VeSync 6.0.00" "Homebridge 1.0.0"; do
        login_data_alt=$(echo "$login_data" | jq --arg v "$version" '.appVersion = $v')
        api_request "/cloud/v1/user/login" "$login_data_alt" "Login with $version"
    done
fi

# Test 4: Check different endpoints
echo -e "\n${YELLOW}Test 4: Alternative Endpoints${NC}"

# Try v2 login endpoint
login_v2_data=$(echo "$login_data" | jq '. + {devToken: ""}')
api_request "/cloud/v2/user/login" "$login_v2_data" "V2 Login Endpoint"

# Try v3 login endpoint
api_request "/cloud/v3/user/login" "$login_data" "V3 Login Endpoint"

# Test 5: Check for geographic redirects
echo -e "\n${YELLOW}Test 5: Geographic Redirect Test${NC}"
test_connectivity "https://www.vesync.com/api" "VeSync Main Site API"

# Generate summary
echo -e "\n${BLUE}╔═══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Debug Summary                ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
echo -e "${BLUE}Account:${NC} $DISPLAY_EMAIL"
echo -e "${BLUE}API Base:${NC} $API_BASE"
echo -e "${BLUE}Timestamp:${NC} $(date)"

if [ $DEBUG_MODE -eq 1 ]; then
    echo -e "\n${GREEN}Debug data saved to: $DEBUG_DIR${NC}"
    echo "You can share this directory with developers for troubleshooting."
    echo "${YELLOW}Note: The debug files contain unredacted data for troubleshooting.${NC}"
    
    # Create summary file with redacted info
    cat > "$DEBUG_DIR/summary.txt" <<EOF
VeSync Debug Summary
====================
Date: $(date)
Email: $DISPLAY_EMAIL
API Base: $API_BASE
App Version: $APP_VERSION

Test Results:
- See individual test files for details
- All sensitive data has been saved unredacted for debugging
EOF
fi

