// Suppress ExperimentalWarning
process.removeAllListeners('warning');

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { BlizzAPI } from "blizzapi";

import figlet from 'figlet';
import gradient from 'gradient-string';

import { exec } from 'child_process';
import { promisify } from 'util';
import { 
  saveGuildData, 
  findMemberByName, 
  updateMember, 
  addMember, 
  removeInactiveMembers 
} from '../../src/database.js';

// Convert exec to promise-based
const execAsync = promisify(exec);

// Utils we've made
import {
  getCharacterInformation,
  needsEnchant,
  hasEnchant,
  isTierItem,
  isPersonLocked
} from './utils.mjs'

// Replace the config import section with:
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, '../../app.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const {
    ENCHANTABLE_PIECES,
    MIN_CHECK_CAP,
    API_PARAM_REQUIREMENTGS,
    GUILD_NAME,
    GUILD_REALM,
    LEVEL_REQUIREMENT,
    ITEM_LEVEL_REQUIREMENT,
    API_BATTLENET_KEY,
    API_BATTLENET_SECRET,
    REGION,
    TANKS,
    HEALERS
} = config;  // Note: removed .default since we're reading directly

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
 * Checks if a character has been active since Season 2 started
 * @param {Object} character Character data object
 * @returns {boolean} True if character is active in Season 2
 */
function isActiveInSeason2(character) {
    const season2Start = new Date('2025-03-05').getTime();
    const lastModified = new Date(character.metaData.lastUpdated).getTime();
    return lastModified >= season2Start;
}

/**
 * Checks raid lockout status for a character
 * @param {Object} raidData Character's raid data
 * @returns {Object} Lockout status for each difficulty
 */
function checkRaidLockouts(raidData) {
    const CURRENT_RAID = "Liberation of Undermine";
    const lockouts = {
        isLocked: false,
        lockedTo: {}
    };

    // Get the most recent Wednesday (raid reset day)
    const today = new Date();
    const lastWednesday = new Date();
    lastWednesday.setDate(today.getDate() - ((today.getDay() + 4) % 7));
    lastWednesday.setHours(0, 0, 0, 0);

    if (!raidData?.instances) {
        console.log("No instances found in raidData");
        return lockouts;
    }

    const currentRaid = raidData.instances.find(instance => 
        instance.instance?.name === CURRENT_RAID
    );

    if (!currentRaid) {
        console.log("Current raid not found", raidData.instances.map(i => i.instance?.name));
        return lockouts;
    }

    // Process each difficulty mode
    currentRaid.modes.forEach(mode => {
        const difficulty = mode.difficulty.name;
        const progress = mode.progress;

        if (!progress || !progress.encounters) {
            return;
        }

        // Check if any encounters were killed after last Wednesday
        const recentKills = progress.encounters.filter(encounter => {
            const killTime = new Date(encounter.last_kill_timestamp).getTime();
            return killTime >= lastWednesday.getTime();
        });

        if (recentKills.length > 0) {
            lockouts.isLocked = true;
            lockouts.lockedTo[difficulty] = {
                completed: progress.completed_count,
                total: progress.total_count,
                lastKill: Math.max(...recentKills.map(e => e.last_kill_timestamp)),
                encounters: recentKills.map(e => e.encounter.name)
            };
        }
    });

    console.log("Final lockout status:", JSON.stringify(lockouts, null, 2));
    return lockouts;
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
        
        const clientId = API_BATTLENET_KEY;
        const clientSecret = API_BATTLENET_SECRET;
        const BnetApi = new BlizzAPI({ region: REGION, clientId, clientSecret });
        const token = await BnetApi.getAccessToken();
        
        emitProgress(io, processId, 'auth', {
            message: 'Authentication successful!',
            success: true
        });

        // Guild fetch
        emitProgress(io, processId, 'guild-fetch', {
            message: 'Fetching guild roster...'
        });
        
        const guild = await BnetApi.query(`${GUILD_URL}&access_token=${token}`);
        const trimmedList = guild.members.filter(member => member.character.level >= LEVEL_REQUIREMENT);
        
        emitProgress(io, processId, 'guild-fetch', {
            message: `Found ${trimmedList.length} eligible guild members`,
            success: true,
            memberCount: trimmedList.length
        });

        // Process members
        emitProgress(io, processId, 'member-processing', {
            message: 'Processing guild members...',
            total: trimmedList.length,
            current: 0
        });

        let index = 0;
        
        const handleMember = async (member) => {
            const {
                characterName,
                server,
                profileUrl,
                equipmentUrl,
                raidProgressUrl,
                mythicProgressUrl,
                pvpProgressUrl,
                bracketProgressUrl
            } = getCharacterInformation(member, token);

            emitProgress(io, processId, 'member-processing', {
                message: `Processing ${characterName}-${server}`,
                total: trimmedList.length,
                current: index + 1,
                character: `${characterName}-${server}`
            });

            try {
                const memberResponse = await BnetApi.query(profileUrl);
                
                if (memberResponse && memberResponse.equipped_item_level >= ITEM_LEVEL_REQUIREMENT) {
                    const dataToAppend = {
                        name: characterName,
                        server: server,
                        itemlevel: {
                            equiped: memberResponse.equipped_item_level,
                            average: memberResponse.average_item_level
                        },
                        metaData: {
                            class: memberResponse?.character_class?.name,
                            spec: memberResponse?.active_spec?.name,
                            lastUpdated: memberResponse?.lastModified
                        },
                        guildData: {
                            rank: member.rank
                        }
                    };

                    // Fetch equipment data
                    const equipResponse = await BnetApi.query(equipmentUrl);
                    const armory = equipResponse.equipped_items.map(item => ({
                        type: item.slot.type,
                        name: item.name,
                        needsEnchant: needsEnchant(ENCHANTABLE_PIECES, item),
                        hasEnchant: hasEnchant(item),
                        isTierItem: isTierItem(item),
                        level: item.level.value,
                        _raw: item
                    }));
                    dataToAppend.equipement = armory;

                    if (dataTypes.includes('raid')) {
                        const raidResponse = await BnetApi.query(raidProgressUrl);
                        dataToAppend.raidHistory = raidResponse.expansions.find(item => 
                            item.expansion.name === 'Current Season'
                        ) || {};
                    }

                    if (dataTypes.includes('mplus')) {
                        const mplusResponse = await BnetApi.query(mythicProgressUrl);
                        dataToAppend.mplus = mplusResponse;
                    }

                    if (dataTypes.includes('pvp')) {
                        try {
                            const pvpSummaryResponse = await BnetApi.query(pvpProgressUrl);
                            dataToAppend.pvp = {
                                summary: pvpSummaryResponse
                            };
                            
                            let highestRating = 0;
                            
                            // Get data for each PvP bracket
                            if (pvpSummaryResponse?.brackets?.length) {
                                for (const bracket of pvpSummaryResponse.brackets) {
                                    if (bracket?.href) {
                                        const bracketKey = bracket.href.split('pvp-bracket/')[1]?.split('?')[0];
                                        if (bracketKey) {
                                            try {
                                                const bracketResponse = await BnetApi.query(bracketProgressUrl(bracketKey));
                                                if (bracketResponse) {
                                                    dataToAppend.pvp[bracketKey] = bracketResponse;
                                                    // Track highest rating across all brackets
                                                    if (bracketResponse.rating > highestRating) {
                                                        highestRating = bracketResponse.rating;
                                                    }
                                                }
                                            } catch (err) {
                                                console.error(`Error fetching PvP bracket data for ${bracketKey}: ${err.message}`);
                                            }
                                        }
                                    }
                                }
                            }
                            
                            // Add highest rating to pvp object
                            dataToAppend.pvp.rating = highestRating;
                            
                        } catch (err) {
                            console.error(`Error fetching PvP summary data: ${err.message}`);
                            dataToAppend.pvp = { rating: 0 };
                        }
                    }

            // Check Season 2 activity
                    const isActive = isActiveInSeason2(dataToAppend);
            
            // Reset inactive character stats
            if (!isActive) {
                        if (dataToAppend.mplus) {
                            dataToAppend.mplus.current_mythic_rating = { rating: 0 };
                }
                        if (dataToAppend.pvp) {
                            dataToAppend.pvp.rating = 0;
                            dataToAppend.pvp.summary = { honor_level: 0 };
                }
            }

            // Process gear status
            let hasValidGear = true;
            let missingEnchantCount = 0;
            let hasTierSet = false;
            
                    dataToAppend.equipement?.forEach(item => {
                if (item.needsEnchant && !item.hasEnchant) {
                    hasValidGear = false;
                    missingEnchantCount++;
                }
                if (item.isTierItem) {
                    hasTierSet = true;
                }
            });

            // Check raid lockouts
            const lockStatus = dataTypes.includes('raid') ? 
                        checkRaidLockouts(dataToAppend.raidHistory) : 
                null;

            const character = { 
                        ...dataToAppend, 
                ready: hasValidGear, 
                missingEnchants: missingEnchantCount,
                hasTierSet,
                lockStatus,
                isActiveInSeason2: isActive,
                processedStats: {
                            mythicPlusScore: dataToAppend.mplus?.current_mythic_rating?.rating || 0,
                            pvpRating: dataToAppend.pvp?.rating || 0,
                            itemLevel: dataToAppend.itemlevel.equiped,
                            role: TANKS.includes(dataToAppend.metaData.spec) ? 'TANK' : 
                                  HEALERS.includes(dataToAppend.metaData.spec) ? 'HEALER' : 'DPS',
                            spec: dataToAppend.metaData.spec,
                            class: dataToAppend.metaData.class
                }
            };
            
            const { mediaUrl } = getCharacterInformation(character, token);
            
            try {
                const mediaResponse = await BnetApi.query(mediaUrl);
                character.media = mediaResponse;
            } catch {
                character.media = false;
            }
            
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
                        console.error(`❌ Database error for ${characterName}-${server}:`, dbError.message);
                        // Continue processing other characters even if this one fails
                    }
                }
            } catch (error) {
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

        // Remove inactive members (those not updated in this sync)
        emitProgress(io, processId, 'cleanup', {
            message: 'Removing inactive members...'
        });
        
        try {
            const removalResult = await removeInactiveMembers(updatedMemberNames);
            
            emitProgress(io, processId, 'cleanup', {
                message: `Removed ${removalResult.modifiedCount} inactive members`,
                success: true,
                removedCount: removalResult.modifiedCount
            });
        } catch (error) {
            emitProgress(io, processId, 'error', {
                message: 'Error removing inactive members',
                error: error.message
            });
        }

        // Generate final statistics
        emitProgress(io, processId, 'statistics', {
            message: 'Generating final statistics...'
        });

        const finalPayload = {
            data: updatedMemberNames, // Just the names for legacy compatibility
            statistics: {
                totalMembers: updatedMemberNames.length,
                updatedMembers: updatedMemberNames.length,
                dataTypes
            },
            timestamp: Date.now(),
            dataTypes
        };

        // Save legacy format for backward compatibility
        emitProgress(io, processId, 'saving', {
            message: 'Saving legacy data format...'
        });
        
        try {
            await saveGuildData(finalPayload);
            
            emitProgress(io, processId, 'complete', {
                message: 'Guild data update completed successfully!',
                success: true,
                statistics: {
                    totalMembers: updatedMemberNames.length,
                    updatedMembers: updatedMemberNames.length,
                    dataTypes
                }
            });
            
        } catch (err) {
            emitProgress(io, processId, 'error', {
                message: 'Error saving legacy data format!',
                error: err.message
            });
            throw err;
        }
        
    } catch (error) {
        emitProgress(io, processId, 'error', {
            message: 'Guild update process failed',
            error: error.message
        });
        throw error;
    }
};

export default startGuildUpdate;