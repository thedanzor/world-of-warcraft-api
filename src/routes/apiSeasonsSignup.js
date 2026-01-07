/**
 * @file Route handler for /api/seasons/signup endpoint.
 * @module routes/apiSeasonsSignup
 */

import express from 'express';
import { saveSeason3Signup } from '../database.js';

/**
 * POST /api/seasons/signup - Handles season signup submissions.
 * @route POST /api/seasons/signup
 * @returns {Object} JSON response with signup status and data.
 */
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const formData = req.body;
    
    // Validate against test/demo characters
    const isTestOrDemoCharacter = (name) => {
      if (!name) return false
      const normalizedName = name.toLowerCase().trim()
      const testPatterns = [
        'test', 'demo', 'example', 'sample', 'tester', 'testing',
        'dummy', 'fake', 'placeholder', 'temp', 'temporary'
      ]
      return testPatterns.some(pattern => normalizedName.includes(pattern))
    }

    // Check current character name
    if (isTestOrDemoCharacter(formData.currentCharacterName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid character name',
        message: 'Test or demo characters are not allowed'
      })
    }

    // Check season character name (support both old and new field names)
    const seasonCharName = formData.seasonCharacterName || formData.season3CharacterName
    if (isTestOrDemoCharacter(seasonCharName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid character name',
        message: 'Test or demo characters are not allowed'
      })
    }
    
    // Save the signup data to MongoDB
    const result = await saveSeason3Signup(formData);
    
    res.json({
      success: true,
      message: 'Signup submitted successfully',
      seasons: {
        id: result.insertedId,
        timestamp: new Date().toISOString(),
        ...formData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to process signup',
      message: error.message
    });
  }
});

export default router; 