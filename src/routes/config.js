/**
 * @file Route handler for /api/config endpoint.
 * @module routes/config
 */

import express from 'express';
import { hasAppSettings, getAppSettings } from '../database.js';
import { logError } from '../database.js';
import config from '../../app.config.js';

const router = express.Router();

const SENSITIVE_KEYS = [
  'API_BATTLENET_KEY',
  'API_BATTLENET_SECRET',
  'RAIDERIO_API_KEY',
  'WCL_CLIENT_ID',
  'WCL_CLIENT_SECRET',
];

function stripSensitive(settings) {
  const safe = { ...settings };
  for (const key of SENSITIVE_KEYS) delete safe[key];
  return safe;
}

/**
 * GET /api/config - Get app configuration (without sensitive data)
 */
router.get('/', async (req, res) => {
  try {
    const appSettingsExist = await hasAppSettings();
    
    if (!appSettingsExist) {
      // Return defaults from app.config.js (without sensitive data)
      const safeConfig = stripSensitive(config);
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
      const safeConfig = stripSensitive(config);
      return res.json({
        success: true,
        installed: false,
        config: safeConfig
      });
    }
    
    // Remove sensitive data and MongoDB _id
    const safeConfig = stripSensitive(dbSettings);
    delete safeConfig._id;
    
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
    const safeConfig = stripSensitive(config);
    res.json({
      success: true,
      installed: false,
      config: safeConfig,
      error: error.message
    });
  }
});

export default router;

