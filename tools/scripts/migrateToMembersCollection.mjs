#!/usr/bin/env node

import { 
  connectToDatabase, 
  addMember,
  getAllActiveMembers
} from '../../src/database.js';

/**
 * Migration script to move from the old guild_data collection structure
 * to the new members collection where each character is a separate document.
 * 
 * This will significantly reduce memory usage by storing each character
 * as an individual document instead of one large document with all guild data.
 */
async function migrateToMembersCollection() {
  console.log('🔄 Starting migration to members collection...');
  
  try {
    // Connect to database
    await connectToDatabase();
    
    // Check if members collection already has data
    const existingMembers = await getAllActiveMembers();
    if (existingMembers.length > 0) {
      console.log(`⚠️  Members collection already has ${existingMembers.length} members.`);
      console.log('   Migration may have already been run. Skipping...');
      return;
    }
    
    // No legacy data to migrate
    console.log('❌ No legacy guild data found to migrate. Migration not required.');
    return;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToMembersCollection()
    .then(() => {
      console.log('🏁 Migration script completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    });
}

export default migrateToMembersCollection; 