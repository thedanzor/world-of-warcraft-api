/**
 * @file Route handler for /api/roster endpoint - Roster management
 * @module routes/apiRoster
 */

import express from 'express';
import { ObjectId } from 'mongodb';
import { 
  connectToDatabase
} from '../database.js';
import { logError } from '../database.js';
import bcrypt from 'bcrypt';
import { getAdminByUsername } from '../database.js';

const router = express.Router();

// Collection name for rosters
const ROSTER_COLLECTION = 'rosters';

/**
 * Middleware to verify admin authentication
 */
async function verifyAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please provide admin credentials'
      });
    }

    // Decode Basic Auth
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (!username || !password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Username and password are required'
      });
    }

    // Verify admin credentials
    const admin = await getAdminByUsername(username);
    if (!admin) {
      await logError({
        type: 'security',
        endpoint: req.path,
        error: new Error('Invalid admin username'),
        context: { username, ip: req.ip }
      });
      
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid username or password'
      });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      await logError({
        type: 'security',
        endpoint: req.path,
        error: new Error('Invalid admin password'),
        context: { username, ip: req.ip }
      });
      
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid username or password'
      });
    }

    // Attach admin info to request
    req.admin = admin;
    next();
  } catch (error) {
    await logError({
      type: 'security',
      endpoint: req.path,
      error: error,
      context: { ip: req.ip }
    });
    
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: error.message
    });
  }
}

/**
 * GET /api/roster - Get the current roster (public)
 */
router.get('/', async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const rosterCollection = db.collection(ROSTER_COLLECTION);
    
    // Get the most recent roster
    const roster = await rosterCollection
      .findOne({}, { sort: { lastUpdated: -1 } });
    
    if (!roster) {
      return res.json({
        success: true,
        roster: {
          tanks: [],
          healers: [],
          dps: [],
          substitutes: [],
          socials: []
        }
      });
    }

    // Remove MongoDB _id and internal fields
    const { _id, ...rosterData } = roster;
    
    res.json({
      success: true,
      roster: rosterData
    });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/roster',
      error: error,
      context: { method: 'GET' }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get roster',
      message: error.message
    });
  }
});

/**
 * POST /api/roster - Create or update roster (admin only)
 */
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { tanks, healers, dps, substitutes, socials } = req.body;
    
    if (!tanks || !healers || !dps || !substitutes || !socials) {
      return res.status(400).json({
        success: false,
        error: 'Missing roster data',
        message: 'All role arrays (tanks, healers, dps, substitutes, socials) are required'
      });
    }

    const { db } = await connectToDatabase();
    const rosterCollection = db.collection(ROSTER_COLLECTION);
    
    const rosterData = {
      tanks: tanks || [],
      healers: healers || [],
      dps: dps || [],
      substitutes: substitutes || [],
      socials: socials || [],
      lastUpdated: new Date(),
      updatedBy: req.admin.username
    };
    
    // Upsert - replace the existing roster or create new one
    const result = await rosterCollection.replaceOne(
      {},
      rosterData,
      { upsert: true }
    );
    
    res.json({
      success: true,
      message: 'Roster saved successfully',
      roster: rosterData
    });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/roster',
      error: error,
      context: { method: 'POST', body: req.body }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to save roster',
      message: error.message
    });
  }
});

/**
 * DELETE /api/roster/:characterId - Remove a character from roster (admin only)
 */
router.delete('/:characterId', verifyAdmin, async (req, res) => {
  try {
    const { characterId } = req.params;
    
    if (!characterId) {
      return res.status(400).json({
        success: false,
        error: 'Missing character ID',
        message: 'Please provide a character ID to remove'
      });
    }

    const { db } = await connectToDatabase();
    const rosterCollection = db.collection(ROSTER_COLLECTION);
    
    // Get current roster
    const roster = await rosterCollection.findOne({}, { sort: { lastUpdated: -1 } });
    
    if (!roster) {
      return res.status(404).json({
        success: false,
        error: 'Roster not found',
        message: 'No roster exists to remove characters from'
      });
    }
    
    // Remove character from all role arrays
    const updatedRoster = {
      tanks: roster.tanks.filter(char => char !== characterId),
      healers: roster.healers.filter(char => char !== characterId),
      dps: roster.dps.filter(char => char !== characterId),
      substitutes: roster.substitutes.filter(char => char !== characterId),
      socials: roster.socials.filter(char => char !== characterId),
      lastUpdated: new Date(),
      updatedBy: req.admin.username
    };
    
    // Update roster
    await rosterCollection.replaceOne(
      { _id: roster._id },
      updatedRoster
    );
    
    res.json({
      success: true,
      message: 'Character removed from roster',
      roster: updatedRoster
    });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/roster',
      error: error,
      context: { method: 'DELETE', characterId: req.params.characterId }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to remove character',
      message: error.message
    });
  }
});

export default router;

