/**
 * @file Route handler for /api/season-signups endpoint - Admin management of season signups
 * @module routes/apiSeasonSignups
 */

import express from 'express';
import { ObjectId } from 'mongodb';
import { 
  getSeason3Signups,
  connectToDatabase
} from '../database.js';
import { logError } from '../database.js';
import bcrypt from 'bcrypt';
import { getAdminByUsername } from '../database.js';

const router = express.Router();

// Collection name from environment
const SEASON_SIGN_UP = process.env.SIGNUP_COLLECTION;

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
 * GET /api/season-signups - Get all season signups (admin only)
 */
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const signups = await getSeason3Signups();
    
    res.json({
      success: true,
      signups: signups,
      total: signups.length
    });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/season-signups',
      error: error,
      context: { method: 'GET' }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get season signups',
      message: error.message
    });
  }
});

/**
 * DELETE /api/season-signups/:id - Delete a season signup (admin only)
 */
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Missing signup ID',
        message: 'Please provide a signup ID to delete'
      });
    }

    const { db } = await connectToDatabase();
    const season3Collection = db.collection(SEASON_SIGN_UP);
    
    // Validate ObjectId format
    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid signup ID format',
        message: 'The provided ID is not a valid MongoDB ObjectId'
      });
    }

    // Delete the signup
    const result = await season3Collection.deleteOne({ _id: objectId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Signup not found',
        message: 'No signup found with the provided ID'
      });
    }

    // Log the deletion
    await logError({
      type: 'admin-action',
      endpoint: '/api/season-signups',
      error: new Error('Season signup deleted'),
      context: { 
        username: req.admin.username,
        ip: req.ip,
        deletedId: id
      }
    });

    res.json({
      success: true,
      message: 'Signup deleted successfully',
      deletedId: id
    });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/season-signups',
      error: error,
      context: { method: 'DELETE', id: req.params.id }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete signup',
      message: error.message
    });
  }
});

export default router;

