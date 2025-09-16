/**
 * @file API routes for seasonal statistics
 * @module routes/apiSeasonalStats
 */

import express from 'express';
import { 
  getTopSeasonalStats, 
  getAllTopSeasonalStats,
  hasTopSeasonalStats,
  logError 
} from '../database.js';
import { processCharacterSeasonalStats } from '../../tools/guildFetcher/seasonalStats.mjs';
import { getAllMembers } from '../database.js';

const router = express.Router();

/**
 * GET /api/seasonal-stats - Get latest seasonal statistics
 * @route GET /api/seasonal-stats
 * @param {number} season - Optional season number
 * @returns {Object} JSON response with seasonal statistics
 */
router.get('/', async (req, res) => {
  try {
    const { season } = req.query;
    
    console.log(`🔍 Fetching seasonal statistics${season ? ` for season ${season}` : ''}`);
    
    const seasonalStats = await getTopSeasonalStats(season ? parseInt(season) : null);
    
    if (!seasonalStats) {
      return res.status(404).json({
        success: false,
        error: 'Seasonal statistics not found',
        message: season ? `No statistics found for season ${season}` : 'No seasonal statistics available'
      });
    }

    res.json({
      success: true,
      data: seasonalStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/seasonal-stats',
      error: error,
      context: {
        method: req.method,
        url: req.url,
        query: req.query,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
    
    console.error('❌ Error fetching seasonal statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch seasonal statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/seasonal-stats/all - Get all seasonal statistics
 * @route GET /api/seasonal-stats/all
 * @returns {Object} JSON response with all seasonal statistics
 */
router.get('/all', async (req, res) => {
  try {
    console.log('🔍 Fetching all seasonal statistics');
    
    const allStats = await getAllTopSeasonalStats();
    
    res.json({
      success: true,
      data: allStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/seasonal-stats/all',
      error: error,
      context: {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
    
    console.error('❌ Error fetching all seasonal statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch all seasonal statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/seasonal-stats/character/:realm/:character - Get character seasonal statistics
 * @route GET /api/seasonal-stats/character/:realm/:character
 * @param {string} realm - The realm name
 * @param {string} character - The character name
 * @returns {Object} JSON response with character seasonal statistics
 */
router.get('/character/:realm/:character', async (req, res) => {
  try {
    const { realm, character } = req.params;
    
    console.log(`🔍 Fetching seasonal statistics for ${character}-${realm}`);
    
    // Find the character in the database
    const members = await getAllMembers();
    const characterData = members.find(member => 
      member.name.toLowerCase() === character.toLowerCase() && 
      member.server.toLowerCase() === realm.toLowerCase()
    );
    
    if (!characterData) {
      return res.status(404).json({
        success: false,
        error: 'Character not found',
        message: `Character ${character}-${realm} not found`
      });
    }

    // Process character seasonal statistics
    const seasonalStats = processCharacterSeasonalStats(characterData);
    
    res.json({
      success: true,
      character: {
        name: characterData.name,
        server: characterData.server,
        spec: characterData.metaData?.spec,
        class: characterData.metaData?.class,
        currentRating: characterData.currentSeason?.current_mythic_rating?.rating || 0
      },
      seasonalStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    await logError({
      type: 'api',
      endpoint: `/api/seasonal-stats/character/${req.params.realm}/${req.params.character}`,
      error: error,
      context: {
        method: req.method,
        url: req.url,
        params: req.params,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
    
    console.error('❌ Error fetching character seasonal statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch character seasonal statistics',
      message: error.message
    });
  }
});

/**
 * GET /api/seasonal-stats/leaderboard - Get seasonal leaderboard
 * @route GET /api/seasonal-stats/leaderboard
 * @param {string} type - Leaderboard type (players, dungeons, roles)
 * @param {number} limit - Number of results to return
 * @returns {Object} JSON response with leaderboard data
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { type = 'players', limit = 10 } = req.query;
    
    console.log(`🔍 Fetching ${type} leaderboard`);
    
    const seasonalStats = await getTopSeasonalStats();
    
    if (!seasonalStats) {
      return res.status(404).json({
        success: false,
        error: 'Seasonal statistics not found',
        message: 'No seasonal statistics available for leaderboard'
      });
    }

    let leaderboard = [];
    
    switch (type) {
      case 'players':
        leaderboard = seasonalStats.topPlayers.slice(0, parseInt(limit));
        break;
      case 'dungeons':
        leaderboard = Object.entries(seasonalStats.dungeonLeaderboard)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.highestKey - a.highestKey)
          .slice(0, parseInt(limit));
        break;
      case 'roles':
        leaderboard = Object.entries(seasonalStats.roleStats)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.averageRating - a.averageRating)
          .slice(0, parseInt(limit));
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid leaderboard type',
          message: 'Type must be one of: players, dungeons, roles'
        });
    }
    
    res.json({
      success: true,
      type,
      limit: parseInt(limit),
      data: leaderboard,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/seasonal-stats/leaderboard',
      error: error,
      context: {
        method: req.method,
        url: req.url,
        query: req.query,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
    
    console.error('❌ Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leaderboard',
      message: error.message
    });
  }
});

/**
 * GET /api/seasonal-stats/status - Check if seasonal statistics exist
 * @route GET /api/seasonal-stats/status
 * @returns {Object} JSON response with status information
 */
router.get('/status', async (req, res) => {
  try {
    console.log('🔍 Checking seasonal statistics status');
    
    const hasStats = await hasTopSeasonalStats();
    const latestStats = hasStats ? await getTopSeasonalStats() : null;
    
    res.json({
      success: true,
      hasData: hasStats,
      season: latestStats?.season || null,
      lastUpdated: latestStats?.lastUpdated || null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/seasonal-stats/status',
      error: error,
      context: {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
    
    console.error('❌ Error checking seasonal statistics status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check seasonal statistics status',
      message: error.message
    });
  }
});

export default router;
