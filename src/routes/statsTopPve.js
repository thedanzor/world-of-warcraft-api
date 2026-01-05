/**
 * @file Route handler for /stats/top-pve endpoint.
 * @module routes/statsTopPve
 */

import express from 'express';
import { getAllMembers } from '../database.js';
import { transformCharacterData } from '../utils.js';

/**
 * GET /stats/top-pve - Returns top 5 Mythic+ players.
 * @route GET /stats/top-pve
 * @returns {Object} JSON response with top Mythic+ players.
 */
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const members = await getAllMembers();
    if (!members.length) {
      return res.status(404).json({ success: false, error: 'No guild data available' });
    }
    const transformedData = await Promise.all(members.map(transformCharacterData));
    const sortedData = transformedData.sort((a, b) => b.itemLevel - a.itemLevel);
    const mplusPlayers = sortedData
      .filter(character => character.mplus > 0)
      .sort((a, b) => b.mplus - a.mplus)
      .slice(0, 5)
      .map(character => ({
        name: character.name,
        score: character.mplus,
        class: character.class,
        spec: character.spec,
        server: character.server,
        itemLevel: character.itemLevel,
        guildRank: character.guildRank,
        media: character.media
      }));
    res.json({
      success: true,
      data: mplusPlayers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to read top PvE statistics', message: error.message });
  }
});

export default router; 