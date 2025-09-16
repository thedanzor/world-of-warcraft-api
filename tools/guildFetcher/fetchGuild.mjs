// Suppress ExperimentalWarning
process.removeAllListeners('warning');

import { BlizzAPI } from "blizzapi";

import figlet from 'figlet';
import gradient from 'gradient-string';

import { 
  findMemberByName, 
  updateMember, 
  addMember,
  logError
} from '../../src/database.js';


// Import the config as a module instead of parsing as JSON
const config = await import('../../app.config.js');

const {
    API_PARAM_REQUIREMENTGS,
    GUILD_NAME,
    GUILD_REALM,
    LEVEL_REQUIREMENT,
    API_BATTLENET_KEY,
    API_BATTLENET_SECRET,
    REGION
} = config.default;  // Use .default since we're importing as a module

// Business logic specific variables
const GUILD_URL = `/data/wow/guild/${GUILD_REALM}/${GUILD_NAME}/roster?${API_PARAM_REQUIREMENTGS}`

// Display disclaimer
console.log(gradient.pastel.multiline(figlet.textSync('Audit Tool', {
    horizontalLayout: 'full'
})));
console.log(gradient.cristal.multiline('Built by Scott Jones | Holybarryz'));
console.log(gradient.morning('Copyright 2024 all rights reserved\n'));

/**
 * Emits progress updates via WebSocket
 * @param {Object} io - Socket.io instance
 * @param {string} processId - Process identifier
 * @param {string} type - Update type
 * @param {Object} data - Update data
 */
function emitProgress(io, processId, type, data) {
  // Only emit WebSocket events if io is provided
  if (io) {
    io.emit('guild-update-progress', {
      processId,
      type,
      data,
      timestamp: new Date().toISOString()
    });
  }
  
  // Add CLI logging
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type.toUpperCase()}] ${data.message || JSON.stringify(data)}`);
}


/**
 * Main function to fetch and process guild data from Battle.net API
 * @param {Array} dataTypes - Array of data types to fetch ['raid', 'mplus', 'pvp']
 * @param {string} processId - Unique process identifier
 * @param {Object} io - Socket.io instance for real-time updates
 * @returns {Promise} Promise that resolves when the process completes
 */
export const startGuildUpdate = async (dataTypes = ['raid', 'mplus', 'pvp'], processId, io) => {
    const updatedMemberNames = []; // Track which members were updated
    
    try {
        // Emit start event
        emitProgress(io, processId, 'start', {
            message: 'Starting guild data update',
            dataTypes
        });

        // Initial auth
        emitProgress(io, processId, 'auth', {
            message: 'Authenticating with Battle.net API...'
        });
        
        let BnetApi, token;
        try {
            const clientId = API_BATTLENET_KEY;
            const clientSecret = API_BATTLENET_SECRET;
            BnetApi = new BlizzAPI({ region: REGION, clientId, clientSecret });
            token = await BnetApi.getAccessToken();
            
            emitProgress(io, processId, 'auth', {
                message: 'Authentication successful!',
                success: true
            });
        } catch (authError) {
            await logError({
                type: 'guild-fetch',
                endpoint: 'battle-net-auth',
                error: authError,
                context: { processId, region: REGION },
                processId
            });
            throw authError;
        }

        // Guild fetch
        emitProgress(io, processId, 'guild-fetch', {
            message: 'Fetching guild roster...'
        });
        
        let guild, trimmedList;
        try {
            guild = await BnetApi.query(`${GUILD_URL}&access_token=${token}`);
            trimmedList = guild.members.filter(member => member.character.level >= LEVEL_REQUIREMENT);
            
            emitProgress(io, processId, 'guild-fetch', {
                message: `Found ${trimmedList.length} eligible guild members`,
                success: true,
                memberCount: trimmedList.length
            });
        } catch (guildError) {
            await logError({
                type: 'guild-fetch',
                endpoint: 'guild-roster-fetch',
                error: guildError,
                context: { 
                    processId, 
                    guildName: GUILD_NAME, 
                    guildRealm: GUILD_REALM,
                    guildUrl: GUILD_URL 
                },
                processId
            });
            throw guildError;
        }

        // Process members
        emitProgress(io, processId, 'member-processing', {
            message: 'Processing guild members...',
            total: trimmedList.length,
            current: 0
        });

        let index = 0;
        
        const handleMember = async (member) => {
            const characterName = member.name || member.character.name.toLowerCase();
            const server = member.server || member.character.realm.slug.toLowerCase();

            emitProgress(io, processId, 'member-processing', {
                message: `Processing ${characterName}-${server}`,
                total: trimmedList.length,
                current: index + 1,
                character: `${characterName}-${server}`
            });

            try {
                // Use the character fetch endpoint to get fresh data
                const host = process.env.HOST || 'localhost';
                const port = process.env.PORT || 8000;
                const fetchUrl = `http://${host}:${port}/api/fetch/${server}/${characterName}?dataTypes=${dataTypes.join(',')}`;
                
                const response = await fetch(fetchUrl);
                const result = await response.json();
                
                if (!response.ok) {
                    const fetchError = new Error(`HTTP ${response.status}: ${response.statusText}`);
                    fetchError.status = response.status;
                    await logError({
                        type: 'guild-fetch',
                        endpoint: 'character-fetch',
                        error: fetchError,
                        context: { 
                            processId, 
                            character: `${characterName}-${server}`,
                            fetchUrl,
                            responseStatus: response.status,
                            responseText: await response.text()
                        },
                        processId,
                        character: `${characterName}-${server}`
                    });
                    throw fetchError;
                }
                
                if (result.success && result.character) {
                    const character = result.character;
                    
                    // Add guild rank to the character data
                    character.guildData = {
                        rank: member.rank
                    };
                    
                    // Check if member exists in database
                    try {
                        const existingMember = await findMemberByName(characterName, server);
                        
                        if (existingMember) {
                            // Update existing member
                            await updateMember(characterName, server, character);
                            console.log(`✅ Updated existing member: ${characterName}-${server}`);
                        } else {
                            // Add new member
                            await addMember(character);
                            console.log(`✅ Added new member: ${characterName}-${server}`);
                        }
                        
                        // Track this member as updated
                        updatedMemberNames.push(characterName);
                    } catch (dbError) {
                        await logError({
                            type: 'guild-fetch',
                            endpoint: 'database-operation',
                            error: dbError,
                            context: { 
                                processId, 
                                character: `${characterName}-${server}`,
                                operation: existingMember ? 'update' : 'insert'
                            },
                            processId,
                            character: `${characterName}-${server}`
                        });
                        console.error(`❌ Database error for ${characterName}-${server}:`, dbError.message);
                        // Continue processing other characters even if this one fails
                    }
                } else {
                    console.log(`⚠️ Character ${characterName}-${server} not found or failed to fetch`);
                }
            } catch (error) {
                await logError({
                    type: 'guild-fetch',
                    endpoint: 'character-processing',
                    error: error,
                    context: { 
                        processId, 
                        character: `${characterName}-${server}`,
                        dataTypes
                    },
                    processId,
                    character: `${characterName}-${server}`
                });
                
                emitProgress(io, processId, 'error', {
                    message: `Error processing ${characterName}-${server}: ${error.message}`,
                    character: `${characterName}-${server}`
                });
            }

            index++;
            
            if (trimmedList[index]) {
                await handleMember(trimmedList[index]);
            }
        };

        await handleMember(trimmedList[index]);

        emitProgress(io, processId, 'complete', {
            message: 'Guild data update completed successfully!',
            success: true,
            statistics: {
                totalMembers: updatedMemberNames.length,
                updatedMembers: updatedMemberNames.length,
                dataTypes
            }
        });
        
    } catch (error) {
        await logError({
            type: 'guild-fetch',
            endpoint: 'guild-update-process',
            error: error,
            context: { 
                processId, 
                dataTypes,
                memberCount: updatedMemberNames.length
            },
            processId
        });
        
        emitProgress(io, processId, 'error', {
            message: 'Guild update process failed',
            error: error.message
        });
        throw error;
    }
};

export default startGuildUpdate;