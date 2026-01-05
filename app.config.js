import dotenv from 'dotenv';
dotenv.config();

/**
 * MINIMAL FALLBACK CONFIGURATION
 * 
 * This file provides only basic fallback values if the database is unavailable.
 * The frontend app.config.js contains the rich default configuration that gets
 * sent to the backend during the installation process and saved to the database.
 * 
 * The database (AppSettings collection) is the primary source of configuration.
 * This file is only used as an emergency fallback.
 */

const data = {
    // Environment variables (legacy .env file support)
    "API_BATTLENET_KEY": process.env.API_BATTLENET_KEY || null,
    "API_BATTLENET_SECRET": process.env.API_BATTLENET_SECRET || null,
    "GUILD_NAME": process.env.GUILD_NAME || null,
    "GUILD_REALM": process.env.GUILD_REALM || null,
    "REGION": process.env.REGION || "eu",
    "API_PARAM_REQUIREMENTGS": process.env.API_PARAM_REQUIREMENTGS || "namespace=profile-eu&locale=en_US",

    // Minimal fallback values (real values come from database after installation)
    "LEVEL_REQUIREMENT": 80,
    "GUILD_RANK_REQUIREMENT": [0,1,2,3,4,5,6,7,8,9,10],
    "ITEM_LEVEL_REQUIREMENT": 440,
    "MIN_CHECK_CAP": 640,
    "MAX_CHECK_CAP": 720,
    "MIN_TIER_ITEMLEVEL": 640,
    "ENCHANTABLE_PIECES": ["WRIST", "LEGS", "FEET", "CHEST", "MAIN_HAND", "FINGER_1", "FINGER_2"],
    "MAIN_RANKS": [0,1,2,3,4,5,6,7],
    "ALT_RANKS": [8,9,10],
    "TANKS": ["Blood", "Vengeance", "Guardian", "Brewmaster", "Protection"],
    "HEALERS": ["Preservation", "Mistweaver", "Holy", "Discipline", "Restoration"],
    "DIFFICULTY": ["Mythic", "Heroic", "Normal"],
    "SEASON_START_DATE": "2025-08-01",
    "CURRENT_RAID": "Unknown Raid",
    "CURRENT_MPLUS_SEASON": 15,
    "GUILLD_RANKS": [],
    "CURRENT_SEASON_TIER_SETS": []
}

export default data;