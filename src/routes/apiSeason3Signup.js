/**
 * @file Route handler for /api/season3/signup endpoint.
 * @module routes/apiSeason3Signup
 */

import express from 'express';
import { saveSeason3Signup } from '../database.js';

/**
 * POST /api/season3/signup - Handles Season 3 signup submissions.
 * @route POST /api/season3/signup
 * @returns {Object} JSON response with signup status and data.
 */
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const formData = req.body;
    
    // Save the signup data to MongoDB
    const result = await saveSeason3Signup(formData);
    
    res.json({
      success: true,
      message: 'Signup submitted successfully',
      season3: {
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