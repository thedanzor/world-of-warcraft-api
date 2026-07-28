/**
 * @file Utilities for resolving the active Mythic+ season from Blizzard profile data
 * @module tools/guildFetcher/mplusSeasonUtils
 */

/**
 * Resolve which season ID to fetch for a character.
 * Prefers the configured season when the character has data for it,
 * otherwise falls back to the highest season ID in their profile.
 *
 * @param {Object} mplusResponse - mythic-keystone-profile index response
 * @param {number} configuredSeason - CURRENT_MPLUS_SEASON from config
 * @returns {number|null} Season ID to fetch, or null if no seasons available
 */
export function resolveMplusSeasonId(mplusResponse, configuredSeason) {
  const seasons = mplusResponse?.seasons;
  if (!Array.isArray(seasons) || seasons.length === 0) {
    return configuredSeason ?? null;
  }

  const seasonIds = seasons.map((s) => s.id).filter((id) => typeof id === 'number');

  if (seasonIds.includes(configuredSeason)) {
    return configuredSeason;
  }

  return Math.max(...seasonIds);
}
