/**
 * @file Route handler for /stats/top-pvp endpoint.
 * @module routes/statsTopPvp
 */

import express from 'express';
import { getAllActiveMembers } from '../database.js';
import { transformCharacterData } from '../utils.js';

/**
 * GET /stats/top-pvp - Returns top 5 PvP players.
 * @route GET /stats/top-pvp
 * @returns {Object} JSON response with top PvP players.
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
    const pvpPlayers = sortedData
      .filter(character => character.pvp > 0)
      .sort((a, b) => b.pvp - a.pvp)
      .slice(0, 5)
      .map(character => ({
        name: character.name,
        rating: character.pvp,
        class: character.class,
        spec: character.spec,
        server: character.server,
        itemLevel: character.itemLevel,
        guildRank: character.guildRank,
        media: character.media
      }));
    res.json({
      success: true,
      data: pvpPlayers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to read top PvP statistics', message: error.message });
  }
});

export default router; 