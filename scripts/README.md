# VeSync Authentication Testing Scripts

This directory contains scripts for testing and validating VeSync authentication flows.

## Files

### test-auth-type.sh
Comprehensive script to test both NEW (PR #340) and LEGACY VeSync authentication flows.

**Features:**
- Tests both NEW two-step authentication and LEGACY single-step authentication
- Regional endpoint detection (US, EU, Global)
- PII redaction for security
- Comprehensive error code explanations
- Network connectivity testing
- Detailed recommendations based on results

**Usage:**
```bash
# Using environment variables from .env
scripts/run-auth-test.sh

# Direct usage with credentials
scripts/test-auth-type.sh user@example.com password

# With verbose output
scripts/test-auth-type.sh -v user@example.com password

# With debug mode (saves API responses)
scripts/test-auth-type.sh -d user@example.com password
```

### run-auth-test.sh
Helper script that loads environment variables from .env file and runs the authentication test.

**Usage:**
```bash
# Ensure .env file exists with VESYNC_USERNAME and VESYNC_PASSWORD
scripts/run-auth-test.sh [options]
```

## Environment Variables

Create a `.env` file in the project root with:
```env
VESYNC_USERNAME=your-email@example.com
VESYNC_PASSWORD=your-password
```

## Recent Fixes

- **Fixed JSON payload construction**: Replaced problematic here-doc syntax with printf-based JSON construction to prevent script hanging
- **Improved environment variable loading**: Added proper .env file loading support
- **Enhanced error handling**: Better error codes and explanations
- **Added PII redaction**: Safely masks sensitive information in output

## Authentication Flow Detection

The script will determine:
1. **NEW Authentication (PR #340)**: Two-step flow using authorize codes
2. **LEGACY Authentication**: Traditional single-step login flow  
3. **Regional Issues**: Cross-region authentication problems
4. **API Changes**: Detection of new error codes or API changes

Results include specific recommendations for which authentication method to use in your implementation.