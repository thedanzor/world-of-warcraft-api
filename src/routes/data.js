/**
 * @file Route handler for /data endpoint.
 * @module routes/data
 */

import express from 'express';
import { getAllActiveMembers } from '../database.js';
import { transformCharacterData, calculateStatistics } from '../utils.js';

/**
 * GET /data - Returns complete guild data and statistics.
 * @route GET /data
 * @returns {Object} JSON response with guild data and statistics.
 */
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const activeMembers = await getAllActiveMembers();
    if (!activeMembers.length) {
      return res.status(404).json({ success: false, error: 'No guild data available' });
    }
    const transformedData = activeMembers.map(transformCharacterData);
    const sortedData = transformedData.sort((a, b) => b.itemLevel - a.itemLevel);
    const statistics = calculateStatistics(sortedData);
    return res.json({
      success: true,
      data: sortedData,
      statistics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to read guild data', message: error.message });
  }
});

export default router; 