/**
 * @file Route handler for /api/seasons/data endpoint.
 * @module routes/apiSeasonsData
 */

import express from 'express';
import { getSeasonsSignups } from '../database.js';

/**
 * GET /api/seasons/data - Returns all season signups.
 * @route GET /api/seasons/data
 * @returns {Object} JSON response with season signups.
 */
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const signups = await getSeasonsSignups();
    
    res.json({
      success: true,
      seasons: signups,
      totalMembers: signups.length,
      timestamp: signups[0]?.timestamp || new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to read season data',
      message: error.message
    });
  }
});

export default router; 