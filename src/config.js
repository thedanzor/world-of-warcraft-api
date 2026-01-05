/**
 * @file Configuration utility that loads settings from database or falls back to app.config.js
 * @module config
 */

import { getAppSettings, hasAppSettings } from './database.js';
import config from '../app.config.js';

let cachedSettings = null;

/**
 * Get app settings from database, or fall back to app.config.js
 * @returns {Promise<Object>} App settings object
 */
export async function getConfig() {
  // If we have cached settings, return them
  if (cachedSettings) {
    return cachedSettings;
  }
  
  try {
    // Try to get settings from database
    const hasSettings = await hasAppSettings();
    if (hasSettings) {
      const dbSettings = await getAppSettings();
      if (dbSettings) {
        // Remove MongoDB _id field
        const { _id, ...settings } = dbSettings;
        cachedSettings = settings;
        return cachedSettings;
      }
    }
    
    // Fall back to app.config.js if database settings don't exist
    cachedSettings = config;
    return cachedSettings;
  } catch (error) {
    console.error('❌ Failed to load config from database, using app.config.js:', error);
    // Fall back to app.config.js on error
    cachedSettings = config;
    return cachedSettings;
  }
}

/**
 * Clear the cached settings (useful after updates)
 */
export function clearConfigCache() {
  cachedSettings = null;
}

/**
 * Get a specific config value
 * @param {string} key - Config key to retrieve
 * @returns {Promise<any>} Config value
 */
export async function getConfigValue(key) {
  const config = await getConfig();
  return config[key];
}

export default getConfig;

