/**
 * @file Route handler for /stats/role-counts endpoint.
 * @module routes/statsRoleCounts
 */

import express from 'express';
import { getAllMembers } from '../database.js';
import { transformCharacterData } from '../utils.js';

/**
 * GET /stats/role-counts - Returns role distribution statistics.
 * @route GET /stats/role-counts
 * @returns {Object} JSON response with role distribution statistics.
 */
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const members = await getAllMembers();
    if (!members.length) {
      return res.status(404).json({ success: false, error: 'No guild data available' });
    }
    const transformedData = members.map(transformCharacterData);
    
    // Count roles from transformed data
    const tanks = transformedData.filter(char => char.metaData?.role === 'tank').length;
    const healers = transformedData.filter(char => char.metaData?.role === 'healer').length;
    const dps = transformedData.filter(char => char.metaData?.role === 'dps').length;
    
    res.json({
      success: true,
      data: {
        tanks,
        healers,
        dps,
        total: transformedData.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to read role count statistics', message: error.message });
  }
});

export default router; 