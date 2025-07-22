/**
 * @file Route handler for /stats/missing-enchants endpoint.
 * @module routes/statsMissingEnchants
 */

import express from 'express';
import { getAllActiveMembers } from '../database.js';
import { transformCharacterData } from '../utils.js';

/**
 * GET /stats/missing-enchants - Returns statistics for missing enchants.
 * @route GET /stats/missing-enchants
 * @returns {Object} JSON response with missing enchants statistics.
 */
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const activeMembers = await getAllActiveMembers();
    if (!activeMembers.length) {
      return res.status(404).json({ success: false, error: 'No guild data available' });
    }
    const transformedData = activeMembers.map(transformCharacterData);
    const charactersWithMissingEnchants = transformedData.filter(character => character.missingEnchants && character.missingEnchants.length > 0);
    // Count by rank category using guildRank string converted to index
    // (Assume MAIN_RANKS, ALT_RANKS, GUILLD_RANKS are imported or passed in)
    // You may need to adjust this import based on your config structure
    const all = charactersWithMissingEnchants.length;
    // const mains = ...
    // const alts = ...
    res.json({
      success: true,
      data: {
        all,
        // mains,
        // alts
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to read missing enchants statistics', message: error.message });
  }
});

export default router; 