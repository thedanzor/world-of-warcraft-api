/**
 * @file Route handler for /api/settings endpoint - Admin settings management
 * @module routes/settings
 */

import express from 'express';
import bcrypt from 'bcrypt';
import { 
  getAppSettings,
  saveAppSettings,
  getAdminByUsername
} from '../database.js';
import { logError } from '../database.js';
import { clearConfigCache } from '../config.js';

const router = express.Router();

/**
 * Middleware to verify admin authentication
 */
async function verifyAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please provide admin credentials'
      });
    }

    // Decode Basic Auth
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (!username || !password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Username and password are required'
      });
    }

    // Verify admin credentials
    const admin = await getAdminByUsername(username);
    if (!admin) {
      await logError({
        type: 'security',
        endpoint: req.path,
        error: new Error('Invalid admin username'),
        context: { username, ip: req.ip }
      });
      
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid username or password'
      });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      await logError({
        type: 'security',
        endpoint: req.path,
        error: new Error('Invalid admin password'),
        context: { username, ip: req.ip }
      });
      
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid username or password'
      });
    }

    // Attach admin info to request
    req.admin = { username };
    next();
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: req.path,
      error: error,
      context: { method: req.method }
    });
    
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: error.message
    });
  }
}

/**
 * GET /api/settings - Get app settings (admin only, includes sensitive data)
 */
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const settings = await getAppSettings();
    
    if (!settings) {
      return res.status(404).json({
        success: false,
        error: 'Settings not found',
        message: 'App settings have not been initialized'
      });
    }

    // Return all settings including API keys (admin only)
    const { _id, ...settingsWithoutId } = settings;
    
    res.json({
      success: true,
      settings: settingsWithoutId
    });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/settings',
      error: error,
      context: { method: 'GET' }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get settings',
      message: error.message
    });
  }
});

/**
 * PUT /api/settings - Update app settings (admin only)
 * Protected fields: GUILD_NAME, GUILD_REALM, API_BATTLENET_KEY, API_BATTLENET_SECRET
 */
router.put('/', verifyAdmin, async (req, res) => {
  try {
    const currentSettings = await getAppSettings();
    
    if (!currentSettings) {
      return res.status(404).json({
        success: false,
        error: 'Settings not found',
        message: 'App settings have not been initialized'
      });
    }

    const updates = req.body;
    
    // Remove protected fields from updates
    const protectedFields = ['GUILD_NAME', 'GUILD_REALM', 'API_BATTLENET_KEY', 'API_BATTLENET_SECRET', '_id'];
    const filteredUpdates = {};
    
    Object.keys(updates).forEach(key => {
      if (!protectedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    // Merge with existing settings, preserving protected fields
    const updatedSettings = {
      ...currentSettings,
      ...filteredUpdates,
      // Explicitly preserve protected fields
      GUILD_NAME: currentSettings.GUILD_NAME,
      GUILD_REALM: currentSettings.GUILD_REALM,
      API_BATTLENET_KEY: currentSettings.API_BATTLENET_KEY,
      API_BATTLENET_SECRET: currentSettings.API_BATTLENET_SECRET,
      lastUpdated: new Date()
    };

    // Save updated settings
    await saveAppSettings(updatedSettings);
    
    // Clear config cache
    clearConfigCache();

    // Log the update
    await logError({
      type: 'admin-action',
      endpoint: '/api/settings',
      error: new Error('Settings updated'),
      context: { 
        username: req.admin.username,
        ip: req.ip,
        updatedFields: Object.keys(filteredUpdates)
      }
    });

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        ...updatedSettings,
        // Don't return API keys in response
        API_BATTLENET_KEY: undefined,
        API_BATTLENET_SECRET: undefined
      }
    });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/settings',
      error: error,
      context: { method: 'PUT', body: req.body }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
      message: error.message
    });
  }
});

export default router;

