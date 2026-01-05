/**
 * @file Route handler for /api/reset endpoint - Admin database reset functionality
 * @module routes/reset
 */

import express from 'express';
import bcrypt from 'bcrypt';
import { 
  getAdminByUsername,
  connectToDatabase
} from '../database.js';
import { logError } from '../database.js';

const router = express.Router();

/**
 * POST /api/reset - Reset database collections (requires admin authentication)
 * This will wipe all data collections but preserve AppSettings and Admin
 */
router.post('/', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing credentials',
        message: 'Username and password are required'
      });
    }
    
    // Authenticate admin user
    const admin = await getAdminByUsername(username);
    if (!admin) {
      await logError({
        type: 'security',
        endpoint: '/api/reset',
        error: new Error('Invalid admin username'),
        context: { username, ip: req.ip }
      });
      
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid username or password'
      });
    }
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      await logError({
        type: 'security',
        endpoint: '/api/reset',
        error: new Error('Invalid admin password'),
        context: { username, ip: req.ip }
      });
      
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid username or password'
      });
    }
    
    // Admin authenticated successfully - proceed with database reset
    console.log(`🔄 Database reset initiated by admin: ${username}`);
    
    const { db } = await connectToDatabase();
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Collections to preserve (only AppSettings - critical for app function)
    const preserveCollections = ['AppSettings'];
    
    // Collections to drop (including Admin so user can recreate admin account)
    const collectionsToReset = collectionNames.filter(
      name => !preserveCollections.includes(name)
    );
    
    console.log('📋 Collections to reset:', collectionsToReset);
    console.log('🔒 Collections to preserve:', preserveCollections);
    
    const results = {
      dropped: [],
      failed: [],
      preserved: preserveCollections
    };
    
    // Drop each collection
    for (const collectionName of collectionsToReset) {
      try {
        await db.collection(collectionName).drop();
        results.dropped.push(collectionName);
        console.log(`✅ Dropped collection: ${collectionName}`);
      } catch (error) {
        // Collection might not exist or already dropped
        if (error.codeName === 'NamespaceNotFound') {
          console.log(`⚠️  Collection ${collectionName} does not exist`);
        } else {
          results.failed.push({ collection: collectionName, error: error.message });
          console.error(`❌ Failed to drop collection ${collectionName}:`, error);
        }
      }
    }
    
    // Log the reset action
    await logError({
      type: 'admin-action',
      endpoint: '/api/reset',
      error: new Error('Database reset performed'),
      context: { 
        username,
        ip: req.ip,
        droppedCollections: results.dropped,
        preservedCollections: results.preserved,
        failedCollections: results.failed
      }
    });
    
    console.log(`✅ Database reset completed by ${username}`);
    console.log(`   - Dropped: ${results.dropped.length} collections`);
    console.log(`   - Preserved: ${results.preserved.length} collections`);
    console.log(`   - Failed: ${results.failed.length} collections`);
    
    res.json({
      success: true,
      message: 'Database reset completed successfully',
      results: {
        dropped: results.dropped,
        preserved: results.preserved,
        failed: results.failed,
        summary: {
          droppedCount: results.dropped.length,
          preservedCount: results.preserved.length,
          failedCount: results.failed.length
        }
      }
    });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/reset',
      error: error,
      context: { method: 'POST', body: { username: req.body?.username } }
    });
    
    console.error('❌ Database reset failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Database reset failed',
      message: error.message
    });
  }
});

/**
 * GET /api/reset/info - Get information about what will be reset (requires admin auth)
 */
router.get('/info', async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Collections to preserve (only AppSettings)
    const preserveCollections = ['AppSettings'];
    
    // Collections to drop (including Admin so user can recreate admin account)
    const collectionsToReset = collectionNames.filter(
      name => !preserveCollections.includes(name)
    );
    
    // Get counts for each collection
    const collectionInfo = {};
    for (const collectionName of collectionsToReset) {
      try {
        const count = await db.collection(collectionName).countDocuments({});
        collectionInfo[collectionName] = count;
      } catch (error) {
        collectionInfo[collectionName] = 0;
      }
    }
    
    res.json({
      success: true,
      info: {
        collectionsToReset: collectionsToReset,
        collectionsToPreserve: preserveCollections,
        counts: collectionInfo,
        totalCollections: collectionsToReset.length,
        warning: 'This action will permanently delete all data in the listed collections including the Admin account. Only AppSettings will be preserved. You will need to recreate your admin account after reset.'
      }
    });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/reset/info',
      error: error,
      context: { method: 'GET' }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get reset info',
      message: error.message
    });
  }
});

export default router;

