/**
 * @file Route handler for /update endpoint.
 * @module routes/update
 */

import express from 'express';
import { startGuildUpdate } from '../../tools/guildFetcher/fetchGuild.mjs';
import { findMemberByName, updateMember, addMember, logError } from '../database.js';

const router = express.Router();

// Track running processes to prevent concurrent updates
let isGuildUpdateRunning = false;
let currentProcessId = null;

/**
 * POST /update - Starts a guild data update process.
 * @route POST /update
 * @returns {Object} JSON response with update status.
 */
router.post('/', async (req, res) => {
  try {
    // Check if guild update is already running
    if (isGuildUpdateRunning) {
      return res.status(409).json({ 
        success: false, 
        error: 'Guild update already in progress',
        processId: currentProcessId,
        message: 'Another guild update is currently running. Please wait for it to complete.'
      });
    }

    const { dataTypes = ['raid', 'mplus', 'pvp'] } = req.body;
    const processId = `guild-update-${Date.now()}`;
    
    // Set running state
    isGuildUpdateRunning = true;
    currentProcessId = processId;

    // Start the guild update process (don't await to avoid blocking the response)
    startGuildUpdate(dataTypes, processId, req.app.get('io'))
      .then(() => {
        // Reset running state when complete
        isGuildUpdateRunning = false;
        currentProcessId = null;
        console.log(`Guild update process ${processId} completed successfully`);
      })
      .catch(async (error) => {
        // Reset running state on error
        isGuildUpdateRunning = false;
        currentProcessId = null;
        
        await logError({
          type: 'api',
          endpoint: '/update',
          error: error,
          context: {
            method: req.method,
            url: req.url,
            body: req.body,
            processId,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          }
        });
        
        console.error(`Guild update process ${processId} failed:`, error.message);
      });

    res.json({ 
      success: true, 
      message: 'Guild update started successfully',
      processId,
      dataTypes
    });
  } catch (error) {
    // Reset running state on error
    isGuildUpdateRunning = false;
    currentProcessId = null;
    
    await logError({
      type: 'api',
      endpoint: '/update',
      error: error,
      context: {
        method: req.method,
        url: req.url,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start guild update', 
      message: error.message 
    });
  }
});

/**
 * POST /update/:realm/:character - Updates a single character.
 * @route POST /update/:realm/:character
 * @param {string} realm - The realm name
 * @param {string} character - The character name
 * @returns {Object} JSON response with update status.
 */
router.post('/:realm/:character', async (req, res) => {
  try {
    const { realm, character } = req.params;
    const { dataTypes = ['raid', 'mplus', 'pvp'] } = req.body;
    
    // Validate parameters
    if (!realm || !character) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'Both realm and character parameters are required'
      });
    }

    const characterName = character.toLowerCase();
    const server = realm.toLowerCase();

    // Use the existing character fetch endpoint to get fresh data
    const host = process.env.HOST || 'localhost';
    const port = process.env.PORT || 8000;
    const fetchUrl = `http://${host}:${port}/api/fetch/${server}/${characterName}?dataTypes=${dataTypes.join(',')}`;
    
    const response = await fetch(fetchUrl);
    const result = await response.json();
    
    if (!result.success || !result.character) {
      return res.status(404).json({
        success: false,
        error: 'Character not found',
        message: `Character ${characterName}-${server} not found or failed to fetch`
      });
    }

    const characterData = result.character;
    
    // Check if member exists in database
    try {
      const existingMember = await findMemberByName(characterName, server);
      
      if (existingMember) {
        // Update existing member
        await updateMember(characterName, server, characterData);
        console.log(`✅ Updated existing member: ${characterName}-${server}`);
      } else {
        // Add new member
        await addMember(characterData);
        console.log(`✅ Added new member: ${characterName}-${server}`);
      }
      
      res.json({
        success: true,
        message: `Character ${characterName}-${server} updated successfully`,
        character: characterData,
        action: existingMember ? 'updated' : 'added'
      });
    } catch (dbError) {
      await logError({
        type: 'api',
        endpoint: `/update/${realm}/${character}`,
        error: dbError,
        context: {
          method: req.method,
          url: req.url,
          params: req.params,
          body: req.body,
          character: `${characterName}-${server}`,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }
      });
      
      console.error(`❌ Database error for ${characterName}-${server}:`, dbError.message);
      res.status(500).json({
        success: false,
        error: 'Database error',
        message: `Failed to save character data: ${dbError.message}`
      });
    }
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: `/update/${realm}/${character}`,
      error: error,
      context: {
        method: req.method,
        url: req.url,
        params: req.params,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update character', 
      message: error.message 
    });
  }
});

/**
 * GET /update/status - Get the current status of guild updates.
 * @route GET /update/status
 * @returns {Object} JSON response with current update status.
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    isRunning: isGuildUpdateRunning,
    processId: currentProcessId,
    message: isGuildUpdateRunning 
      ? `Guild update is currently running (Process ID: ${currentProcessId})`
      : 'No guild update is currently running'
  });
});

export default router; 