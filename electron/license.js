/**
 * License Validation Module
 * 
 * TODO: Implement when adding subscription/payment system
 * 
 * Future functionality:
 * - License key validation
 * - Subscription status check
 * - Online/offline validation
 * - Grace period management
 * - Expiry date checks
 */

const Store = require('electron-store');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const store = new Store();

// License validation constants
const GRACE_PERIOD_DAYS = 7; // Can use app offline for 7 days
const LICENSE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Check if current license is valid
 * @returns {Promise<{valid: boolean, reason?: string, daysRemaining?: number}>}
 */
async function validateLicense() {
  // TODO: Implement license validation
  // For now, always return valid (no license required yet)
  
  const settings = store.get('settings', {});
  
  // Check if license exists
  if (!settings.licenseKey) {
    // No license key yet - allow usage (development mode)
    return {
      valid: true,
      reason: 'Development mode - no license required'
    };
  }
  
  // Check expiry date
  if (settings.licenseExpiry) {
    const expiryDate = new Date(settings.licenseExpiry);
    const now = new Date();
    
    if (now > expiryDate) {
      const daysExpired = Math.floor((now - expiryDate) / (1000 * 60 * 60 * 24));
      return {
        valid: false,
        reason: `License expired ${daysExpired} days ago`,
        daysRemaining: -daysExpired
      };
    }
    
    const daysRemaining = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));
    return {
      valid: true,
      daysRemaining
    };
  }
  
  return {
    valid: true,
    reason: 'No expiry date set'
  };
}

/**
 * Validate license online (check with backend)
 * @returns {Promise<{success: boolean, valid: boolean, data?: object, error?: string}>}
 */
async function validateOnline() {
  // TODO: Implement online validation
  // 1. Get license key from settings
  // 2. Call backend API to validate
  // 3. Update local license data
  // 4. Update lastLicenseCheck timestamp
  
  return {
    success: false,
    valid: false,
    error: 'Online validation not implemented yet'
  };
}

/**
 * Check if online validation is required (based on grace period)
 * @returns {boolean}
 */
function isOnlineValidationRequired() {
  const settings = store.get('settings', {});
  const lastCheck = settings.lastLicenseCheck;
  
  if (!lastCheck) {
    return true; // Never checked before
  }
  
  const lastCheckDate = new Date(lastCheck);
  const now = new Date();
  const daysSinceLastCheck = (now - lastCheckDate) / (1000 * 60 * 60 * 24);
  
  return daysSinceLastCheck >= GRACE_PERIOD_DAYS;
}

/**
 * Activate license with license key
 * @param {string} licenseKey 
 * @param {string} email 
 * @returns {Promise<{success: boolean, license?: object, error?: string}>}
 */
async function activateLicense(licenseKey, email) {
  // TODO: Implement license activation
  // 1. Validate license key format
  // 2. Call backend to activate
  // 3. Store license data locally (encrypted)
  // 4. Return license details
  
  return {
    success: false,
    error: 'License activation not implemented yet'
  };
}

/**
 * Get license info from settings
 * @returns {object}
 */
function getLicenseInfo() {
  const settings = store.get('settings', {});
  
  return {
    licenseKey: settings.licenseKey || null,
    plan: settings.licensePlan || 'free',
    expiry: settings.licenseExpiry || null,
    lastCheck: settings.lastLicenseCheck || null,
    email: settings.userEmail || null
  };
}

/**
 * Check if app can start (license valid or in grace period)
 * @returns {Promise<{canStart: boolean, reason?: string}>}
 */
async function canStartApp() {
  // TODO: Implement comprehensive startup check
  // For now, always allow (no license required yet)
  
  const validation = await validateLicense();
  
  if (!validation.valid) {
    // Check if we need online validation
    if (isOnlineValidationRequired()) {
      return {
        canStart: false,
        reason: 'License expired and grace period exceeded. Please connect to internet to validate.'
      };
    }
    
    // Still in grace period
    return {
      canStart: true,
      reason: 'License expired but still in grace period'
    };
  }
  
  return {
    canStart: true
  };
}

/**
 * Encrypt license data for storage
 * @param {object} licenseData 
 * @returns {string}
 */
function encryptLicense(licenseData) {
  // TODO: Implement license encryption
  // Use machine-specific key for binding
  
  return JSON.stringify(licenseData); // Placeholder - not encrypted yet
}

/**
 * Decrypt stored license data
 * @param {string} encryptedData 
 * @returns {object|null}
 */
function decryptLicense(encryptedData) {
  // TODO: Implement license decryption
  
  try {
    return JSON.parse(encryptedData);
  } catch (error) {
    return null;
  }
}

module.exports = {
  validateLicense,
  validateOnline,
  isOnlineValidationRequired,
  activateLicense,
  getLicenseInfo,
  canStartApp,
  encryptLicense,
  decryptLicense,
  GRACE_PERIOD_DAYS
};
