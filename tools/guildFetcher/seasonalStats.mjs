/**
 * @file Seasonal statistics processing for Mythic+ data
 * @module tools/guildFetcher/seasonalStats
 */

// Import the config as a module instead of parsing as JSON
const config = await import('../../app.config.js');

const { CURRENT_MPLUS_SEASON } = config.default;

/**
 * Process seasonal statistics for a single character
 * @param {Object} character - Character data with currentSeason
 * @returns {Object} Processed seasonal statistics
 */
export function processCharacterSeasonalStats(character) {
  const currentSeason = character.currentSeason;
  
  if (!currentSeason || !currentSeason.best_runs || !Array.isArray(currentSeason.best_runs)) {
    return {
      highestTimedKey: 0,
      highestKeyOverall: 0,
      totalRuns: 0,
      completedRuns: 0,
      averageRating: 0,
      topPlayedMembers: [],
      dungeonStats: {},
      affixStats: {},
      roleStats: {},
      totalPlaytime: 0
    };
  }

  const bestRuns = currentSeason.best_runs;
  let highestTimedKey = 0;
  let highestKeyOverall = 0;
  let totalRuns = bestRuns.length;
  let completedRuns = 0;
  let totalRating = 0;
  let totalPlaytime = 0;
  
  const dungeonStats = {};
  const affixStats = {};
  const roleStats = {};
  const memberPlayCounts = {};

  bestRuns.forEach(run => {
    const keyLevel = run.keystone_level;
    const isTimed = run.is_completed_within_time;
    const rating = run.mythic_rating?.rating || 0;
    const duration = run.duration || 0;
    const dungeon = run.dungeon?.name || 'Unknown';
    const affixes = run.keystone_affixes || [];
    const members = run.members || [];

    // Track highest keys
    if (keyLevel > highestKeyOverall) {
      highestKeyOverall = keyLevel;
    }
    if (isTimed && keyLevel > highestTimedKey) {
      highestTimedKey = keyLevel;
    }

    // Count completed runs
    if (isTimed) {
      completedRuns++;
    }

    // Accumulate rating and playtime
    totalRating += rating;
    totalPlaytime += duration;

    // Track dungeon statistics
    if (!dungeonStats[dungeon]) {
      dungeonStats[dungeon] = {
        totalRuns: 0,
        timedRuns: 0,
        highestKey: 0,
        averageRating: 0,
        totalRating: 0
      };
    }
    dungeonStats[dungeon].totalRuns++;
    dungeonStats[dungeon].totalRating += rating;
    if (isTimed) {
      dungeonStats[dungeon].timedRuns++;
    }
    if (keyLevel > dungeonStats[dungeon].highestKey) {
      dungeonStats[dungeon].highestKey = keyLevel;
    }

    // Track affix statistics
    affixes.forEach(affix => {
      const affixName = affix.name || 'Unknown';
      if (!affixStats[affixName]) {
        affixStats[affixName] = {
          totalRuns: 0,
          timedRuns: 0,
          averageRating: 0,
          totalRating: 0
        };
      }
      affixStats[affixName].totalRuns++;
      affixStats[affixName].totalRating += rating;
      if (isTimed) {
        affixStats[affixName].timedRuns++;
      }
    });

    // Track role statistics
    members.forEach(member => {
      const spec = member.specialization?.name || 'Unknown';
      const memberName = member.character?.name || 'Unknown';
      const memberServer = member.character?.realm?.slug || 'Unknown';
      const memberKey = `${memberName}-${memberServer}`;
      
      // Track member play counts
      if (!memberPlayCounts[memberKey]) {
        memberPlayCounts[memberKey] = {
          name: memberName,
          server: memberServer,
          spec: spec,
          count: 0
        };
      }
      memberPlayCounts[memberKey].count++;

      // Track role statistics
      if (!roleStats[spec]) {
        roleStats[spec] = {
          totalRuns: 0,
          timedRuns: 0,
          averageRating: 0,
          totalRating: 0
        };
      }
      roleStats[spec].totalRuns++;
      roleStats[spec].totalRating += rating;
      if (isTimed) {
        roleStats[spec].timedRuns++;
      }
    });
  });

  // Calculate averages
  const averageRating = totalRuns > 0 ? totalRating / totalRuns : 0;

  // Calculate dungeon averages
  Object.keys(dungeonStats).forEach(dungeon => {
    const stats = dungeonStats[dungeon];
    stats.averageRating = stats.totalRuns > 0 ? stats.totalRating / stats.totalRuns : 0;
  });

  // Calculate affix averages
  Object.keys(affixStats).forEach(affix => {
    const stats = affixStats[affix];
    stats.averageRating = stats.totalRuns > 0 ? stats.totalRating / stats.totalRuns : 0;
  });

  // Calculate role averages
  Object.keys(roleStats).forEach(role => {
    const stats = roleStats[role];
    stats.averageRating = stats.totalRuns > 0 ? stats.totalRating / stats.totalRuns : 0;
  });

  // Sort top played members
  const topPlayedMembers = Object.values(memberPlayCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    highestTimedKey,
    highestKeyOverall,
    totalRuns,
    completedRuns,
    averageRating,
    topPlayedMembers,
    dungeonStats,
    affixStats,
    roleStats,
    totalPlaytime,
    completionRate: totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 0
  };
}

/**
 * Process guild-wide seasonal statistics
 * @param {Array} characters - Array of character data with seasonal stats
 * @returns {Object} Guild-wide seasonal statistics
 */
export function processGuildSeasonalStats(characters) {
  const guildStats = {
    totalCharacters: 0,
    charactersWithMplus: 0,
    totalRuns: 0,
    totalTimedRuns: 0,
    averageRating: 0,
    highestKeyOverall: 0,
    highestTimedKey: 0,
    topPlayers: [],
    dungeonLeaderboard: {},
    affixStats: {},
    roleStats: {},
    memberNetworks: {},
    season: CURRENT_MPLUS_SEASON,
    lastUpdated: new Date()
  };

  const characterStats = [];
  const dungeonRuns = {};
  const affixRuns = {};
  const roleRuns = {};
  const memberNetworks = {};

  characters.forEach(character => {
    guildStats.totalCharacters++;
    
    const seasonalStats = processCharacterSeasonalStats(character);
    
    if (seasonalStats.totalRuns > 0) {
      guildStats.charactersWithMplus++;
      guildStats.totalRuns += seasonalStats.totalRuns;
      guildStats.totalTimedRuns += seasonalStats.completedRuns;
      
      if (seasonalStats.highestKeyOverall > guildStats.highestKeyOverall) {
        guildStats.highestKeyOverall = seasonalStats.highestKeyOverall;
      }
      
      if (seasonalStats.highestTimedKey > guildStats.highestTimedKey) {
        guildStats.highestTimedKey = seasonalStats.highestTimedKey;
      }

      // Track character stats for top players
      characterStats.push({
        name: character.name,
        server: character.server,
        spec: character.metaData?.spec || 'Unknown',
        class: character.metaData?.class || 'Unknown',
        rating: character.processedStats?.mythicPlusScore || character.raw_mplus?.current_mythic_rating?.rating || 0,
        highestTimedKey: seasonalStats.highestTimedKey,
        highestKeyOverall: seasonalStats.highestKeyOverall,
        totalRuns: seasonalStats.totalRuns,
        completionRate: seasonalStats.completionRate,
        averageRating: seasonalStats.averageRating
      });

      // Aggregate dungeon statistics
      Object.keys(seasonalStats.dungeonStats).forEach(dungeon => {
        if (!dungeonRuns[dungeon]) {
          dungeonRuns[dungeon] = {
            totalRuns: 0,
            timedRuns: 0,
            highestKey: 0,
            totalRating: 0,
            players: new Set()
          };
        }
        
        const dungeonStat = seasonalStats.dungeonStats[dungeon];
        dungeonRuns[dungeon].totalRuns += dungeonStat.totalRuns;
        dungeonRuns[dungeon].timedRuns += dungeonStat.timedRuns;
        dungeonRuns[dungeon].totalRating += dungeonStat.totalRating;
        dungeonRuns[dungeon].players.add(`${character.name}-${character.server}`);
        
        if (dungeonStat.highestKey > dungeonRuns[dungeon].highestKey) {
          dungeonRuns[dungeon].highestKey = dungeonStat.highestKey;
        }
      });

      // Aggregate affix statistics
      Object.keys(seasonalStats.affixStats).forEach(affix => {
        if (!affixRuns[affix]) {
          affixRuns[affix] = {
            totalRuns: 0,
            timedRuns: 0,
            totalRating: 0
          };
        }
        
        const affixStat = seasonalStats.affixStats[affix];
        affixRuns[affix].totalRuns += affixStat.totalRuns;
        affixRuns[affix].timedRuns += affixStat.timedRuns;
        affixRuns[affix].totalRating += affixStat.totalRating;
      });

      // Aggregate role statistics
      Object.keys(seasonalStats.roleStats).forEach(role => {
        if (!roleRuns[role]) {
          roleRuns[role] = {
            totalRuns: 0,
            timedRuns: 0,
            totalRating: 0
          };
        }
        
        const roleStat = seasonalStats.roleStats[role];
        roleRuns[role].totalRuns += roleStat.totalRuns;
        roleRuns[role].timedRuns += roleStat.timedRuns;
        roleRuns[role].totalRating += roleStat.totalRating;
      });

      // Track member networks
      seasonalStats.topPlayedMembers.forEach(member => {
        const memberKey = `${member.name}-${member.server}`;
        if (!memberNetworks[memberKey]) {
          memberNetworks[memberKey] = {
            name: member.name,
            server: member.server,
            spec: member.spec,
            totalRuns: 0,
            playedWith: new Set()
          };
        }
        
        memberNetworks[memberKey].totalRuns += member.count;
        memberNetworks[memberKey].playedWith.add(`${character.name}-${character.server}`);
      });
    }
  });

  // Calculate guild averages
  guildStats.averageRating = guildStats.charactersWithMplus > 0 ? 
    characters.reduce((sum, char) => sum + (char.processedStats?.mythicPlusScore || char.raw_mplus?.current_mythic_rating?.rating || 0), 0) / guildStats.charactersWithMplus : 0;

  // Sort top players by rating
  guildStats.topPlayers = characterStats
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10);

  // Process dungeon leaderboard
  Object.keys(dungeonRuns).forEach(dungeon => {
    const dungeonData = dungeonRuns[dungeon];
    guildStats.dungeonLeaderboard[dungeon] = {
      totalRuns: dungeonData.totalRuns,
      timedRuns: dungeonData.timedRuns,
      highestKey: dungeonData.highestKey,
      averageRating: dungeonData.totalRuns > 0 ? dungeonData.totalRating / dungeonData.totalRuns : 0,
      completionRate: dungeonData.totalRuns > 0 ? (dungeonData.timedRuns / dungeonData.totalRuns) * 100 : 0,
      playerCount: dungeonData.players.size
    };
  });

  // Process affix statistics
  Object.keys(affixRuns).forEach(affix => {
    const affixData = affixRuns[affix];
    guildStats.affixStats[affix] = {
      totalRuns: affixData.totalRuns,
      timedRuns: affixData.timedRuns,
      averageRating: affixData.totalRuns > 0 ? affixData.totalRating / affixData.totalRuns : 0,
      completionRate: affixData.totalRuns > 0 ? (affixData.timedRuns / affixData.totalRuns) * 100 : 0
    };
  });

  // Process role statistics
  Object.keys(roleRuns).forEach(role => {
    const roleData = roleRuns[role];
    guildStats.roleStats[role] = {
      totalRuns: roleData.totalRuns,
      timedRuns: roleData.timedRuns,
      averageRating: roleData.totalRuns > 0 ? roleData.totalRating / roleData.totalRuns : 0,
      completionRate: roleData.totalRuns > 0 ? (roleData.timedRuns / roleData.totalRuns) * 100 : 0
    };
  });

  // Process member networks
  Object.keys(memberNetworks).forEach(memberKey => {
    const memberData = memberNetworks[memberKey];
    guildStats.memberNetworks[memberKey] = {
      name: memberData.name,
      server: memberData.server,
      spec: memberData.spec,
      totalRuns: memberData.totalRuns,
      playedWithCount: memberData.playedWith.size,
      playedWith: Array.from(memberData.playedWith)
    };
  });

  return guildStats;
}

/**
 * Get top seasonal achievements
 * @param {Object} guildStats - Guild seasonal statistics
 * @returns {Object} Top achievements
 */
export function getTopSeasonalAchievements(guildStats) {
  const achievements = {
    highestKeyOverall: {
      value: guildStats.highestKeyOverall,
      dungeon: null,
      player: null
    },
    highestTimedKey: {
      value: guildStats.highestTimedKey,
      dungeon: null,
      player: null
    },
    topRatedPlayer: guildStats.topPlayers[0] || null,
    mostActivePlayer: null,
    mostActiveDungeon: null,
    bestCompletionRate: null
  };

  // Find most active player
  const mostActivePlayer = guildStats.topPlayers.reduce((max, player) => 
    player.totalRuns > (max?.totalRuns || 0) ? player : max, null);
  achievements.mostActivePlayer = mostActivePlayer;

  // Find most active dungeon
  const dungeonEntries = Object.entries(guildStats.dungeonLeaderboard);
  const mostActiveDungeon = dungeonEntries.reduce((max, [name, data]) => 
    data.totalRuns > (max?.totalRuns || 0) ? { name, ...data } : max, null);
  achievements.mostActiveDungeon = mostActiveDungeon;

  // Find best completion rate
  const bestCompletionRate = guildStats.topPlayers.reduce((max, player) => 
    player.completionRate > (max?.completionRate || 0) ? player : max, null);
  achievements.bestCompletionRate = bestCompletionRate;

  return achievements;
}
