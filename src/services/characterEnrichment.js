/**
 * Orchestrate Raider.io + Warcraft Logs enrichment for a character.
 */

import { hasEnrichmentCredentials } from './secrets.js';
import { getCachedMemberData } from './warcraftlogs.js';
import { mergeRaiderLogs, normalizeRaiderScores } from './mergeRaiderLogs.js';
import { fetchMplusEnrichment, normalizeMplusMember } from './mplusEnrichment.js';
import { CLASS_NAME_TO_ID } from './warcraftlogs.js';

const RAID_MAX = 200;
const MPLUS_MAX = 200;

export function combinedRankScore(raidScore, mplusScore) {
  const r = Math.min(1, (raidScore ?? 0) / RAID_MAX) * 50;
  const m = Math.min(1, (mplusScore ?? 0) / MPLUS_MAX) * 50;
  return r + m;
}

export function tierForCombinedRank(rank) {
  if (rank === 1) return 'mythic';
  if (rank <= 3) return 'legendary';
  if (rank <= 7) return 'epic';
  if (rank <= 12) return 'rare';
  return 'uncommon';
}

/**
 * Enrich character data with Raider.io M+ and WCL raid parses.
 * @param {object} characterData - Battle.net character document
 * @param {object} [existingEnrichment] - prior enrichment stored on member
 */
export async function enrichCharacter(characterData, existingEnrichment = null) {
  if (!await hasEnrichmentCredentials()) {
    return existingEnrichment ?? null;
  }

  const member = {
    name: characterData.name.toLowerCase(),
    realm: characterData.server.toLowerCase(),
    className: characterData.metaData?.class,
    classID: CLASS_NAME_TO_ID[characterData.metaData?.class] ?? 0,
  };

  let raider = null;
  let mplus = null;
  const errors = [];

  try {
    const dpsRaider = await getCachedMemberData(member, 'dps');
    const hpsRaider = await getCachedMemberData(member, 'hps');
    raider = normalizeRaiderScores(mergeRaiderLogs(member.name, dpsRaider, hpsRaider));
  } catch (err) {
    console.warn(`[enrichment] WCL failed for ${member.name}:`, err.message);
    errors.push({ source: 'wcl', message: err.message });
    raider = existingEnrichment?.raider ?? null;
  }

  try {
    mplus = normalizeMplusMember(
      await fetchMplusEnrichment(characterData, existingEnrichment?.mplus),
    );
  } catch (err) {
    console.warn(`[enrichment] Raider.io failed for ${member.name}:`, err.message);
    errors.push({ source: 'raiderio', message: err.message });
    mplus = existingEnrichment?.mplus ?? null;
  }

  if (!raider && !mplus) {
    return existingEnrichment ?? null;
  }

  const raidScore = raider?.overallProgressScore ?? 0;
  const mplusScore = mplus?.totalMplusScore ?? 0;

  return {
    raider,
    mplus,
    raidScore,
    mplusScore,
    combinedScore: combinedRankScore(raidScore, mplusScore),
    rioRating: mplus?.score ?? 0,
    fetchedAt: new Date().toISOString(),
    errors: errors.length > 0 ? errors : undefined,
  };
}
