/**
 * @file Route handler for /api/config endpoint.
 * @module routes/config
 */

import express from 'express';
import { hasAppSettings, getAppSettings } from '../database.js';
import { logError } from '../database.js';
import config from '../../app.config.js';

const router = express.Router();

/**
 * GET /api/config - Get app configuration (without sensitive data)
 */
router.get('/', async (req, res) => {
  try {
    const appSettingsExist = await hasAppSettings();
    
    if (!appSettingsExist) {
      // Return defaults from app.config.js (without sensitive data)
      const { API_BATTLENET_KEY, API_BATTLENET_SECRET, ...safeConfig } = config;
      return res.json({
        success: true,
        installed: false,
        config: safeConfig
      });
    }
    
    // Get settings from database
    const dbSettings = await getAppSettings();
    if (!dbSettings) {
      // Fallback to app.config.js
      const { API_BATTLENET_KEY, API_BATTLENET_SECRET, ...safeConfig } = config;
      return res.json({
        success: true,
        installed: false,
        config: safeConfig
      });
    }
    
    // Remove sensitive data and MongoDB _id
    const { _id, API_BATTLENET_KEY, API_BATTLENET_SECRET, ...safeConfig } = dbSettings;
    
    res.json({
      success: true,
      installed: true,
      config: safeConfig
    });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/config',
      error: error,
      context: { method: 'GET' }
    });
    
    // Fallback to app.config.js on error
    const { API_BATTLENET_KEY, API_BATTLENET_SECRET, ...safeConfig } = config;
    res.json({
      success: true,
      installed: false,
      config: safeConfig,
      error: error.message
    });
  }
});

export default router;

