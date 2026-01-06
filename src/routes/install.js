/**
 * @file Route handler for /api/install endpoint.
 * @module routes/install
 */

import express from 'express';
import { BlizzAPI } from "blizzapi";
import { 
  hasAppSettings, 
  getAppSettings, 
  saveAppSettings,
  hasAdmin,
  createAdmin,
  hasGuildData,
  getAdminByUsername,
  saveJoinText,
  hasJoinText
} from '../database.js';
import { logError } from '../database.js';
import { clearConfigCache, getConfig } from '../config.js';
import bcrypt from 'bcrypt';
import config from '../../app.config.js';
import { getDefaultJoinText } from './jointext.js';

const router = express.Router();

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid and errors array
 */
function validatePassword(password) {
  const errors = [];
  
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Test Battle.net API credentials by making a test call
 * @param {string} clientId - Battle.net API client ID
 * @param {string} clientSecret - Battle.net API client secret
 * @param {string} region - Region (eu, us, etc.)
 * @param {string} guildRealm - Guild realm slug
 * @param {string} guildName - Guild name slug
 * @param {string} apiParams - API parameters
 * @returns {Promise<Object>} Validation result
 */
async function validateBattleNetCredentials(clientId, clientSecret, region, guildRealm, guildName, apiParams) {
  try {
    const BnetApi = new BlizzAPI({ region, clientId, clientSecret });
    
    // First, test authentication
    let token;
    try {
      token = await BnetApi.getAccessToken();
    } catch (authError) {
      return {
        isValid: false,
        message: 'Failed to authenticate with Battle.net API',
        error: 'AUTH_ERROR',
        details: authError.message || 'Invalid API credentials. Please check your Client ID and Client Secret.',
        suggestion: 'Verify that your Battle.net API Client ID and Client Secret are correct.'
      };
    }
    
    // Test by fetching guild roster
    const guildUrl = `/data/wow/guild/${guildRealm}/${guildName}/roster?${apiParams}&access_token=${token}`;
    let guildResponse;
    try {
      guildResponse = await BnetApi.query(guildUrl);
    } catch (guildError) {
      // Check for specific error types
      const errorMessage = guildError.message || '';
      const statusCode = guildError.statusCode || guildError.status;
      
      if (statusCode === 404 || errorMessage.includes('404') || errorMessage.includes('not found')) {
        return {
          isValid: false,
          message: 'Guild not found',
          error: 'GUILD_NOT_FOUND',
          details: `The guild "${guildName}" was not found on realm "${guildRealm}" in region "${region}".`,
          suggestion: 'Please verify the guild name and realm name are correct. Note: Guild names and realm names are case-sensitive and must match exactly (use slugs if needed).'
        };
      }
      
      if (statusCode === 403 || errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        return {
          isValid: false,
          message: 'Access forbidden',
          error: 'ACCESS_FORBIDDEN',
          details: 'Your API credentials do not have permission to access this guild.',
          suggestion: 'Verify that your API key has the correct permissions and that the guild exists.'
        };
      }
      
      return {
        isValid: false,
        message: 'Failed to fetch guild data',
        error: 'GUILD_FETCH_ERROR',
        details: guildError.message || 'An error occurred while fetching guild information.',
        suggestion: 'Please check your API credentials, guild name, realm name, and region settings.'
      };
    }
    
    if (guildResponse && guildResponse.members) {
      return {
        isValid: true,
        message: 'API credentials are valid and guild found',
        guildMembers: guildResponse.members.length
      };
    } else {
      return {
        isValid: false,
        message: 'Guild roster is empty or invalid',
        error: 'INVALID_GUILD_RESPONSE',
        details: 'The guild was found but the roster data is invalid or empty.',
        suggestion: 'Please verify the guild has members and try again.'
      };
    }
  } catch (error) {
    return {
      isValid: false,
      message: 'Unexpected error during validation',
      error: 'UNKNOWN_ERROR',
      details: error.message || 'An unexpected error occurred while validating API credentials.',
      suggestion: 'Please check all your settings and try again. If the problem persists, verify your Battle.net API credentials are correct.'
    };
  }
}

/**
 * GET /api/install - Check installation status
 */
router.get('/', async (req, res) => {
  try {
    const appSettingsExist = await hasAppSettings();
    const adminExists = await hasAdmin();
    const guildDataExists = await hasGuildData();
    
    // Load default values from app.config.js
    const defaultConfig = { ...config };
    // Remove sensitive data from defaults
    delete defaultConfig.API_BATTLENET_KEY;
    delete defaultConfig.API_BATTLENET_SECRET;
    
    // If AppSettings exists, return installed status but still allow access
    if (appSettingsExist) {
      // Get current settings (without sensitive data) for reference
      const currentSettings = await getAppSettings();
      const { _id, API_BATTLENET_KEY, API_BATTLENET_SECRET, ...safeCurrentSettings } = currentSettings || {};
      
      // Determine which step should be active
      let suggestedStep = 0; // Start at step 0 (App Settings)
      if (appSettingsExist && guildDataExists && !adminExists) {
        suggestedStep = 2; // Skip to Admin Account
      } else if (appSettingsExist && !guildDataExists && !adminExists) {
        suggestedStep = 1; // Go to Guild Fetch
      } else if (appSettingsExist && adminExists) {
        suggestedStep = 2; // All done, but allow access
      }
      
      return res.json({
        success: true,
        installed: true,
        hasAdmin: adminExists,
        hasGuildData: guildDataExists,
        suggestedStep: suggestedStep,
        defaults: defaultConfig,
        currentSettings: safeCurrentSettings,
        canOverwrite: true
      });
    }
    
    res.json({
      success: true,
      installed: false,
      hasAdmin: adminExists,
      hasGuildData: guildDataExists,
      suggestedStep: adminExists ? 1 : 0,
      defaults: defaultConfig
    });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/install',
      error: error,
      context: { method: 'GET' }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to check installation status',
      message: error.message
    });
  }
});

/**
 * POST /api/install - Save app settings
 */
router.post('/', async (req, res) => {
  try {
    const { overwrite = false, ...settingsData } = req.body;
    
    // Check if already installed
    const appSettingsExist = await hasAppSettings();
    const adminExists = await hasAdmin();
    
    console.log('\n=== BACKEND /api/install POST ===');
    console.log('appSettingsExist:', appSettingsExist);
    console.log('adminExists:', adminExists);
    console.log('overwrite flag:', overwrite);
    
    // CRITICAL: If admin doesn't exist, ALWAYS allow overwriting settings
    // This prevents users from getting stuck if something breaks during installation
    const canOverwrite = !adminExists || overwrite;
    
    // Only block if ALL THREE conditions are true:
    // 1. AppSettings exist
    // 2. Admin account exists (installation is complete)
    // 3. User hasn't explicitly requested overwrite
    const shouldBlock = appSettingsExist && adminExists && !overwrite;
    console.log('Should block?', shouldBlock);
    
    if (shouldBlock) {
      console.log('❌ BLOCKING - returning requiresOverwrite');
      console.log('=================================\n');
      return res.status(403).json({
        success: false,
        error: 'Installation already completed',
        message: 'The application has already been fully installed. Set overwrite=true to overwrite existing settings.',
        requiresOverwrite: true
      });
    }
    
    // If we get here, we're allowing the operation
    if (appSettingsExist && !adminExists) {
      console.log('✅ ALLOWING - Installation incomplete (no admin)');
    } else if (appSettingsExist && overwrite) {
      console.log('✅ ALLOWING - Overwrite flag is true');
    } else {
      console.log('✅ ALLOWING - Fresh installation');
    }
    console.log('=================================\n');
    
    const {
      API_BATTLENET_KEY,
      API_BATTLENET_SECRET,
      GUILD_NAME,
      GUILD_REALM,
      REGION,
      API_PARAM_REQUIREMENTGS,
      ...otherSettings
    } = settingsData;
    
    // Validate required fields
    if (!API_BATTLENET_KEY || !API_BATTLENET_SECRET || !GUILD_NAME || !GUILD_REALM || !REGION || !API_PARAM_REQUIREMENTGS) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'API_BATTLENET_KEY, API_BATTLENET_SECRET, GUILD_NAME, GUILD_REALM, REGION, and API_PARAM_REQUIREMENTGS are required'
      });
    }
    
    // Validate Battle.net API credentials
    const validation = await validateBattleNetCredentials(
      API_BATTLENET_KEY,
      API_BATTLENET_SECRET,
      REGION,
      GUILD_REALM,
      GUILD_NAME,
      API_PARAM_REQUIREMENTGS
    );
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.error || 'VALIDATION_ERROR',
        message: validation.message,
        details: validation.details || validation.message,
        suggestion: validation.suggestion || 'Please check your settings and try again.',
        validation: validation
      });
    }
    
    // Merge with defaults from app.config.js
    const settings = {
      ...config,
      ...otherSettings,
      API_BATTLENET_KEY,
      API_BATTLENET_SECRET,
      GUILD_NAME,
      GUILD_REALM,
      REGION,
      API_PARAM_REQUIREMENTGS
    };
    
    // Save to database
    await saveAppSettings(settings);
    
    // Seed join text if it doesn't exist
    const joinTextExists = await hasJoinText();
    console.log('📋 Join text exists:', joinTextExists);
    if (!joinTextExists) {
      const defaultJoinText = getDefaultJoinText();
      console.log('🌱 Seeding join text with', defaultJoinText.sections?.length || 0, 'sections');
      await saveJoinText(defaultJoinText);
      console.log('✅ Seeded default join text');
    } else {
      console.log('ℹ️  Join text already exists, skipping seed');
    }
    
    // Clear config cache so new settings are loaded
    clearConfigCache();
    
    // Verify the settings were saved correctly by loading them
    const savedConfig = await getConfig();
    if (!savedConfig.API_BATTLENET_KEY || !savedConfig.API_BATTLENET_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Settings not saved correctly',
        message: 'Failed to verify saved settings. Please try again.'
      });
    }
    
    res.json({
      success: true,
      message: 'App settings saved successfully',
      validation: {
        isValid: true,
        guildMembers: validation.guildMembers
      }
    });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/install',
      error: error,
      context: { method: 'POST', body: req.body }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to save app settings',
      message: error.message
    });
  }
});

/**
 * POST /api/install/login - Login with admin credentials
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing credentials',
        message: 'Username and password are required'
      });
    }
    
    // Get admin user
    const admin = await getAdminByUsername(username);
    if (!admin) {
      await logError({
        type: 'security',
        endpoint: '/api/install/login',
        error: new Error('Invalid admin username'),
        context: { username, ip: req.ip }
      });
      
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid username or password'
      });
    }
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      await logError({
        type: 'security',
        endpoint: '/api/install/login',
        error: new Error('Invalid admin password'),
        context: { username, ip: req.ip }
      });
      
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid username or password'
      });
    }
    
    // Return success
    // Note: In a production environment, you might want to use JWT tokens or proper session management
    // For now, we'll rely on client-side session storage
    res.json({
      success: true,
      message: 'Login successful',
      authenticated: true
    });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/install/login',
      error: error,
      context: { method: 'POST' }
    });
    
    res.status(500).json({
      success: false,
      error: 'Login failed',
      message: error.message
    });
  }
});

/**
 * POST /api/install/admin - Create admin user
 */
router.post('/admin', async (req, res) => {
  try {
    // Check if AppSettings exists
    const appSettingsExist = await hasAppSettings();
    if (!appSettingsExist) {
      return res.status(400).json({
        success: false,
        error: 'App settings not initialized',
        message: 'Please complete app settings installation first'
      });
    }
    
    // Check if admin already exists
    const adminExists = await hasAdmin();
    if (adminExists) {
      return res.status(403).json({
        success: false,
        error: 'Admin already exists',
        message: 'An admin user has already been created'
      });
    }
    
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Username and password are required'
      });
    }
    
    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet requirements',
        message: 'Password validation failed',
        errors: passwordValidation.errors
      });
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Create admin user
    await createAdmin(username, hashedPassword);
    
    res.json({
      success: true,
      message: 'Admin user created successfully'
    });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/install/admin',
      error: error,
      context: { method: 'POST' }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to create admin user',
      message: error.message
    });
  }
});


export default router;

