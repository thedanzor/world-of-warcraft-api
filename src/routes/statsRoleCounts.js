/**
 * @file Route handler for /stats/role-counts endpoint.
 * @module routes/statsRoleCounts
 */

import express from 'express';
import { getAllActiveMembers } from '../database.js';
import { transformCharacterData } from '../utils.js';

/**
 * GET /stats/role-counts - Returns role distribution statistics.
 * @route GET /stats/role-counts
 * @returns {Object} JSON response with role distribution statistics.
 */
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const activeMembers = await getAllActiveMembers();
    if (!activeMembers.length) {
      return res.status(404).json({ success: false, error: 'No guild data available' });
    }
    const transformedData = activeMembers.map(transformCharacterData);
    // Count roles using config values (TANKS, HEALERS)
    // These may need to be imported from config
    // const tanks = ...
    // const healers = ...
    // const dps = ...
    res.json({
      success: true,
      data: {
        // tanks,
        // healers,
        // dps,
        total: transformedData.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to read role count statistics', message: error.message });
  }
});

export default router; 