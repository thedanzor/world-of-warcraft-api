import config from '../app.config.js';

const { TANKS, HEALERS, GUILLD_RANKS, MAIN_RANKS, ALT_RANKS, MIN_TIER_ITEMLEVEL } = config;
const CURRENT_SEASON_TIER_SETS = config.CURRENT_SEASON_TIER_SETS;

/**
 * Transforms a character object into a standardized format for the API.
 * @param {Object} character - The raw character data.
 * @returns {Object} The transformed character data.
 */
function transformCharacterData(character) {
  const missingEnchants = character.equipement
    ?.filter(item => item.needsEnchant && !item.hasEnchant)
    ?.map(item => item.type) || [];

  let oldSet = 0;
  let newSet = 0;
  character.equipement?.forEach((item) => {
    if (item.isTierItem && item.level >= MIN_TIER_ITEMLEVEL) {
      const setName = item._raw?.set?.item_set?.name || "";
      const isCurrentSeason = CURRENT_SEASON_TIER_SETS.some(tierSetName => setName.includes(tierSetName));
      if (isCurrentSeason) {
        newSet = newSet + 1;
      } else {
        oldSet = oldSet + 1;
      }
    }
  });

  const hasQualifyingWaist = character.equipement?.some(
    (item) =>
      item.type === 'WAIST' &&
      item.name?.toLowerCase() === "durable information securing container"
  ) || false;

  const hasQualifyingCloak = character.equipement?.some(
    (item) =>
      (item.type === 'CLOAK' || item.type === 'BACK') &&
      item.name?.toLowerCase() === "reshii wraps"
  ) || false;

  const isTank = TANKS.includes(character.metaData?.spec);
  const isHealer = HEALERS.includes(character.metaData?.spec);
  const role = isTank ? 'tank' : isHealer ? 'healer' : 'dps';

  const guildRankIndex = character.guildData?.rank;
  const guildRank = guildRankIndex;

  return {
    name: character.name,
    server: character.server,
    class: character.metaData?.class,
    spec: character.metaData?.spec,
    itemLevel: character.itemlevel?.equiped,
    guildRank: guildRank,
    ready: character.ready,
    missingEnchants,
    missingWaist: !hasQualifyingWaist,
    missingCloak: !hasQualifyingCloak,
    tierSets: {
      season1: oldSet,
      season2: newSet,
      total: oldSet + newSet
    },
    mplus: character.mplus?.current_mythic_rating?.rating || 0,
    raw_mplus: character.mplus,
    pvp: character.pvp?.rating || 0,
    raw_pvp: character.pvp,
    hasTierSet: (oldSet + newSet) >= 4,
    isActiveInSeason2: character.isActiveInSeason2,
    lockStatus: character.lockStatus,
    media: character.media,
    metaData: {
      ...character.metaData,
      role
    },
    stats: character.stats || null
  };
}

/**
 * Applies filters to a list of character data.
 * @param {Array} data - The array of character objects.
 * @param {Object} filters - The filters to apply.
 * @returns {Array} The filtered character data.
 */
function applyFilters(data, filters) {
  const {
    search = '',
    rankFilter = 'all',
    classFilter = '',
    specFilter = 'all',
    minItemLevel = 0,
    filter = 'all'
  } = filters;

  let filteredData = data;

  if (search) {
    filteredData = filteredData.filter(character => 
      character.name.toLowerCase().includes(search.toLowerCase())
    );
  }

  if (rankFilter !== 'all') {
    if (rankFilter === 'mains') {
      filteredData = filteredData.filter(character => 
        MAIN_RANKS.includes(GUILLD_RANKS.indexOf(character.guildRank))
      );
    } else if (rankFilter === 'alts') {
      filteredData = filteredData.filter(character => 
        ALT_RANKS.includes(GUILLD_RANKS.indexOf(character.guildRank))
      );
    }
  }

  if (classFilter) {
    const classes = classFilter.split(',').map(c => c.trim());
    filteredData = filteredData.filter(character => 
      classes.includes(character.metaData?.class)
    );
  }

  if (specFilter !== 'all') {
    if (specFilter === 'tanks') {
      filteredData = filteredData.filter(character => 
        TANKS.includes(character.metaData?.spec)
      );
    } else if (specFilter === 'healers') {
      filteredData = filteredData.filter(character => 
        HEALERS.includes(character.metaData?.spec)
      );
    } else if (specFilter === 'dps') {
      filteredData = filteredData.filter(character => 
        !TANKS.includes(character.metaData?.spec) && !HEALERS.includes(character.metaData?.spec)
      );
    }
  }

  if (minItemLevel > 0) {
    filteredData = filteredData.filter(character => 
      character.itemLevel >= parseInt(minItemLevel)
    );
  }

  switch (filter) {
    case 'missing-enchants':
      filteredData = filteredData.filter(character => 
        character.missingEnchants && character.missingEnchants.length > 0
      );
      break;
    case 'locked-normal':
      filteredData = filteredData.filter(character => 
        character.lockStatus?.lockedTo?.Normal
      );
      break;
    case 'locked-heroic':
      filteredData = filteredData.filter(character => 
        character.lockStatus?.lockedTo?.Heroic
      );
      break;
    case 'locked-mythic':
      filteredData = filteredData.filter(character => 
        character.lockStatus?.lockedTo?.Mythic
      );
      break;
    case 'missing-tier':
      filteredData = filteredData.filter(character => 
        !character.hasTierSet
      );
      break;
    case 'not-ready':
      filteredData = filteredData.filter(character => 
        !character.ready
      );
      break;
    case 'active-season2':
      filteredData = filteredData.filter(character => 
        character.isActiveInSeason2
      );
      break;
    case 'has-pvp-rating':
      filteredData = filteredData.filter(character => 
        character.pvp > 0
      );
      break;
    case 'has-mplus-score':
      filteredData = filteredData.filter(character => 
        character.mplus > 0
      );
      break;
    default:
      break;
  }

  filteredData.sort((a, b) => b.itemLevel - a.itemLevel);

  return filteredData;
}

/**
 * Calculates statistics from character data.
 * @param {Array} data - The array of character objects.
 * @returns {Object} The calculated statistics.
 */
function calculateStatistics(data) {
  const sortedData = [...data].sort((a, b) => b.itemLevel - a.itemLevel);
  const totalMembers = sortedData.length;
  const missingEnchants = sortedData.filter(char => char.missingEnchants.length > 0).length;
  const raidLocked = sortedData.filter(char => char.lockStatus?.isLocked).length;
  const topPvp = sortedData
    .filter(char => char.pvp > 0)
    .sort((a, b) => b.pvp - a.pvp)
    .slice(0, 5);
  const topPve = sortedData
    .filter(char => char.mplus > 0)
    .sort((a, b) => b.mplus - a.mplus)
    .slice(0, 5);
  const tanks = sortedData.filter(char => TANKS.includes(char.spec)).length;
  const healers = sortedData.filter(char => HEALERS.includes(char.spec)).length;
  const dps = sortedData.filter(char => !TANKS.includes(char.spec) && !HEALERS.includes(char.spec)).length;
  return {
    totalMembers,
    missingEnchants,
    raidLocked,
    avgTopMplus: topPve.length > 0 ? topPve.reduce((acc, p) => acc + p.mplus, 0) / topPve.length : 0,
    avgTopPvp: topPvp.length > 0 ? topPvp.reduce((acc, p) => acc + p.pvp, 0) / topPvp.length : 0,
    roleCounts: { tanks, healers, dps },
    topPvp,
    topPve
  };
}

/**
 * Gets the next scheduled update time as an ISO string.
 * @returns {string} The ISO string of the next scheduled update.
 */
function getNextScheduledUpdate() {
  const now = new Date();
  const nextUpdate = new Date(now.getTime() + (30 * 60 * 1000)); // 30 minutes from now
  return nextUpdate.toISOString();
}

export { transformCharacterData, applyFilters, calculateStatistics, getNextScheduledUpdate }; 