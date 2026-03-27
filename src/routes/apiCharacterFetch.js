/**
 * @file Route handler for /api/fetch/{realm}/{character} endpoint.
 * @module routes/apiCharacterFetch
 */

import express from 'express';
import { BlizzAPI } from "blizzapi";
import { 
  getCharacterInformation,
  needsEnchant,
  hasEnchant,
  isTierItem
} from '../../tools/guildFetcher/utils.mjs';
import { logError } from '../database.js';
import { getConfig } from '../config.js';

/**
 * GET /api/fetch/:realm/:character - Fetches fresh data for a specific character from WoW API.
 * @route GET /api/fetch/:realm/:character
 * @param {string} realm - The realm name
 * @param {string} character - The character name
 * @returns {Object} JSON response with fresh character data.
 */
const router = express.Router();

/**
 * Checks if a character has been active since Season 2 started
 * @param {Object} character Character data object
 * @param {string} seasonStartDate Season start date from config
 * @returns {boolean} True if character is active in Season 2
 */
function isActiveInSeason2(character, seasonStartDate) {
  const season2Start = new Date(seasonStartDate).getTime();
  const lastModified = new Date(character.metaData.lastUpdated).getTime();
  return lastModified >= season2Start;
}

/**
 * Checks raid lockout status for a character across all instances in the current expansion.
 * Determines lockouts based on kills since the last Wednesday reset.
 * @param {Object} raidData Character's raid expansion data (Midnight expansion object)
 * @returns {Object} Lockout status per instance and aggregated per difficulty
 */
function checkRaidLockouts(raidData) {
  const lockouts = {
    isLocked: false,
    // Per-difficulty aggregate (for backward compat filtering: Normal/Heroic/Mythic tabs)
    lockedTo: {},
    // Per-instance breakdown: { 'The Voidspire': { id, difficulties: { Normal: {...}, Heroic: {...} } } }
    raids: {}
  };

  // Get the most recent Wednesday at midnight (raid reset day)
  const today = new Date();
  const lastWednesday = new Date();
  lastWednesday.setDate(today.getDate() - ((today.getDay() + 4) % 7));
  lastWednesday.setHours(0, 0, 0, 0);

  if (!raidData?.instances) {
    return lockouts;
  }

  raidData.instances.forEach(instanceData => {
    const instanceName = instanceData.instance?.name;
    if (!instanceName || !instanceData.modes) return;

    const instanceResult = { id: instanceData.instance?.id, difficulties: {} };

    instanceData.modes.forEach(mode => {
      const difficulty = mode.difficulty.name;
      const progress = mode.progress;

      if (!progress?.encounters) return;

      // Only count kills that occurred after the last Wednesday reset
      const recentKills = progress.encounters.filter(encounter =>
        encounter.last_kill_timestamp >= lastWednesday.getTime()
      );

      if (recentKills.length === 0) return;

      lockouts.isLocked = true;

      const difficultyEntry = {
        completed: progress.completed_count,
        total: progress.total_count,
        lastKill: Math.max(...recentKills.map(e => e.last_kill_timestamp)),
        encounters: recentKills.map(e => e.encounter.name)
      };

      instanceResult.difficulties[difficulty] = difficultyEntry;

      // Aggregate into lockedTo for backward-compatible difficulty filtering
      if (!lockouts.lockedTo[difficulty]) {
        lockouts.lockedTo[difficulty] = {
          completed: 0,
          total: 0,
          lastKill: 0,
          encounters: []
        };
      }
      lockouts.lockedTo[difficulty].completed += difficultyEntry.completed;
      lockouts.lockedTo[difficulty].total += difficultyEntry.total;
      lockouts.lockedTo[difficulty].lastKill = Math.max(
        lockouts.lockedTo[difficulty].lastKill,
        difficultyEntry.lastKill
      );
      lockouts.lockedTo[difficulty].encounters.push(...difficultyEntry.encounters);
    });

    if (Object.keys(instanceResult.difficulties).length > 0) {
      lockouts.raids[instanceName] = instanceResult;
    }
  });

  return lockouts;
}

router.get('/:realm/:character', async (req, res) => {
  try {
    // Load config from database
    const config = await getConfig();
    const {
      LEVEL_REQUIREMENT,
      ITEM_LEVEL_REQUIREMENT,
      API_BATTLENET_KEY,
      API_BATTLENET_SECRET,
      REGION,
      TANKS = [],
      HEALERS = [],
      ENCHANTABLE_PIECES = [],
      SEASON_START_DATE,
      CURRENT_EXPANSION = 'Midnight',
      CURRENT_MPLUS_SEASON
    } = config || {};

    const { realm, character } = req.params;
    const { dataTypes = 'raid,mplus,pvp' } = req.query;
    
    // Parse data types
    const requestedDataTypes = dataTypes.split(',').map(type => type.trim());
    
    console.log(`🔍 Fetching fresh data for ${character}-${realm}`);
    
    // Authenticate with Battle.net API
    const clientId = API_BATTLENET_KEY;
    const clientSecret = API_BATTLENET_SECRET;
    const BnetApi = new BlizzAPI({ region: REGION, clientId, clientSecret });
    const token = await BnetApi.getAccessToken();
    
    // Create a mock member object for the utils function
    const mockMember = {
      name: character.toLowerCase(),
      character: {
        name: character.toLowerCase(),
        realm: {
          slug: realm.toLowerCase()
        }
      }
    };
    
    const {
      characterName,
      server,
      profileUrl,
      equipmentUrl,
      raidProgressUrl,
      mythicProgressUrl,
      mythicSeasonUrl,
      pvpProgressUrl,
      bracketProgressUrl,
      mediaUrl,
      transmogsUrl
    } = getCharacterInformation(mockMember, token);

    // Fetch character profile
    const memberResponse = await BnetApi.query(profileUrl);

    console.log("Member response:", memberResponse);
    
    if (!memberResponse) {
      return res.status(200).json({
        success: false,
        error: 'Character not found',
        message: `Character ${character}-${realm} not found`
      });
    }

    if (memberResponse.level < LEVEL_REQUIREMENT) {
      return res.status(200).json({
        success: false,
        error: 'Character level too low',
        message: `Character must be at least level ${LEVEL_REQUIREMENT}`
      });
    }

    if (memberResponse.equipped_item_level < ITEM_LEVEL_REQUIREMENT) {
      return res.status(200).json({
        success: false,
        error: 'Character item level too low',
        message: `Character must have at least ${ITEM_LEVEL_REQUIREMENT} item level`
      });
    }

    // Build base character data
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
        rank: 0 // Default rank for non-guild characters
      }
    };

    // Fetch equipment data
    const equipResponse = await BnetApi.query(equipmentUrl);
    console.log("Equipment response:", equipResponse);
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

    // Fetch raid data if requested
    if (requestedDataTypes.includes('raid')) {
      try {
        const raidResponse = await BnetApi.query(raidProgressUrl);
        dataToAppend.raidHistory = raidResponse?.expansions?.find(item => 
          item.expansion.name === CURRENT_EXPANSION
        ) || {};
      } catch (error) {
        console.error('Error fetching raid data:', error.message);
        dataToAppend.raidHistory = {};
      }
    }

    // Fetch mythic+ data if requested
    if (requestedDataTypes.includes('mplus')) {
      try {
        const mplusResponse = await BnetApi.query(mythicProgressUrl);
        dataToAppend.mplus = mplusResponse;
        
        // Check if character has seasons data and fetch current season
        if (mplusResponse?.seasons && Array.isArray(mplusResponse.seasons)) {
          const currentSeason = mplusResponse.seasons.find(season => season.id === CURRENT_MPLUS_SEASON);
          
          if (currentSeason) {
            try {
              const currentSeasonUrl = mythicSeasonUrl(CURRENT_MPLUS_SEASON);
              const currentSeasonData = await BnetApi.query(currentSeasonUrl);
              dataToAppend.currentSeason = currentSeasonData;
            } catch (error) {
              console.error('Error fetching current season data:', error.message);
              dataToAppend.currentSeason = { current_mythic_rating: { rating: 0 } };
            }
          } else {
            console.log(`Character ${characterName}-${server} does not have season ${CURRENT_MPLUS_SEASON} data`);
            dataToAppend.currentSeason = { current_mythic_rating: { rating: 0 } };
          }
        } else {
          console.log(`Character ${characterName}-${server} has no seasons data`);
          dataToAppend.currentSeason = { current_mythic_rating: { rating: 0 } };
        }
      } catch (error) {
        console.error('Error fetching mythic+ data:', error.message);
        dataToAppend.mplus = { current_mythic_rating: { rating: 0 } };
        dataToAppend.currentSeason = { current_mythic_rating: { rating: 0 } };
      }
    }

    // Fetch PvP data if requested
    if (requestedDataTypes.includes('pvp')) {
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
        
      } catch (error) {
        console.error('Error fetching PvP data:', error.message);
        dataToAppend.pvp = { rating: 0 };
      }
    }

    // Fetch character media
    try {
      const mediaResponse = await BnetApi.query(mediaUrl);
      dataToAppend.media = mediaResponse;
    } catch (error) {
      console.error('Error fetching character media:', error.message);
      dataToAppend.media = false;
    }


    // Check Season 2 activity
    const isActive = isActiveInSeason2(dataToAppend, SEASON_START_DATE);
    
    // Reset inactive character stats
    if (!isActive) {
      if (dataToAppend.mplus) {
        dataToAppend.mplus.current_mythic_rating = { rating: 0 };
      }
      if (dataToAppend.currentSeason) {
        dataToAppend.currentSeason.current_mythic_rating = { rating: 0 };
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

    // Check raid lockouts across all Midnight instances
    const lockStatus = requestedDataTypes.includes('raid') ? 
      checkRaidLockouts(dataToAppend.raidHistory) : 
      null;

    const characterData = { 
      ...dataToAppend, 
      ready: hasValidGear, 
      missingEnchants: missingEnchantCount,
      hasTierSet,
      lockStatus,
      isActiveInSeason2: isActive,
      processedStats: {
        mythicPlusScore: dataToAppend.currentSeason?.current_mythic_rating?.rating || dataToAppend.mplus?.current_mythic_rating?.rating || 0,
        pvpRating: dataToAppend.pvp?.rating || 0,
        itemLevel: dataToAppend.itemlevel.equiped,
        role: TANKS.includes(dataToAppend.metaData.spec) ? 'TANK' : 
              HEALERS.includes(dataToAppend.metaData.spec) ? 'HEALER' : 'DPS',
        spec: dataToAppend.metaData.spec,
        class: dataToAppend.metaData.class
      }
    };

    res.json({
      success: true,
      character: characterData,
      timestamp: new Date().toISOString(),
      dataTypes: requestedDataTypes
    });

  } catch (error) {
    const { realm, character } = req.params;
    
    // Check if it's a 404 from Battle.net API (character not found)
    if (error.response?.status === 404 || error.status === 404 || (error.message && error.message.includes('404'))) {
      console.log(`⚠️ Character ${character}-${realm} not found on Battle.net`);
      return res.status(200).json({
        success: false,
        error: 'Character not found',
        message: `Character ${character}-${realm} not found on Battle.net`
      });
    }

    await logError({
      type: 'api',
      endpoint: `/api/fetch/${realm}/${character}`,
      error: error,
      context: {
        method: req.method,
        url: req.url,
        query: req.query,
        params: req.params,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
    
    console.error('❌ Error fetching character data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch character data',
      message: error.message
    });
  }
});

/**
 * GET /api/fetch/:realm/:character/transmog - Fetches transmog data for a specific character from WoW API.
 * @route GET /api/fetch/:realm/:character/transmog
 * @param {string} realm - The realm name
 * @param {string} character - The character name
 * @returns {Object} JSON response with character transmog data.
 */
router.get('/:realm/:character/transmog', async (req, res) => {
  try {
    const { realm, character } = req.params;
    
    console.log(`🔍 Fetching transmog data for ${character}-${realm}`);
    
    // Authenticate with Battle.net API
    const clientId = API_BATTLENET_KEY;
    const clientSecret = API_BATTLENET_SECRET;
    const BnetApi = new BlizzAPI({ region: REGION, clientId, clientSecret });
    const token = await BnetApi.getAccessToken();
    
    // Create a mock member object for the utils function
    const mockMember = {
      name: character.toLowerCase(),
      character: {
        name: character.toLowerCase(),
        realm: {
          slug: realm.toLowerCase()
        }
      }
    };
    
    const { transmogsUrl } = getCharacterInformation(mockMember, token);

    // Fetch character transmogs
    const transmogsResponse = await BnetApi.query(transmogsUrl);
    console.log("Transmogs response:", transmogsResponse);

    res.json({
      success: true,
      character: {
        name: character.toLowerCase(),
        server: realm.toLowerCase()
      },
      transmogs: transmogsResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const { realm, character } = req.params;
    
    // Check if it's a 404 from Battle.net API (character not found)
    if (error.response?.status === 404 || error.status === 404 || (error.message && error.message.includes('404'))) {
      console.log(`⚠️ Character ${character}-${realm} transmog not found on Battle.net`);
      return res.status(200).json({
        success: false,
        error: 'Character transmog not found',
        message: `Character ${character}-${realm} transmog not found on Battle.net`
      });
    }

    await logError({
      type: 'api',
      endpoint: `/api/fetch/${realm}/${character}/transmog`,
      error: error,
      context: {
        method: req.method,
        url: req.url,
        query: req.query,
        params: req.params,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
    
    console.error('❌ Error fetching character transmog data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch character transmog data',
      message: error.message
    });
  }
});

export default router;
