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

// Declare singleton variables for MongoDB connection
let client;
let db;
let collection;

console.log(process.env, MONGODB_URI, DB_NAME, SEASON_SIGN_UP, MEMBERS_COLLECTION_NAME);

// Check for required environment variables
if (!MONGODB_URI) throw new Error('Missing required environment variable: MONGODB_URI');
if (!DB_NAME) throw new Error('Missing required environment variable: DB_NAME');
if (!SEASON_SIGN_UP) throw new Error('Missing required environment variable: SEASON_SIGN_UP');
if (!MEMBERS_COLLECTION_NAME) throw new Error('Missing required environment variable: MEMBERS_COLLECTION_NAME');

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
      lastUpdated: new Date(),
      isActive: true
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
      isActive: true,
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
 * Mark members as inactive if they were not updated in the current sync.
 * @param {string[]} updatedMemberNames - Names of members updated in this sync
 * @returns {Promise<Object>} MongoDB update result
 */
export async function removeInactiveMembers(updatedMemberNames) {
  try {
    const membersCollection = await getMembersCollection();
    
    // Find all members that weren't updated in this sync
    const inactiveMembers = await membersCollection.find({
      isActive: true,
      name: { $nin: updatedMemberNames }
    }).toArray();
    
    if (inactiveMembers.length > 0) {
      console.log(`🗑️ Removing ${inactiveMembers.length} inactive members:`, 
        inactiveMembers.map(m => `${m.name}-${m.server}`));
      
      const result = await membersCollection.updateMany(
        { isActive: true, name: { $nin: updatedMemberNames } },
        { $set: { isActive: false, removedAt: new Date() } }
      );
      
      console.log(`✅ Marked ${result.modifiedCount} members as inactive`);
      return result;
    }
    
    console.log('✅ No inactive members to remove');
    return { modifiedCount: 0 };
  } catch (error) {
    console.error('❌ Failed to remove inactive members:', error);
    throw error;
  }
}

/**
 * Get all active members, sorted by last update time (descending).
 * @returns {Promise<Object[]>} Array of active member documents
 */
export async function getAllActiveMembers() {
  try {
    const membersCollection = await getMembersCollection();
    
    const members = await membersCollection
      .sort({ lastUpdated: -1 })
      .toArray();
    
    return members;
  } catch (error) {
    console.error('❌ Failed to get all active members:', error);
    throw error;
  }
}

/**
 * Get the count of active members.
 * @returns {Promise<number>} Number of active members
 */
export async function getMemberCount() {
  try {
    const membersCollection = await getMembersCollection();
    
    const count = await membersCollection.countDocuments({ isActive: true });
    return count;
  } catch (error) {
    console.error('❌ Failed to get member count:', error);
    return 0;
  }
}

/**
 * Check if there is any active member data.
 * @returns {Promise<boolean>} True if there is at least one active member
 */
export async function hasMembersData() {
  try {
    const membersCollection = await getMembersCollection();
    
    const count = await membersCollection.countDocuments({ isActive: true });
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
    
    const count = await membersCollection.countDocuments({ isActive: true });
    
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

// Graceful shutdown handler for SIGTERM (kill signal)
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database connection...');
  await closeDatabase();
  process.exit(0);
}); 