// MongoDB database utility functions for Season 3 and members collections
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

// MongoDB connection URI from environment variable
const MONGODB_URI = process.env.MONGODB;
// Database name from environment variable
const DB_NAME = process.env.DATABASE_NAME;

// Collection name for Season 3 data
const SEASON_SIGN_UP = process.env.SIGNUP_COLLECTION;
// Collection name for members data
const MEMBERS_COLLECTION_NAME = process.env.MEMBERS_COLLECTION_NAME;
// Collection name for error logs
const ERRORS_COLLECTION_NAME = process.env.ERRORS_COLLECTION_NAME;
// Collection name for top seasonal statistics
const TOP_SEASONAL_COLLECTION_NAME = process.env.TOP_SEASONAL_COLLECTION_NAME || 'topSeasonal';

// Declare singleton variables for MongoDB connection
let client;
let db;
let collection;

console.log(process.env, MONGODB_URI, DB_NAME, SEASON_SIGN_UP, MEMBERS_COLLECTION_NAME, ERRORS_COLLECTION_NAME);

// Check for required environment variables
if (!MONGODB_URI) throw new Error('Missing required environment variable: MONGODB_URI');
if (!DB_NAME) throw new Error('Missing required environment variable: DB_NAME');
if (!SEASON_SIGN_UP) throw new Error('Missing required environment variable: SEASON_SIGN_UP');
if (!MEMBERS_COLLECTION_NAME) throw new Error('Missing required environment variable: MEMBERS_COLLECTION_NAME');
if (!ERRORS_COLLECTION_NAME) throw new Error('Missing required environment variable: ERRORS_COLLECTION_NAME');

/**
 * Connect to MongoDB and return the client, db, and collection objects.
 * Uses a singleton pattern to avoid multiple connections.
 * @returns {Promise<{ client: MongoClient, db: Db, collection: Collection }>} MongoDB connection objects
 */
export async function connectToDatabase() {
  try {
    // If already connected, return existing connection
    if (client && db) {
      return { client, db, collection };
    }

    // Create new MongoDB client and connect
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    // Optionally, assign collection if you want a default one
    // collection = db.collection(MEMBERS_COLLECTION_NAME);
    console.log('✅ Connected to MongoDB successfully');
    return { client, db, collection };
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

/**
 * Get the MongoDB collection for members.
 * @returns {Promise<Collection>} The members collection
 */
async function getMembersCollection() {
  const connection = await connectToDatabase();
  if (!connection || !connection.db) {
    throw new Error('Database connection failed');
  }
  return connection.db.collection(MEMBERS_COLLECTION_NAME);
}

/**
 * Find a member by name and server.
 * @param {string} name - Character name
 * @param {string} server - Server name
 * @returns {Promise<Object|null>} The member document or null if not found
 */
export async function findMemberByName(name, server) {
  try {
    const membersCollection = await getMembersCollection();
    
    const member = await membersCollection.findOne({
      name: name,
      server: server
    });
    
    return member;
  } catch (error) {
    console.error('❌ Failed to find member by name:', error);
    // Return null instead of throwing error - this is expected for new members
    return null;
  }
}

/**
 * Update an existing member with new character data.
 * @param {string} name - Character name
 * @param {string} server - Server name
 * @param {Object} characterData - Data to update
 * @returns {Promise<Object>} MongoDB update result
 */
export async function updateMember(name, server, characterData) {
  try {
    const membersCollection = await getMembersCollection();
    
    const updateData = {
      ...characterData,
      name: name,
      server: server,
      lastUpdated: new Date()
    };
    
    const result = await membersCollection.updateOne(
      { name: name, server: server },
      { $set: updateData },
      { upsert: false }
    );
    
    console.log(`✅ Updated member: ${name}-${server}`);
    return result;
  } catch (error) {
    console.error('❌ Failed to update member:', error);
    // Don't throw error, just log it and continue
    return { modifiedCount: 0 };
  }
}

/**
 * Add a new member to the collection.
 * @param {Object} characterData - Data for the new member
 * @returns {Promise<Object>} MongoDB insert result
 */
export async function addMember(characterData) {
  try {
    const membersCollection = await getMembersCollection();
    
    const memberData = {
      ...characterData,
      lastUpdated: new Date(),
      createdAt: new Date()
    };
    
    const result = await membersCollection.insertOne(memberData);
    
    console.log(`✅ Added new member: ${characterData.name}-${characterData.server}`);
    return result;
  } catch (error) {
    console.error('❌ Failed to add member:', error);
    // Don't throw error, just log it and continue
    return { insertedId: null };
  }
}

/**
 * Get all members, sorted by item level (descending).
 * @returns {Promise<Object[]>} Array of member documents
 */
export async function getAllMembers() {
  try {
    const membersCollection = await getMembersCollection();
    
    const members = await membersCollection
      .find({})
      .sort({ 'itemlevel.equiped': -1 })
      .toArray();
    
    return members;
  } catch (error) {
    console.error('❌ Failed to get all members:', error);
    throw error;
  }
}

/**
 * Get the count of members.
 * @returns {Promise<number>} Number of members
 */
export async function getMemberCount() {
  try {
    const membersCollection = await getMembersCollection();
    
    const count = await membersCollection.countDocuments({});
    return count;
  } catch (error) {
    console.error('❌ Failed to get member count:', error);
    return 0;
  }
}

/**
 * Check if there is any member data.
 * @returns {Promise<boolean>} True if there is at least one member
 */
export async function hasMembersData() {
  try {
    const membersCollection = await getMembersCollection();
    
    const count = await membersCollection.countDocuments({});
    return count > 0;
  } catch (error) {
    console.error('❌ Failed to check members data existence:', error);
    return false;
  }
}

/**
 * Get the data status for the members collection.
 * @returns {Promise<'no_data'|'ready'|'error'>} Status string
 */
export async function getMembersDataStatus() {
  try {
    const membersCollection = await getMembersCollection();
    
    const count = await membersCollection.countDocuments({});
    
    if (count === 0) {
      return 'no_data';
    }
    
    return 'ready';
  } catch (error) {
    console.error('❌ Failed to get members data status:', error);
    return 'error';
  }
}

/**
 * Check if any guild data exists (currently just checks members collection).
 * @returns {Promise<boolean>} True if guild data exists
 */
export async function hasGuildData() {
  try {
    // First check members collection
    const hasMembers = await hasMembersData();
    if (hasMembers) {
      return true;
    }
    
    return false
  } catch (error) {
    console.error('❌ Failed to check guild data existence:', error);
    return false;
  }
}

/**
 * Get the overall data status (currently just checks members collection).
 * @returns {Promise<'ready'|'no_data'|'error'>} Status string
 */
export async function getDataStatus() {
  try {
    // First check members collection
    const membersStatus = await getMembersDataStatus();
    if (membersStatus === 'ready') {
      return 'ready';
    }
    
    return membersStatus;
  } catch (error) {
    console.error('❌ Failed to get data status:', error);
    return 'error';
  }
}

// ===== SEASON 3 COLLECTION FUNCTIONS =====

/**
 * Save a Season 3 signup document to MongoDB.
 * @param {Object} signupData - Signup data to save
 * @returns {Promise<Object>} MongoDB insert result
 */
export async function saveSeason3Signup(signupData) {
  try {
    const { db } = await connectToDatabase();
    const season3Collection = db.collection(SEASON_SIGN_UP);
    
    // Create a document with timestamp and signup data
    const document = {
      timestamp: new Date(),
      type: 'signup',
      ...signupData
    };
    
    // Insert the new document
    const result = await season3Collection.insertOne(document);
    
    console.log('✅ Season 3 signup saved to MongoDB:', result.insertedId);
    return result;
  } catch (error) {
    console.error('❌ Failed to save Season 3 signup to MongoDB:', error);
    throw error;
  }
}

/**
 * Get all Season 3 signup documents from MongoDB, sorted by timestamp (descending).
 * @returns {Promise<Object[]>} Array of signup documents
 */
export async function getSeason3Signups() {
  try {
    const { db } = await connectToDatabase();
    const season3Collection = db.collection(SEASON_SIGN_UP);
    
    // Find all signup documents
    const signups = await season3Collection
      .find({ type: 'signup' })
      .sort({ timestamp: -1 })
      .toArray();
    
    return signups;
  } catch (error) {
    console.error('❌ Failed to get Season 3 signups from MongoDB:', error);
    throw error;
  }
}

/**
 * Save Season 3 character data to MongoDB.
 * @param {Object} characterData - Character data to save
 * @returns {Promise<Object>} MongoDB insert result
 */
export async function saveSeason3Data(characterData) {
  try {
    const { db } = await connectToDatabase();
    const season3Collection = db.collection(SEASON_SIGN_UP);
    
    // Create a document with timestamp and character data
    const document = {
      timestamp: new Date(),
      type: 'character_data',
      data: characterData
    };
    
    // Insert the new document
    const result = await season3Collection.insertOne(document);
    
    console.log('✅ Season 3 character data saved to MongoDB:', result.insertedId);
    return result;
  } catch (error) {
    console.error('❌ Failed to save Season 3 character data to MongoDB:', error);
    throw error;
  }
}

/**
 * Get the latest Season 3 character data document from MongoDB.
 * @returns {Promise<Object|null>} The latest character data document or null if none found
 */
export async function getLatestSeason3Data() {
  try {
    const { db } = await connectToDatabase();
    const season3Collection = db.collection(SEASON_SIGN_UP);
    
    console.log('🔍 Searching for Season 3 data in collection:', SEASON_SIGN_UP);
    
    // First, let's see what's actually in the collection
    const allDocuments = await season3Collection.find({}).toArray();
    console.log('📋 All documents in season3_data collection:', allDocuments.length);
    console.log('📄 Document types found:', allDocuments.map(doc => ({ type: doc.type, timestamp: doc.timestamp })));
    
    // Find the most recent character data document
    const latestDocument = await season3Collection
      .find({ type: 'character_data' })
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();
    
    console.log('🎯 Latest character_data document:', latestDocument);
    
    if (latestDocument.length === 0) {
      console.log('❌ No character_data documents found');
      return null;
    }
    
    return latestDocument[0];
  } catch (error) {
    console.error('❌ Failed to get latest Season 3 data from MongoDB:', error);
    throw error;
  }
}

/**
 * Check if any Season 3 character data exists.
 * @returns {Promise<boolean>} True if at least one character_data document exists
 */
export async function hasSeason3Data() {
  try {
    const { db } = await connectToDatabase();
    const season3Collection = db.collection(SEASON_SIGN_UP);
    
    const count = await season3Collection.countDocuments({ type: 'character_data' });
    return count > 0;
  } catch (error) {
    console.error('❌ Failed to check Season 3 data existence:', error);
    return false;
  }
}

/**
 * Close the MongoDB connection gracefully.
 * @returns {Promise<void>}
 */
export async function closeDatabase() {
  try {
    if (client) {
      await client.close();
      client = null;
      db = null;
      collection = null;
      console.log('✅ MongoDB connection closed');
    }
  } catch (error) {
    console.error('❌ Failed to close MongoDB connection:', error);
  }
}

// Graceful shutdown handler for SIGINT (Ctrl+C)
process.on('SIGINT', async () => {
  console.log('SIGINT received, closing database connection...');
  await closeDatabase();
  process.exit(0);
});

// ===== ERROR LOGGING FUNCTIONS =====

/**
 * Get the MongoDB collection for error logs.
 * @returns {Promise<Collection>} The errors collection
 */
async function getErrorsCollection() {
  const connection = await connectToDatabase();
  if (!connection || !connection.db) {
    throw new Error('Database connection failed');
  }
  return connection.db.collection(ERRORS_COLLECTION_NAME);
}

/**
 * Log an error to the MongoDB errors collection.
 * @param {Object} errorData - Error data to log
 * @param {string} errorData.type - Type of error (e.g., 'api', 'guild-fetch', 'database')
 * @param {string} errorData.endpoint - API endpoint or process name where error occurred
 * @param {Error} errorData.error - The original error object
 * @param {Object} errorData.context - Additional context data
 * @param {string} errorData.processId - Process ID if applicable
 * @param {string} errorData.character - Character name if applicable
 * @returns {Promise<Object>} MongoDB insert result
 */
export async function logError({ type, endpoint, error, context = {}, processId = null, character = null }) {
  try {
    const errorsCollection = await getErrorsCollection();
    
    const errorLog = {
      timestamp: new Date(),
      type: type || 'unknown',
      endpoint: endpoint || 'unknown',
      error: {
        name: error?.name || 'UnknownError',
        message: error?.message || 'Unknown error occurred',
        stack: error?.stack || null,
        code: error?.code || null,
        status: error?.status || null,
        statusCode: error?.statusCode || null
      },
      context: {
        ...context,
        processId,
        character,
        userAgent: context.userAgent || null,
        ip: context.ip || null,
        url: context.url || null,
        method: context.method || null,
        body: context.body || null,
        query: context.query || null,
        params: context.params || null
      },
      severity: error?.status >= 500 || error?.statusCode >= 500 ? 'high' : 
                error?.status >= 400 || error?.statusCode >= 400 ? 'medium' : 'low',
      resolved: false
    };
    
    const result = await errorsCollection.insertOne(errorLog);
    
    console.log(`📝 Error logged to MongoDB: ${result.insertedId}`);
    return result;
  } catch (logError) {
    console.error('❌ Failed to log error to MongoDB:', logError);
    // Don't throw error here to avoid infinite loops
    return { insertedId: null };
  }
}

/**
 * Get all error logs from MongoDB, sorted by timestamp (descending).
 * @param {Object} options - Query options
 * @param {string} options.type - Filter by error type
 * @param {string} options.endpoint - Filter by endpoint
 * @param {boolean} options.resolved - Filter by resolved status
 * @param {string} options.severity - Filter by severity
 * @param {number} options.limit - Limit number of results
 * @returns {Promise<Object[]>} Array of error log documents
 */
export async function getErrorLogs({ type = null, endpoint = null, resolved = null, severity = null, limit = 100 } = {}) {
  try {
    const errorsCollection = await getErrorsCollection();
    
    // Build query filter
    const filter = {};
    if (type) filter.type = type;
    if (endpoint) filter.endpoint = endpoint;
    if (resolved !== null) filter.resolved = resolved;
    if (severity) filter.severity = severity;
    
    const errors = await errorsCollection
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    return errors;
  } catch (error) {
    console.error('❌ Failed to get error logs from MongoDB:', error);
    throw error;
  }
}

/**
 * Get error statistics from MongoDB.
 * @returns {Promise<Object>} Error statistics
 */
export async function getErrorStats() {
  try {
    const errorsCollection = await getErrorsCollection();
    
    const stats = await errorsCollection.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          resolved: { $sum: { $cond: ['$resolved', 1, 0] } },
          unresolved: { $sum: { $cond: ['$resolved', 0, 1] } },
          highSeverity: { $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] } },
          mediumSeverity: { $sum: { $cond: [{ $eq: ['$severity', 'medium'] }, 1, 0] } },
          lowSeverity: { $sum: { $cond: [{ $eq: ['$severity', 'low'] }, 1, 0] } }
        }
      }
    ]).toArray();
    
    const typeStats = await errorsCollection.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();
    
    const endpointStats = await errorsCollection.aggregate([
      {
        $group: {
          _id: '$endpoint',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    return {
      overview: stats[0] || { total: 0, resolved: 0, unresolved: 0, highSeverity: 0, mediumSeverity: 0, lowSeverity: 0 },
      byType: typeStats,
      byEndpoint: endpointStats
    };
  } catch (error) {
    console.error('❌ Failed to get error stats from MongoDB:', error);
    throw error;
  }
}

/**
 * Get a specific error by ID from MongoDB.
 * @param {string} errorId - MongoDB ObjectId of the error
 * @returns {Promise<Object|null>} Error document or null if not found
 */
export async function getErrorById(errorId) {
  try {
    const errorsCollection = await getErrorsCollection();
    const { ObjectId } = await import('mongodb');
    
    const error = await errorsCollection.findOne({ _id: new ObjectId(errorId) });
    
    if (error) {
      console.log(`✅ Retrieved error ${errorId} from MongoDB`);
    } else {
      console.log(`⚠️ Error ${errorId} not found in MongoDB`);
    }
    
    return error;
  } catch (error) {
    console.error('❌ Failed to get error by ID from MongoDB:', error);
    throw error;
  }
}

/**
 * Mark an error as resolved.
 * @param {string} errorId - MongoDB ObjectId of the error
 * @returns {Promise<Object>} MongoDB update result
 */
export async function resolveError(errorId) {
  try {
    const errorsCollection = await getErrorsCollection();
    const { ObjectId } = await import('mongodb');
    
    const result = await errorsCollection.updateOne(
      { _id: new ObjectId(errorId) },
      { $set: { resolved: true, resolvedAt: new Date() } }
    );
    
    console.log(`✅ Error ${errorId} marked as resolved`);
    return result;
  } catch (error) {
    console.error('❌ Failed to resolve error:', error);
    throw error;
  }
}

/**
 * Delete a specific error log.
 * @param {string} errorId - MongoDB ObjectId of the error
 * @returns {Promise<Object>} MongoDB delete result
 */
export async function deleteError(errorId) {
  try {
    const errorsCollection = await getErrorsCollection();
    const { ObjectId } = await import('mongodb');
    
    const result = await errorsCollection.deleteOne({ _id: new ObjectId(errorId) });
    
    console.log(`🗑️ Error ${errorId} deleted`);
    return result;
  } catch (error) {
    console.error('❌ Failed to delete error:', error);
    throw error;
  }
}

/**
 * Delete all error logs.
 * @param {Object} options - Delete options
 * @param {string} options.type - Delete only errors of specific type
 * @param {boolean} options.resolved - Delete only resolved/unresolved errors
 * @param {string} options.severity - Delete only errors of specific severity
 * @returns {Promise<Object>} MongoDB delete result
 */
export async function deleteAllErrors({ type = null, resolved = null, severity = null } = {}) {
  try {
    const errorsCollection = await getErrorsCollection();
    
    // Build query filter
    const filter = {};
    if (type) filter.type = type;
    if (resolved !== null) filter.resolved = resolved;
    if (severity) filter.severity = severity;
    
    const result = await errorsCollection.deleteMany(filter);
    
    console.log(`🗑️ Deleted ${result.deletedCount} error logs`);
    return result;
  } catch (error) {
    console.error('❌ Failed to delete all errors:', error);
    throw error;
  }
}

// ===== TOP SEASONAL COLLECTION FUNCTIONS =====

/**
 * Get the MongoDB collection for top seasonal statistics.
 * @returns {Promise<Collection>} The top seasonal collection
 */
async function getTopSeasonalCollection() {
  const connection = await connectToDatabase();
  if (!connection || !connection.db) {
    throw new Error('Database connection failed');
  }
  return connection.db.collection(TOP_SEASONAL_COLLECTION_NAME);
}

/**
 * Save or update top seasonal statistics to MongoDB.
 * @param {Object} seasonalStats - Seasonal statistics data
 * @returns {Promise<Object>} MongoDB upsert result
 */
export async function saveTopSeasonalStats(seasonalStats) {
  try {
    const topSeasonalCollection = await getTopSeasonalCollection();
    
    const document = {
      ...seasonalStats,
      lastUpdated: new Date(),
      createdAt: seasonalStats.createdAt || new Date()
    };
    
    const result = await topSeasonalCollection.updateOne(
      { season: seasonalStats.season },
      { $set: document },
      { upsert: true }
    );
    
    console.log(`✅ Top seasonal stats saved for season ${seasonalStats.season}`);
    return result;
  } catch (error) {
    console.error('❌ Failed to save top seasonal stats:', error);
    throw error;
  }
}

/**
 * Get the latest top seasonal statistics from MongoDB.
 * @param {number} season - Season number (optional, defaults to latest)
 * @returns {Promise<Object|null>} Top seasonal statistics or null if not found
 */
export async function getTopSeasonalStats(season = null) {
  try {
    const topSeasonalCollection = await getTopSeasonalCollection();
    
    let query = {};
    if (season !== null) {
      query.season = season;
    }
    
    const stats = await topSeasonalCollection
      .find(query)
      .sort({ season: -1 })
      .limit(1)
      .toArray();
    
    return stats.length > 0 ? stats[0] : null;
  } catch (error) {
    console.error('❌ Failed to get top seasonal stats:', error);
    throw error;
  }
}

/**
 * Get all top seasonal statistics from MongoDB.
 * @returns {Promise<Object[]>} Array of seasonal statistics documents
 */
export async function getAllTopSeasonalStats() {
  try {
    const topSeasonalCollection = await getTopSeasonalCollection();
    
    const stats = await topSeasonalCollection
      .find({})
      .sort({ season: -1 })
      .toArray();
    
    return stats;
  } catch (error) {
    console.error('❌ Failed to get all top seasonal stats:', error);
    throw error;
  }
}

/**
 * Delete top seasonal statistics for a specific season.
 * @param {number} season - Season number
 * @returns {Promise<Object>} MongoDB delete result
 */
export async function deleteTopSeasonalStats(season) {
  try {
    const topSeasonalCollection = await getTopSeasonalCollection();
    
    const result = await topSeasonalCollection.deleteOne({ season });
    
    console.log(`🗑️ Top seasonal stats for season ${season} deleted`);
    return result;
  } catch (error) {
    console.error('❌ Failed to delete top seasonal stats:', error);
    throw error;
  }
}

/**
 * Check if top seasonal statistics exist for a specific season.
 * @param {number} season - Season number
 * @returns {Promise<boolean>} True if statistics exist
 */
export async function hasTopSeasonalStats(season) {
  try {
    const topSeasonalCollection = await getTopSeasonalCollection();
    
    const count = await topSeasonalCollection.countDocuments({ season });
    return count > 0;
  } catch (error) {
    console.error('❌ Failed to check top seasonal stats existence:', error);
    return false;
  }
}

// ===== APP SETTINGS COLLECTION FUNCTIONS =====

/**
 * Get the MongoDB collection for app settings.
 * @returns {Promise<Collection>} The app settings collection
 */
async function getAppSettingsCollection() {
  const connection = await connectToDatabase();
  if (!connection || !connection.db) {
    throw new Error('Database connection failed');
  }
  return connection.db.collection('AppSettings');
}

/**
 * Get the current app settings from MongoDB.
 * @returns {Promise<Object|null>} App settings document or null if not found
 */
export async function getAppSettings() {
  try {
    const appSettingsCollection = await getAppSettingsCollection();
    const settings = await appSettingsCollection.findOne({});
    return settings;
  } catch (error) {
    console.error('❌ Failed to get app settings:', error);
    throw error;
  }
}

/**
 * Check if app settings have been initialized.
 * @returns {Promise<boolean>} True if app settings exist
 */
export async function hasAppSettings() {
  try {
    const appSettingsCollection = await getAppSettingsCollection();
    const count = await appSettingsCollection.countDocuments({});
    return count > 0;
  } catch (error) {
    console.error('❌ Failed to check app settings existence:', error);
    return false;
  }
}

/**
 * Save or update app settings in MongoDB.
 * @param {Object} settings - App settings data
 * @returns {Promise<Object>} MongoDB upsert result
 */
export async function saveAppSettings(settings) {
  try {
    const appSettingsCollection = await getAppSettingsCollection();
    
    const document = {
      ...settings,
      lastUpdated: new Date(),
      createdAt: settings.createdAt || new Date()
    };
    
    const result = await appSettingsCollection.updateOne(
      {},
      { $set: document },
      { upsert: true }
    );
    
    console.log('✅ App settings saved to MongoDB');
    return result;
  } catch (error) {
    console.error('❌ Failed to save app settings:', error);
    throw error;
  }
}

// ===== ADMIN COLLECTION FUNCTIONS =====

/**
 * Get the MongoDB collection for admin users.
 * @returns {Promise<Collection>} The admin collection
 */
async function getAdminCollection() {
  const connection = await connectToDatabase();
  if (!connection || !connection.db) {
    throw new Error('Database connection failed');
  }
  return connection.db.collection('Admin');
}

/**
 * Get admin user by username.
 * @param {string} username - Admin username
 * @returns {Promise<Object|null>} Admin document or null if not found
 */
export async function getAdminByUsername(username) {
  try {
    const adminCollection = await getAdminCollection();
    const admin = await adminCollection.findOne({ username });
    return admin;
  } catch (error) {
    console.error('❌ Failed to get admin by username:', error);
    throw error;
  }
}

/**
 * Create a new admin user.
 * @param {string} username - Admin username
 * @param {string} hashedPassword - Hashed password
 * @returns {Promise<Object>} MongoDB insert result
 */
export async function createAdmin(username, hashedPassword) {
  try {
    const adminCollection = await getAdminCollection();
    
    const admin = {
      username,
      password: hashedPassword,
      createdAt: new Date(),
      lastLogin: null
    };
    
    const result = await adminCollection.insertOne(admin);
    console.log('✅ Admin user created');
    return result;
  } catch (error) {
    console.error('❌ Failed to create admin:', error);
    throw error;
  }
}

/**
 * Check if any admin users exist.
 * @returns {Promise<boolean>} True if at least one admin exists
 */
export async function hasAdmin() {
  try {
    const adminCollection = await getAdminCollection();
    const count = await adminCollection.countDocuments({});
    return count > 0;
  } catch (error) {
    console.error('❌ Failed to check admin existence:', error);
    return false;
  }
}

// ===== JOIN TEXT COLLECTION FUNCTIONS =====

/**
 * Get the MongoDB collection for join text.
 * @returns {Promise<Collection>} The join text collection
 */
async function getJoinTextCollection() {
  const connection = await connectToDatabase();
  if (!connection || !connection.db) {
    throw new Error('Database connection failed');
  }
  return connection.db.collection('jointext');
}

/**
 * Get the current join text from MongoDB.
 * @returns {Promise<Object|null>} Join text document or null if not found
 */
export async function getJoinText() {
  try {
    const joinTextCollection = await getJoinTextCollection();
    const joinText = await joinTextCollection.findOne({});
    return joinText;
  } catch (error) {
    console.error('❌ Failed to get join text:', error);
    throw error;
  }
}

/**
 * Check if join text has been initialized.
 * @returns {Promise<boolean>} True if join text exists
 */
export async function hasJoinText() {
  try {
    const joinTextCollection = await getJoinTextCollection();
    const count = await joinTextCollection.countDocuments({});
    return count > 0;
  } catch (error) {
    console.error('❌ Failed to check join text existence:', error);
    return false;
  }
}

/**
 * Save or update join text in MongoDB.
 * @param {Object} joinText - Join text data
 * @returns {Promise<Object>} MongoDB upsert result
 */
export async function saveJoinText(joinText) {
  try {
    const joinTextCollection = await getJoinTextCollection();
    
    const document = {
      ...joinText,
      lastUpdated: new Date(),
      createdAt: joinText.createdAt || new Date()
    };
    
    // Use replaceOne instead of updateOne with $set to completely replace the document
    // This ensures old format data is removed when saving new format
    const result = await joinTextCollection.replaceOne(
      {},
      document,
      { upsert: true }
    );
    
    console.log('✅ Join text saved to MongoDB');
    return result;
  } catch (error) {
    console.error('❌ Failed to save join text:', error);
    throw error;
  }
}

// Graceful shutdown handler for SIGTERM (kill signal)
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database connection...');
  await closeDatabase();
  process.exit(0);
}); 