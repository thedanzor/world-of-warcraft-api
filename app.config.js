import dotenv from 'dotenv';
dotenv.config();

const data = {
    // The following values are loaded from environment variables for your safety
    "API_BATTLENET_KEY": process.env.API_BATTLENET_KEY,
    "API_BATTLENET_SECRET": process.env.API_BATTLENET_SECRET,
    "GUILD_NAME": process.env.GUILD_NAME,
    "GUILD_REALM": process.env.GUILD_REALM,
    "REGION": process.env.REGION,
    "API_PARAM_REQUIREMENTGS": process.env.API_PARAM_REQUIREMENTGS,

    // Change the below settings that are specific to your guild and needs
    "LEVEL_REQUIREMENT": 80,
    "GUILD_RANK_REQUIREMENT": [0,1,2,3,4,5,6, 7,8,9,10],
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
    "_DRAFT_DIFFICULTY": ["LFR", "Raid Finder", "Mythic", "Heroic", "Normal"],
    "SEASON_START_DATE": "2025-08-01",
    "CURRENT_RAID": "Manaforge Omega",
    "GUILLD_RANKS": [
        "Guild Lead",
        "Officer",
        "Officer Alt",
        "Cunt",
        "Muppet",
        "Raider",
        "Trial Raider",
        "Member",
        "Alt",
        "New Recruit"
    ],
    "CURRENT_SEASON_TIER_SETS": [
        "Hollow Sentinel's Wake ",
        "Charhound's Vicious Hunt",
        "Ornaments of the Mother Eagle",
        "Spellweaver's Immaculate Design",
        "Midnight Herald's Pledge",
        "Augur's Ephemeral Plumage ",
        "Crash of Fallen Storms",
        "Vows of the Lucent Battalion",
        "Eulogy to a Dying Star ",
        "Shroud of the Sudden Eclipse",
        "Howls of Channeled Fury ",
        "Inquisitor's Feast of Madness",
        "Chains of the Living Weapon"
    ]
}

export default data;