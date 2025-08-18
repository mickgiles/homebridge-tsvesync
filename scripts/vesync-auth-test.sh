#!/bin/bash

# VeSync Authentication Type Testing Script
# Consolidated version - tests both NEW and LEGACY authentication flows
# Supports regional endpoints, PII redaction, and comprehensive error reporting
#
# Usage: ./vesync-auth-test.sh [-v] [-d] [email] [password]
#        ./vesync-auth-test.sh --help
#
# Environment variables: VESYNC_USERNAME, VESYNC_PASSWORD

set -eo pipefail

# Script constants
SCRIPT_VERSION="2.1.0"
SCRIPT_NAME="VeSync Authentication Type Detector"
DEFAULT_TIMEOUT=15

# Colors and icons
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SUCCESS="✓"
FAILURE="✗"
WARNING="⚠"
INFO="ℹ"
ARROW="→"

# Global variables
VERBOSE=false
DEBUG=false
EMAIL=""
PASSWORD=""
APP_ID=""
TERMINAL_ID=""
DEBUG_DIR=""

# Function to show usage
show_usage() {
    printf '%s\n' "${BOLD}${SCRIPT_NAME} v${SCRIPT_VERSION}${NC}"
    printf '\n'
    printf '%s\n' "${BOLD}USAGE:${NC}"
    printf '  %s [OPTIONS] [EMAIL] [PASSWORD]\n' "$0"
    printf '\n'
    printf '%s\n' "${BOLD}OPTIONS:${NC}"
    printf '  -v, --verbose     Enable verbose output (show detailed API responses)\n'
    printf '  -d, --debug       Enable debug mode (save API responses to files)\n'
    printf '  -h, --help        Show this help message\n'
    printf '\n'
    printf '%s\n' "${BOLD}ARGUMENTS:${NC}"
    printf '  EMAIL             VeSync account email address\n'
    printf '  PASSWORD          VeSync account password\n'
    printf '\n'
    printf '%s\n' "${BOLD}ENVIRONMENT VARIABLES:${NC}"
    printf '  VESYNC_USERNAME   VeSync account email (alternative to EMAIL argument)\n'
    printf '  VESYNC_PASSWORD   VeSync account password (alternative to PASSWORD argument)\n'
    printf '\n'
    printf '%s\n' "${BOLD}EXAMPLES:${NC}"
    printf '  %s user@example.com mypassword\n' "$0"
    printf '  %s -v user@example.com mypassword\n' "$0"
    printf '  VESYNC_USERNAME=user@example.com VESYNC_PASSWORD=mypassword %s\n' "$0"
}

# Function to log messages
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%H:%M:%S')
    
    case $level in
        "ERROR")   echo -e "${RED}[${timestamp}] ERROR: ${message}${NC}" >&2 ;;
        "WARN")    echo -e "${YELLOW}[${timestamp}] WARN:  ${message}${NC}" ;;
        "INFO")    echo -e "${BLUE}[${timestamp}] INFO:  ${message}${NC}" ;;
        "SUCCESS") echo -e "${GREEN}[${timestamp}] SUCCESS: ${message}${NC}" ;;
        "DEBUG")   [[ "$VERBOSE" == "true" ]] && echo -e "${CYAN}[${timestamp}] DEBUG: ${message}${NC}" ;;
    esac
}

# Function to redact PII
redact_pii() {
    local input="$1"
    local type="${2:-email}"
    
    case $type in
        "email")
            if [[ "$input" =~ ^[^@]+@(.+)$ ]]; then
                echo "***@${BASH_REMATCH[1]}"
            else
                echo "***"
            fi
            ;;
        "token"|"password")
            local len=${#input}
            if [[ $len -gt 8 ]]; then
                echo "${input:0:4}...${input: -4}"
            elif [[ $len -gt 0 ]]; then
                echo "***"
            else
                echo ""
            fi
            ;;
        "account_id")
            local len=${#input}
            if [[ $len -gt 8 ]]; then
                echo "${input:0:4}...${input: -4}"
            else
                echo "***"
            fi
            ;;
        *)
            echo "***"
            ;;
    esac
}

# Function to generate unique identifiers
generate_app_id() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex 4
    elif [[ -r /dev/urandom ]]; then
        cat /dev/urandom | LC_ALL=C tr -dc 'a-z0-9' | fold -w 8 | head -n 1
    else
        echo "app$(date +%s | tail -c 5)"
    fi
}

generate_terminal_id() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex 8
    elif [[ -r /dev/urandom ]]; then
        cat /dev/urandom | LC_ALL=C tr -dc 'a-z0-9' | fold -w 16 | head -n 1
    else
        echo "terminal$(date +%s)"
    fi
}

# Function to setup debug directory
setup_debug_dir() {
    if [[ "$DEBUG" == "true" ]]; then
        DEBUG_DIR="/tmp/vesync-auth-debug-$(date +%s)"
        mkdir -p "$DEBUG_DIR"
        log "DEBUG" "Debug directory created: $DEBUG_DIR"
    fi
}

# Function to save response to debug file
save_debug_response() {
    local response="$1"
    local filename="$2"
    
    if [[ "$DEBUG" == "true" && -n "$DEBUG_DIR" ]]; then
        if command -v jq >/dev/null 2>&1; then
            echo "$response" | jq '.' > "$DEBUG_DIR/$filename.json" 2>/dev/null || echo "$response" > "$DEBUG_DIR/$filename.txt"
        else
            echo "$response" > "$DEBUG_DIR/$filename.txt"
        fi
        log "DEBUG" "Response saved to: $DEBUG_DIR/$filename"
    fi
}

# Function to hash password
hash_password() {
    local password="$1"
    if command -v md5 >/dev/null 2>&1; then
        echo -n "$password" | md5 -q
    elif command -v md5sum >/dev/null 2>&1; then
        echo -n "$password" | md5sum | cut -d' ' -f1
    else
        log "ERROR" "No MD5 utility available (md5 or md5sum)"
        exit 1
    fi
}

# Function to extract JSON values (with fallback if jq not available)
extract_json_value() {
    local json="$1"
    local key="$2"
    
    if command -v jq >/dev/null 2>&1; then
        echo "$json" | jq -r ".$key" 2>/dev/null || echo ""
    else
        # Fallback using grep and cut
        echo "$json" | grep -o "\"$key\":[^,}]*" | cut -d: -f2- | sed 's/^"//;s/"$//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | head -n1
    fi
}

# Function to get error code meaning
get_error_code_meaning() {
    local code="$1"
    case "$code" in
        "-11000086") echo "Legacy authentication required" ;;
        "-11012022") echo "App version too low / API version mismatch" ;;
        "-11260022") echo "Cross-region authentication error" ;;
        "-10011") echo "Account does not exist" ;;
        "-10013") echo "Account locked" ;;
        "-10014") echo "Incorrect password" ;;
        "-10015") echo "Account not activated" ;;
        "-11000020") echo "Invalid token" ;;
        "-11000021") echo "Token expired" ;;
        "-11000041") echo "Too many requests" ;;
        *) echo "" ;;
    esac
}

# Function to explain error codes
explain_error_code() {
    local code="$1"
    local message="$2"
    local meaning=$(get_error_code_meaning "$code")
    
    if [[ -n "$meaning" ]]; then
        echo -e "${RED}${FAILURE}${NC} Error Code: ${BOLD}$code${NC}"
        echo -e "   Meaning: $meaning"
        [[ -n "$message" ]] && echo -e "   Message: $message"
    else
        echo -e "${RED}${FAILURE}${NC} Error Code: ${BOLD}$code${NC}"
        [[ -n "$message" ]] && echo -e "   Message: $message"
        echo -e "   ${YELLOW}${WARNING}${NC} Unknown error code - may indicate API changes"
    fi
}

# Function to test network connectivity
test_connectivity() {
    log "INFO" "Testing network connectivity..."
    
    local endpoints=("smartapi.vesync.com" "smartapi.vesync.eu")
    local connected=false
    
    for endpoint in "${endpoints[@]}"; do
        if curl -s --connect-timeout 5 --max-time 10 "https://$endpoint" >/dev/null 2>&1; then
            log "SUCCESS" "Connected to $endpoint"
            connected=true
        else
            log "WARN" "Cannot connect to $endpoint"
        fi
    done
    
    if [[ "$connected" == "false" ]]; then
        log "ERROR" "No connectivity to VeSync endpoints. Check your internet connection."
        exit 1
    fi
}

# Function to test NEW authentication
test_new_authentication() {
    local base_url="$1"
    local region="$2"
    
    echo -e "\n${YELLOW}${BOLD}Testing NEW Authentication (PR #340)...${NC}"
    echo -e "${CYAN}${ARROW} Endpoint: $base_url${NC}"
    echo -e "${CYAN}${ARROW} Region: $region${NC}"
    
    local hashed_password=$(hash_password "$PASSWORD")
    local timestamp=$(date +%s)
    
    # Build JSON payload as a single line (this approach works reliably)
    local auth_payload="{\"email\":\"$EMAIL\",\"method\":\"authByPWDOrOTM\",\"password\":\"$hashed_password\",\"acceptLanguage\":\"en\",\"accountID\":\"\",\"authProtocolType\":\"generic\",\"clientInfo\":\"SM N9005\",\"clientType\":\"vesyncApp\",\"clientVersion\":\"VeSync 5.6.60\",\"debugMode\":false,\"osInfo\":\"Android\",\"terminalId\":\"$TERMINAL_ID\",\"timeZone\":\"America/New_York\",\"token\":\"\",\"userCountryCode\":\"$region\",\"appID\":\"$APP_ID\",\"sourceAppID\":\"$APP_ID\",\"traceId\":\"APP${APP_ID}${timestamp}\"}"
    
    log "DEBUG" "Sending auth request to: $base_url/globalPlatform/api/accountAuth/v1/authByPWDOrOTM"
    
    local auth_response=$(curl -s --connect-timeout $DEFAULT_TIMEOUT --max-time $DEFAULT_TIMEOUT \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -H "User-Agent: VeSync/5.6.60 (Android; SM N9005)" \
        -d "$auth_payload" \
        "$base_url/globalPlatform/api/accountAuth/v1/authByPWDOrOTM" 2>/dev/null || echo '{"error":"network_error"}')
    
    local region_lower=$(echo "$region" | tr '[:upper:]' '[:lower:]')
    save_debug_response "$auth_response" "new_auth_${region_lower}_step1"
    
    [[ "$VERBOSE" == "true" ]] && {
        echo -e "\n${CYAN}Raw Response:${NC}"
        if command -v jq >/dev/null 2>&1; then
            echo "$auth_response" | jq '.'
        else
            echo "$auth_response"
        fi
        echo ""
    }
    
    # Check for network errors
    if echo "$auth_response" | grep -q '"error":"network_error"' || [[ -z "$auth_response" ]]; then
        echo -e "${RED}${FAILURE}${NC} Network error - cannot reach authentication endpoint"
        return 1
    fi
    
    local response_code=$(extract_json_value "$auth_response" "code")
    local response_msg=$(extract_json_value "$auth_response" "msg")
    local authorize_code=$(extract_json_value "$auth_response" "result.authorizeCode")
    
    log "DEBUG" "Response code: $response_code"
    log "DEBUG" "Response message: $response_msg"
    
    case "$response_code" in
        "0")
            if [[ -n "$authorize_code" && "$authorize_code" != "null" ]]; then
                echo -e "${GREEN}${SUCCESS}${NC} NEW Authentication Step 1 successful!"
                echo -e "   ${ARROW} Authorize Code: $(redact_pii "$authorize_code" "token")"
                
                # Step 2: Exchange authorize code for token
                echo -e "\n${CYAN}Testing Step 2: Token exchange...${NC}"
                
                local timestamp2=$(date +%s)
                local biz_token=$(extract_json_value "$auth_response" "result.bizToken")
                
                # Build token payload - omit bizToken if null/empty
                local token_payload="{\"method\":\"loginByAuthorizeCode4Vesync\",\"authorizeCode\":\"$authorize_code\",\"acceptLanguage\":\"en\",\"clientInfo\":\"SM N9005\",\"clientType\":\"vesyncApp\",\"clientVersion\":\"VeSync 5.6.60\",\"debugMode\":false,\"emailSubscriptions\":false,\"osInfo\":\"Android\",\"terminalId\":\"$TERMINAL_ID\",\"timeZone\":\"America/New_York\",\"userCountryCode\":\"$region\",\"traceId\":\"APP${APP_ID}${timestamp2}\"}"
                
                # Only add bizToken if it exists and is not "null"
                if [[ -n "$biz_token" && "$biz_token" != "null" ]]; then
                    # Insert bizToken before userCountryCode
                    token_payload="${token_payload/\"userCountryCode\"/\"bizToken\":\"$biz_token\",\"userCountryCode\"}"
                fi
                
                log "DEBUG" "Token exchange payload: $token_payload"
                log "DEBUG" "Token exchange endpoint: $base_url/user/api/accountManage/v1/loginByAuthorizeCode4Vesync"
                
                local token_response=$(curl -s --connect-timeout $DEFAULT_TIMEOUT --max-time $DEFAULT_TIMEOUT \
                    -X POST \
                    -H "Content-Type: application/json" \
                    -H "Accept: application/json" \
                    -H "User-Agent: VeSync/5.6.60 (Android; SM N9005)" \
                    -d "$token_payload" \
                    "$base_url/user/api/accountManage/v1/loginByAuthorizeCode4Vesync" 2>/dev/null || echo '{"error":"network_error"}')
                
                local region_lower2=$(echo "$region" | tr '[:upper:]' '[:lower:]')
                save_debug_response "$token_response" "new_auth_${region_lower2}_step2"
                
                local token_code=$(extract_json_value "$token_response" "code")
                local token=$(extract_json_value "$token_response" "result.token")
                local account_id=$(extract_json_value "$token_response" "result.accountID")
                local country_code=$(extract_json_value "$token_response" "result.countryCode")
                
                if [[ "$token_code" == "0" && -n "$token" && "$token" != "null" ]]; then
                    echo -e "${GREEN}${SUCCESS}${NC} NEW Authentication Step 2 successful!"
                    echo -e "   ${ARROW} Token: $(redact_pii "$token" "token")"
                    echo -e "   ${ARROW} Account ID: $(redact_pii "$account_id" "account_id")"
                    echo -e "   ${ARROW} Country: ${country_code:-unknown}"
                    return 0
                elif [[ "$token_code" == "-11260022" ]]; then
                    # Handle cross-region error with retry (like pyvesync PR #340)
                    echo -e "${YELLOW}${WARNING}${NC} Cross-region error detected, attempting retry..."
                    
                    local region_change_token=$(extract_json_value "$token_response" "result.bizToken")
                    local new_country_code=$(extract_json_value "$token_response" "result.countryCode")
                    
                    if [[ -n "$region_change_token" && "$region_change_token" != "null" ]]; then
                        echo -e "   ${ARROW} Got region change token from error response"
                        echo -e "   ${ARROW} New country code: ${new_country_code:-unknown}"
                        
                        # Step 2 Retry: Use region change token
                        echo -e "\n${CYAN}Testing Step 2 Retry: With region change token...${NC}"
                        
                        local timestamp3=$(date +%s)
                        local retry_payload="{\"method\":\"loginByAuthorizeCode4Vesync\",\"authorizeCode\":\"$authorize_code\",\"acceptLanguage\":\"en\",\"clientInfo\":\"SM N9005\",\"clientType\":\"vesyncApp\",\"clientVersion\":\"VeSync 5.6.60\",\"debugMode\":false,\"emailSubscriptions\":false,\"osInfo\":\"Android\",\"terminalId\":\"$TERMINAL_ID\",\"timeZone\":\"America/New_York\",\"bizToken\":\"$region_change_token\",\"regionChange\":\"last_region\",\"userCountryCode\":\"${new_country_code:-$region}\",\"traceId\":\"APP${APP_ID}${timestamp3}\"}"
                        
                        log "DEBUG" "Retry payload: $retry_payload"
                        
                        local retry_response=$(curl -s --connect-timeout $DEFAULT_TIMEOUT --max-time $DEFAULT_TIMEOUT \
                            -X POST \
                            -H "Content-Type: application/json" \
                            -H "Accept: application/json" \
                            -H "User-Agent: VeSync/5.6.60 (Android; SM N9005)" \
                            -d "$retry_payload" \
                            "$base_url/user/api/accountManage/v1/loginByAuthorizeCode4Vesync" 2>/dev/null || echo '{"error":"network_error"}')
                        
                        save_debug_response "$retry_response" "new_auth_${region_lower2}_step2_retry"
                        
                        local retry_code=$(extract_json_value "$retry_response" "code")
                        local retry_token=$(extract_json_value "$retry_response" "result.token")
                        local retry_account_id=$(extract_json_value "$retry_response" "result.accountID")
                        local retry_country=$(extract_json_value "$retry_response" "result.countryCode")
                        
                        if [[ "$retry_code" == "0" && -n "$retry_token" && "$retry_token" != "null" ]]; then
                            echo -e "${GREEN}${SUCCESS}${NC} NEW Authentication Step 2 Retry successful!"
                            echo -e "   ${ARROW} Token: $(redact_pii "$retry_token" "token")"
                            echo -e "   ${ARROW} Account ID: $(redact_pii "$retry_account_id" "account_id")"
                            echo -e "   ${ARROW} Country: ${retry_country:-$new_country_code}"
                            return 0
                        else
                            echo -e "${RED}${FAILURE}${NC} NEW Authentication Step 2 Retry failed"
                            explain_error_code "$retry_code" "$(extract_json_value "$retry_response" "msg")"
                            return 1
                        fi
                    else
                        echo -e "${RED}${FAILURE}${NC} No region change token in error response"
                        return 1
                    fi
                else
                    echo -e "${RED}${FAILURE}${NC} NEW Authentication Step 2 failed"
                    explain_error_code "$token_code" "$response_msg"
                    return 1
                fi
            else
                echo -e "${RED}${FAILURE}${NC} NEW Authentication failed - no authorize code received"
                return 1
            fi
            ;;
        "-11000086")
            echo -e "${BLUE}${INFO}${NC} Legacy authentication required"
            echo -e "   ${ARROW} This account uses the traditional login flow"
            return 2  # Special return code for legacy auth required
            ;;
        "-11260022")
            echo -e "${YELLOW}${WARNING}${NC} Cross-region authentication error"
            echo -e "   ${ARROW} Account may be registered in different region"
            return 3  # Special return code for cross-region
            ;;
        *)
            explain_error_code "$response_code" "$response_msg"
            return 1
            ;;
    esac
}

# Function to test LEGACY authentication
test_legacy_authentication() {
    local base_url="$1"
    local region="$2"
    
    echo -e "\n${YELLOW}${BOLD}Testing LEGACY Authentication...${NC}"
    echo -e "${CYAN}${ARROW} Endpoint: $base_url${NC}"
    echo -e "${CYAN}${ARROW} Region: $region${NC}"
    
    local hashed_password=$(hash_password "$PASSWORD")
    local timestamp=$(date +%s)
    
    # Build legacy payload as single line
    local legacy_payload="{\"email\":\"$EMAIL\",\"password\":\"$hashed_password\",\"appVersion\":\"2.8.6\",\"phoneBrand\":\"SM N9005\",\"phoneOS\":\"Android\",\"acceptLanguage\":\"en\",\"timeZone\":\"America/New_York\",\"method\":\"login\",\"token\":\"\",\"accountID\":\"\",\"devToken\":\"\",\"userType\":\"1\",\"traceId\":\"$timestamp\"}"
    
    log "DEBUG" "Sending legacy auth request to: $base_url/cloud/v1/user/login"
    
    local legacy_response=$(curl -s --connect-timeout $DEFAULT_TIMEOUT --max-time $DEFAULT_TIMEOUT \
        -X POST \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -H "User-Agent: VeSync/2.8.6 (Android; SM N9005)" \
        -d "$legacy_payload" \
        "$base_url/cloud/v1/user/login" 2>/dev/null || echo '{"error":"network_error"}')
    
    local region_lower=$(echo "$region" | tr '[:upper:]' '[:lower:]')
    save_debug_response "$legacy_response" "legacy_auth_${region_lower}"
    
    [[ "$VERBOSE" == "true" ]] && {
        echo -e "\n${CYAN}Raw Response:${NC}"
        if command -v jq >/dev/null 2>&1; then
            echo "$legacy_response" | jq '.'
        else
            echo "$legacy_response"
        fi
        echo ""
    }
    
    # Check for network errors
    if echo "$legacy_response" | grep -q '"error":"network_error"' || [[ -z "$legacy_response" ]]; then
        echo -e "${RED}${FAILURE}${NC} Network error - cannot reach legacy authentication endpoint"
        return 1
    fi
    
    local response_code=$(extract_json_value "$legacy_response" "code")
    local response_msg=$(extract_json_value "$legacy_response" "msg")
    local token=$(extract_json_value "$legacy_response" "result.token")
    local account_id=$(extract_json_value "$legacy_response" "result.accountID")
    local country_code=$(extract_json_value "$legacy_response" "result.countryCode")
    
    log "DEBUG" "Legacy response code: $response_code"
    log "DEBUG" "Legacy response message: $response_msg"
    
    if [[ -n "$token" && "$token" != "null" ]]; then
        echo -e "${GREEN}${SUCCESS}${NC} Legacy authentication successful!"
        echo -e "   ${ARROW} Token: $(redact_pii "$token" "token")"
        echo -e "   ${ARROW} Account ID: $(redact_pii "$account_id" "account_id")"  
        echo -e "   ${ARROW} Country: ${country_code:-unknown}"
        return 0
    else
        case "$response_code" in
            "-11012022")
                echo -e "${YELLOW}${WARNING}${NC} App version too low error"
                echo -e "   ${ARROW} This may indicate API changes requiring newer app version"
                ;;
            "-11260022")
                echo -e "${YELLOW}${WARNING}${NC} Cross-region authentication error"
                echo -e "   ${ARROW} Account may be registered in different region"
                return 3  # Special return code for cross-region
                ;;
            *)
                explain_error_code "$response_code" "$response_msg"
                ;;
        esac
        return 1
    fi
}

# Function to test authentication for multiple regions
test_regional_authentication() {
    local auth_type="$1"  # "new" or "legacy"
    local regions=("US" "EU")
    local endpoints=("https://smartapi.vesync.com" "https://smartapi.vesync.eu")
    local successful_regions=""
    local failed_regions=""
    local cross_region_errors=""
    
    # Initialize global variables to store individual region results
    if [[ "$auth_type" == "new" ]]; then
        NEW_AUTH_US_RESULT=1
        NEW_AUTH_EU_RESULT=1
    else
        LEGACY_AUTH_US_RESULT=1
        LEGACY_AUTH_EU_RESULT=1
    fi
    
    for i in "${!regions[@]}"; do
        local region="${regions[i]}"
        local base_url="${endpoints[i]}"
        local result=0
        
        echo -e "\n${CYAN}${ARROW} Testing $auth_type authentication for $region region...${NC}"
        
        # Test authentication with error handling to prevent script exit
        if [[ "$auth_type" == "new" ]]; then
            test_new_authentication "$base_url" "$region" || result=$?
            if [[ "$region" == "US" ]]; then
                NEW_AUTH_US_RESULT=$result
            else
                NEW_AUTH_EU_RESULT=$result
            fi
        else
            test_legacy_authentication "$base_url" "$region" || result=$?
            if [[ "$region" == "US" ]]; then
                LEGACY_AUTH_US_RESULT=$result
            else
                LEGACY_AUTH_EU_RESULT=$result
            fi
        fi
        
        # Display immediate result for this region
        case $result in
            0) 
                echo -e "${GREEN}${SUCCESS}${NC} $auth_type authentication successful for $region region"
                successful_regions="$successful_regions $region" 
                ;;
            2)
                echo -e "${BLUE}${INFO}${NC} $auth_type authentication not supported for $region region (legacy required)"
                failed_regions="$failed_regions $region"
                ;;
            3) 
                echo -e "${YELLOW}${WARNING}${NC} Cross-region authentication error for $region region"
                cross_region_errors="$cross_region_errors $region" 
                ;;
            *) 
                echo -e "${RED}${FAILURE}${NC} $auth_type authentication failed for $region region"
                failed_regions="$failed_regions $region" 
                ;;
        esac
    done
    
    # Report overall regional results
    if [[ -n "$successful_regions" ]]; then
        echo -e "\n${GREEN}${SUCCESS}${NC} $auth_type authentication successful in regions:$successful_regions"
        return 0
    elif [[ -n "$cross_region_errors" ]]; then
        echo -e "\n${YELLOW}${WARNING}${NC} Cross-region errors in:$cross_region_errors"
        return 3
    else
        echo -e "\n${RED}${FAILURE}${NC} $auth_type authentication failed in all tested regions"
        return 1
    fi
}

# Function to guess region from email domain
guess_region_from_email() {
    local email="$1"
    local domain="${email##*@}"
    
    # European domains
    local eu_domains=(".de" ".fr" ".it" ".es" ".uk" ".co.uk" ".nl" ".be" ".at" ".ch" ".se" ".no" ".dk" ".fi")
    
    for eu_domain in "${eu_domains[@]}"; do
        if [[ "$domain" == *"$eu_domain" ]]; then
            echo "EU"
            return
        fi
    done
    
    echo "US"
}

# Function to print section header
print_section() {
    local title="$1"
    local width=80
    local padding=$((($width - ${#title} - 2) / 2))
    
    echo ""
    echo -e "${BLUE}$(printf '═%.0s' $(seq 1 $width))${NC}"
    echo -e "${BLUE}$(printf '═%.0s' $(seq 1 $padding)) ${BOLD}$title${NC}${BLUE} $(printf '═%.0s' $(seq 1 $padding))${NC}"
    echo -e "${BLUE}$(printf '═%.0s' $(seq 1 $width))${NC}"
}

# Function to get result status display
get_result_status() {
    local result="$1"
    case "$result" in
        0) echo -e "${GREEN}${SUCCESS} Success${NC}" ;;
        2) echo -e "${BLUE}${INFO} Legacy Required${NC}" ;;
        3) echo -e "${YELLOW}${WARNING} Region Mismatch${NC}" ;;
        *) echo -e "${RED}${FAILURE} Failed${NC}" ;;
    esac
}

# Function to print final summary and recommendations
print_final_summary() {
    local new_auth_result="$1"
    local legacy_auth_result="$2"
    local detected_region="$3"
    
    print_section "FINAL SUMMARY & RECOMMENDATIONS"
    
    echo -e "${BOLD}Account Information:${NC}"
    echo -e "  Email: $(redact_pii "$EMAIL" "email")"
    echo -e "  Detected Region: $detected_region"
    echo ""
    
    echo -e "${BOLD}Authentication Test Results:${NC}"
    echo -e "  NEW Auth US: $(get_result_status "${NEW_AUTH_US_RESULT:-1}")"
    echo -e "  NEW Auth EU: $(get_result_status "${NEW_AUTH_EU_RESULT:-1}")"
    echo -e "  LEGACY Auth US: $(get_result_status "${LEGACY_AUTH_US_RESULT:-1}")"
    echo -e "  LEGACY Auth EU: $(get_result_status "${LEGACY_AUTH_EU_RESULT:-1}")"
    echo ""
    
    # Determine which method(s) work
    local working_methods=""
    if [[ "${NEW_AUTH_US_RESULT:-1}" == "0" || "${NEW_AUTH_EU_RESULT:-1}" == "0" ]]; then
        working_methods="NEW Authentication"
    fi
    if [[ "${LEGACY_AUTH_US_RESULT:-1}" == "0" || "${LEGACY_AUTH_EU_RESULT:-1}" == "0" ]]; then
        if [[ -n "$working_methods" ]]; then
            working_methods="$working_methods, LEGACY Authentication"
        else
            working_methods="LEGACY Authentication"
        fi
    fi
    
    if [[ -n "$working_methods" ]]; then
        echo -e "${BOLD}${GREEN}FINAL VERDICT: $working_methods works for this account${NC}"
    else
        echo -e "${BOLD}${RED}FINAL VERDICT: No authentication methods worked${NC}"
    fi
    echo ""
    
    # Determine authentication type based on individual region results
    local new_auth_works=false
    local legacy_auth_works=false
    
    # Check if NEW auth worked in any region
    if [[ "${NEW_AUTH_US_RESULT:-1}" == "0" || "${NEW_AUTH_EU_RESULT:-1}" == "0" ]]; then
        new_auth_works=true
    fi
    
    # Check if LEGACY auth worked in any region
    if [[ "${LEGACY_AUTH_US_RESULT:-1}" == "0" || "${LEGACY_AUTH_EU_RESULT:-1}" == "0" ]]; then
        legacy_auth_works=true
    fi
    
    # Determine authentication type
    if [[ "$new_auth_works" == "true" ]]; then
        echo -e "  ${GREEN}${SUCCESS}${NC} ${BOLD}Authentication Type: NEW (PR #340)${NC}"
        echo -e "  ${ARROW} Your account supports the new two-step authentication flow"
        echo -e "  ${ARROW} Compatible with pyvesync PR #340"
        echo -e "  ${ARROW} Uses VeSync app version 5.6.60 or higher"
        
    elif [[ "$legacy_auth_works" == "true" ]]; then
        # Check if new auth explicitly required legacy (returned code 2)
        if [[ "${NEW_AUTH_US_RESULT:-1}" == "2" || "${NEW_AUTH_EU_RESULT:-1}" == "2" ]]; then
            echo -e "  ${BLUE}${INFO}${NC} ${BOLD}Authentication Type: LEGACY ONLY${NC}"
            echo -e "  ${ARROW} Account explicitly requires legacy authentication"
        else
            echo -e "  ${YELLOW}${WARNING}${NC} ${BOLD}Authentication Type: LEGACY (Fallback)${NC}"
            echo -e "  ${ARROW} New auth failed, but legacy auth works"
        fi
        echo -e "  ${ARROW} Uses traditional single-step login flow"
        echo -e "  ${ARROW} Compatible with existing pyvesync implementations"
        echo -e "  ${ARROW} Uses VeSync app version 2.8.6"
        
    elif [[ "${NEW_AUTH_US_RESULT:-1}" == "3" || "${NEW_AUTH_EU_RESULT:-1}" == "3" || "${LEGACY_AUTH_US_RESULT:-1}" == "3" || "${LEGACY_AUTH_EU_RESULT:-1}" == "3" ]]; then
        echo -e "  ${YELLOW}${WARNING}${NC} ${BOLD}Authentication Type: REGION MISMATCH${NC}"
        echo -e "  ${ARROW} Cross-region authentication errors detected"
        echo -e "  ${ARROW} Try different regional endpoints:"
        echo -e "    - US: https://smartapi.vesync.com"
        echo -e "    - EU: https://smartapi.vesync.eu"
        
    else
        echo -e "  ${RED}${FAILURE}${NC} ${BOLD}Authentication Type: UNDETERMINED${NC}"
        echo -e "  ${ARROW} Both new and legacy authentication failed"
        echo -e "  ${ARROW} Verify your email and password are correct"
        echo -e "  ${ARROW} Check if your account is locked or suspended"
    fi
    
    # Additional troubleshooting info
    echo ""
    echo -e "${BOLD}Troubleshooting:${NC}"
    if [[ "$DEBUG" == "true" ]]; then
        echo -e "  • Debug files saved to: ${DEBUG_DIR:-/tmp/vesync-auth-debug-*}"
    fi
    echo -e "  • Run with -v flag for verbose API responses"
    echo -e "  • Run with -d flag to save debug files"
    echo -e "  • Check network connectivity to VeSync endpoints"
    
    print_section "SCRIPT COMPLETED"
}

# Main execution function
main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -d|--debug)
                DEBUG=true
                VERBOSE=true  # Debug implies verbose
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            -*)
                echo "Unknown option: $1" >&2
                show_usage
                exit 1
                ;;
            *)
                if [[ -z "$EMAIL" ]]; then
                    EMAIL="$1"
                elif [[ -z "$PASSWORD" ]]; then
                    PASSWORD="$1"
                else
                    echo "Too many arguments" >&2
                    show_usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Load environment variables if available
    if [[ -f .env ]]; then
        set -a
        source .env
        set +a
    fi
    
    # Use environment variables if arguments not provided
    EMAIL="${EMAIL:-${VESYNC_USERNAME:-}}"
    PASSWORD="${PASSWORD:-${VESYNC_PASSWORD:-}}"
    
    # Validate required parameters
    if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
        echo -e "${RED}ERROR: Email and password are required${NC}" >&2
        echo "Usage: $0 [email] [password]"
        echo "Or set VESYNC_USERNAME and VESYNC_PASSWORD in .env"
        exit 1
    fi
    
    # Setup debug environment
    setup_debug_dir
    
    # Generate unique identifiers
    APP_ID=$(generate_app_id)
    TERMINAL_ID=$(generate_terminal_id)
    
    # Print header
    print_section "$SCRIPT_NAME v$SCRIPT_VERSION"
    
    echo -e "${BOLD}Configuration:${NC}"
    echo -e "  Account: $(redact_pii "$EMAIL" "email")"
    echo -e "  App ID: $APP_ID"
    echo -e "  Terminal ID: $TERMINAL_ID"
    echo -e "  Verbose Mode: $VERBOSE"
    echo -e "  Debug Mode: $DEBUG"
    [[ "$DEBUG" == "true" ]] && echo -e "  Debug Directory: $DEBUG_DIR"
    
    # Test connectivity first
    test_connectivity
    
    # Guess user's region
    local guessed_region=$(guess_region_from_email "$EMAIL")
    log "INFO" "Detected likely region: $guessed_region"
    
    # Test NEW authentication flow first
    print_section "NEW AUTHENTICATION TESTING (PR #340)"
    echo -e "${YELLOW}${INFO}${NC} Testing new authentication flow across all regions..."
    local new_auth_result=1
    test_regional_authentication "new" || new_auth_result=$?
    
    echo -e "\n${CYAN}${ARROW} NEW authentication testing completed. Continuing to LEGACY testing...${NC}"
    
    # Test LEGACY authentication flow
    print_section "LEGACY AUTHENTICATION TESTING"
    echo -e "${YELLOW}${INFO}${NC} Testing legacy authentication flow across all regions..."
    local legacy_auth_result=1
    test_regional_authentication "legacy" || legacy_auth_result=$?
    
    echo -e "\n${CYAN}${ARROW} LEGACY authentication testing completed. Generating final summary...${NC}"
    
    # Print final summary and recommendations
    print_final_summary "$new_auth_result" "$legacy_auth_result" "$guessed_region"
    
    # Exit with appropriate code based on individual results
    if [[ "${NEW_AUTH_US_RESULT:-1}" == "0" || "${NEW_AUTH_EU_RESULT:-1}" == "0" || "${LEGACY_AUTH_US_RESULT:-1}" == "0" || "${LEGACY_AUTH_EU_RESULT:-1}" == "0" ]]; then
        exit 0  # Success
    elif [[ "${NEW_AUTH_US_RESULT:-1}" == "3" || "${NEW_AUTH_EU_RESULT:-1}" == "3" || "${LEGACY_AUTH_US_RESULT:-1}" == "3" || "${LEGACY_AUTH_EU_RESULT:-1}" == "3" ]]; then
        exit 3  # Region mismatch
    else
        exit 1  # Authentication failed
    fi
}

# Run main function with all arguments
main "$@"