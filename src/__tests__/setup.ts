import dotenv from 'dotenv';
import path from 'path';
import { setApiBaseUrl } from 'tsvesync/src/lib/helpers';

// Load test environment variables
const envPath = path.resolve(__dirname, '../../.env.test');
if (process.env.DEBUG) {
  console.log('Loading environment variables from:', envPath);
}
const result = dotenv.config({ path: envPath });
if (process.env.DEBUG) {
  if (result.error) {
    console.log('Error loading .env.test:', result.error);
  } else {
    console.log('Environment variables loaded:', {
      VESYNC_TEST_USERNAME: process.env.VESYNC_TEST_USERNAME,
      VESYNC_TEST_PASSWORD: process.env.VESYNC_TEST_PASSWORD ? '***' : undefined,
      VESYNC_API_URL: process.env.VESYNC_API_URL,
    });
  }
}

// Helper to check if a string is not empty or commented out
const isValidEnvVar = (value?: string): boolean => {
  return !!value && !value.startsWith('#');
};

// Set API URL if provided in environment variables
const apiUrl = process.env.VESYNC_API_URL;
if (process.env.DEBUG) {
  console.log('API URL from env:', apiUrl);
}

if (isValidEnvVar(apiUrl)) {
  if (process.env.DEBUG) {
    console.log('Setting API URL to:', apiUrl);
  }
  setApiBaseUrl(apiUrl as string);
}

export const TEST_CONFIG = {
  username: isValidEnvVar(process.env.VESYNC_TEST_USERNAME) ? process.env.VESYNC_TEST_USERNAME : undefined,
  password: isValidEnvVar(process.env.VESYNC_TEST_PASSWORD) ? process.env.VESYNC_TEST_PASSWORD : undefined,
  apiUrl: isValidEnvVar(process.env.VESYNC_API_URL) ? process.env.VESYNC_API_URL : undefined,
};

if (process.env.DEBUG) {
  console.log('Test config:', {
    hasUsername: !!TEST_CONFIG.username,
    hasPassword: !!TEST_CONFIG.password,
    apiUrl: TEST_CONFIG.apiUrl,
    username: TEST_CONFIG.username,
    password: TEST_CONFIG.password ? '***' : undefined,
  });
}

// Helper to check if we can run integration tests
export const canRunIntegrationTests = (): boolean => {
  const canRun = !!(TEST_CONFIG.username && TEST_CONFIG.password);
  if (process.env.DEBUG) {
    console.log('Can run integration tests:', canRun);
  }
  return canRun;
};

// Helper to skip tests that require real credentials
export const skipWithoutCredentials = () => {
  if (!canRunIntegrationTests()) {
    return test.skip;
  }
  return test;
};

// Export a function to reset API URL for mocked tests
export const resetApiUrl = () => {
  if (process.env.DEBUG) {
    console.log('Resetting API URL to default');
  }
  setApiBaseUrl('https://smartapi.vesync.com');
}; 