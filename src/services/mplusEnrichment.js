/**
 * Raider.io M+ enrichment for a single character.
 */

import { rioGet } from './raiderio.js';
import { getConfig } from '../config.js';
import { WCL_CLASS_COLOURS, WCL_CLASS_NAMES, CLASS_NAME_TO_ID } from './warcraftlogs.js';

function mapRun(r) {
  return {
    dungeon: r.dungeon,
    shortName: r.short_name,
    mythicLevel: r.mythic_level,
    numUpgrades: r.num_keystone_upgrades,
    clearTimeMs: r.clear_time_ms,
    parTimeMs: r.par_time_ms,
    score: r.score,
    affixes: (r.affixes ?? []).map((a) => a.name),
    url: r.url ?? '',
  };
}

function mergeRuns(existing, incoming) {
  const seen = new Map(existing.map((r) => [r.url, r]));
  for (const r of incoming) {
    if (r.url) seen.set(r.url, r);
  }
  const merged = [...seen.values()];
  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, 500);
}

function keyLevelBonusForRuns(bestRuns) {
  return bestRuns.reduce((sum, run) => {
    if (run.mythicLevel >= 18) return sum + 8;
    if (run.mythicLevel >= 16) return sum + 6;
    if (run.mythicLevel >= 14) return sum + 4;
    if (run.mythicLevel >= 12) return sum + 2;
    if (run.mythicLevel >= 10) return sum + 1;
    return sum;
  }, 0);
}

function buildMember(name, classID, activeSpec, score, bestRuns, recentRuns, highestRuns, allTrackedRuns, maxRating) {
  if (score === 0 && bestRuns.length === 0 && allTrackedRuns.length === 0) return null;

  const totalTrackedRuns = allTrackedRuns.length;
  const timedTrackedRuns = allTrackedRuns.filter((r) => r.numUpgrades > 0).length;
  const untimedTrackedRuns = allTrackedRuns.filter((r) => r.numUpgrades === 0).length;
  const successRate = totalTrackedRuns > 0
    ? (timedTrackedRuns / totalTrackedRuns) * 100
    : bestRuns.length > 0 ? 100 : 0;

  const highestTimedKey = bestRuns.reduce((m, r) => Math.max(m, r.mythicLevel), 0);
  const highestAttemptedKey = Math.max(
    highestTimedKey,
    highestRuns.reduce((m, r) => Math.max(m, r.mythicLevel), 0),
  );
  const avgBestKeyLevel = bestRuns.length > 0
    ? bestRuns.reduce((s, r) => s + r.mythicLevel, 0) / bestRuns.length
    : 0;

  const topRun = bestRuns.reduce((best, r) => (!best || r.score > best.score ? r : best), null);

  const ratingScore = Math.min(60, (score / maxRating) * 60);
  const successBasePts = (successRate / 100) * 40;
  const volumeBonus = Math.floor(totalTrackedRuns / 20) * 2;
  const successScore = Math.min(40, successBasePts + volumeBonus);
  const keyLevelScore = keyLevelBonusForRuns(bestRuns);
  const totalMplusScore = Math.min(200, ratingScore + successScore + keyLevelScore);

  return {
    name,
    className: WCL_CLASS_NAMES[classID] ?? 'Unknown',
    classID,
    classColour: WCL_CLASS_COLOURS[classID] ?? '#aaa',
    activeSpec,
    score,
    recentRuns,
    totalTrackedRuns,
    timedTrackedRuns,
    untimedTrackedRuns,
    successRate,
    bestRuns,
    highestTimedKey,
    highestAttemptedKey,
    avgBestKeyLevel,
    topDungeon: topRun?.dungeon ?? null,
    topDungeonLevel: topRun?.mythicLevel ?? 0,
    ratingScore,
    successScore,
    keyLevelScore,
    totalMplusScore,
    allTrackedRuns,
  };
}

/**
 * Fetch and score M+ data from Raider.io for one character.
 * @param {{ name: string, server: string, metaData?: { class?: string, spec?: string } }} characterData
 * @param {object} [existingEnrichment] - prior enrichment.mplus for run accumulation
 */
export async function fetchMplusEnrichment(characterData, existingEnrichment = null) {
  const config = await getConfig();
  const region = config.REGION || 'eu';
  const realm = characterData.server.toLowerCase();
  const name = characterData.name.toLowerCase();
  const classID = CLASS_NAME_TO_ID[characterData.metaData?.class] ?? 0;
  const maxRating = config.mplus?.maxRatingForScore ?? 3700;

  const profile = await rioGet('/characters/profile', {
    region,
    realm,
    name,
    fields: [
      'mythic_plus_scores_by_season:current',
      'mythic_plus_best_runs',
      'mythic_plus_recent_runs',
      'mythic_plus_highest_level_runs',
    ].join(','),
  });

  const score = profile.mythic_plus_scores_by_season?.[0]?.scores?.all ?? 0;
  const activeSpec = profile.active_spec_name ?? characterData.metaData?.spec ?? 'Unknown';
  const bestRuns = (profile.mythic_plus_best_runs ?? []).map(mapRun);
  const recentRuns = (profile.mythic_plus_recent_runs ?? []).map(mapRun);
  const highestRuns = (profile.mythic_plus_highest_level_runs ?? profile.mythic_plus_best_runs ?? []).map(mapRun);

  const previousRuns = existingEnrichment?.allTrackedRuns ?? [];
  const incomingRuns = [...recentRuns, ...bestRuns, ...highestRuns];
  const allTrackedRuns = mergeRuns(previousRuns, incomingRuns);

  return buildMember(name, classID, activeSpec, score, bestRuns, recentRuns, highestRuns, allTrackedRuns, maxRating);
}

export function normalizeMplusMember(member) {
  if (!member) return null;
  const keyLevelScore = member.keyLevelScore ?? keyLevelBonusForRuns(member.bestRuns ?? []);
  const baseScore = Math.min(100, (member.ratingScore ?? 0) + (member.successScore ?? 0));
  const totalMplusScore = Math.min(200, baseScore + keyLevelScore);
  return { ...member, keyLevelScore, totalMplusScore };
}
