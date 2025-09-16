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

import config from '../../app.config.js';

const {
  API_PARAM_REQUIREMENTGS,
  GUILD_NAME,
  GUILD_REALM,
  LEVEL_REQUIREMENT,
  ITEM_LEVEL_REQUIREMENT,
  API_BATTLENET_KEY,
  API_BATTLENET_SECRET,
  REGION,
  TANKS,
  HEALERS,
  ENCHANTABLE_PIECES,
  SEASON_START_DATE,
  CURRENT_RAID
} = config;

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
 * @returns {boolean} True if character is active in Season 2
 */
function isActiveInSeason2(character) {
  const season2Start = new Date(SEASON_START_DATE).getTime();
  const lastModified = new Date(character.metaData.lastUpdated).getTime();
  return lastModified >= season2Start;
}

/**
 * Checks raid lockout status for a character
 * @param {Object} raidData Character's raid data
 * @returns {Object} Lockout status for each difficulty
 */
function checkRaidLockouts(raidData) {
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

  return lockouts;
}

router.get('/:realm/:character', async (req, res) => {
  try {
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
      pvpProgressUrl,
      bracketProgressUrl,
      mediaUrl,
      transmogsUrl
    } = getCharacterInformation(mockMember, token);

    // Fetch character profile
    const memberResponse = await BnetApi.query(profileUrl);

    console.log("Member response:", memberResponse);
    
    if (!memberResponse) {
      return res.status(404).json({
        success: false,
        error: 'Character not found',
        message: `Character ${character}-${realm} not found`
      });
    }

    if (memberResponse.level < LEVEL_REQUIREMENT) {
      return res.status(400).json({
        success: false,
        error: 'Character level too low',
        message: `Character must be at least level ${LEVEL_REQUIREMENT}`
      });
    }

    if (memberResponse.equipped_item_level < ITEM_LEVEL_REQUIREMENT) {
      return res.status(400).json({
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
        dataToAppend.raidHistory = raidResponse.expansions.find(item => 
          item.expansion.name === 'Current Season'
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
      } catch (error) {
        console.error('Error fetching mythic+ data:', error.message);
        dataToAppend.mplus = { current_mythic_rating: { rating: 0 } };
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
        mythicPlusScore: dataToAppend.mplus?.current_mythic_rating?.rating || 0,
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
