/**
 * Warcraft Logs character enrichment (per-player raid parses — no guild benchmarks).
 */

import { getWclClientId, getWclClientSecret } from './secrets.js';
import { getConfig } from '../config.js';

const WCL_TOKEN_URL = 'https://www.warcraftlogs.com/oauth/token';
const WCL_API_URL = 'https://www.warcraftlogs.com/api/v2/client';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const KILL_TS_TTL = 24 * 60 * 60 * 1000;

let _token = null;

export const WCL_CLASS_COLOURS = {
  1: '#C41E3A', 2: '#FF7C0A', 3: '#AAD372', 4: '#3FC7EB', 5: '#00FF98',
  6: '#F48CBA', 7: '#FFFFFF', 8: '#FFF468', 9: '#0070DD', 10: '#8788EE',
  11: '#C69B3A', 12: '#A330C9', 13: '#33937F',
};

export const WCL_CLASS_NAMES = {
  1: 'Death Knight', 2: 'Druid', 3: 'Hunter', 4: 'Mage', 5: 'Monk',
  6: 'Paladin', 7: 'Priest', 8: 'Rogue', 9: 'Shaman', 10: 'Warlock',
  11: 'Warrior', 12: 'Demon Hunter', 13: 'Evoker',
};

export const CLASS_NAME_TO_ID = {
  'Death Knight': 1, 'Druid': 2, 'Hunter': 3, 'Mage': 4, 'Monk': 5,
  'Paladin': 6, 'Priest': 7, 'Rogue': 8, 'Shaman': 9, 'Warlock': 10,
  'Warrior': 11, 'Demon Hunter': 12, 'Evoker': 13,
};

const memberCache = new Map();
const killTsCache = new Map();
const damageTakenCache = new Map();

async function getToken() {
  if (_token && Date.now() < _token.expires_at - 60000) return _token.access_token;
  const clientId = await getWclClientId();
  const clientSecret = await getWclClientSecret();
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(WCL_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`WCL token error: ${res.status}`);
  const data = await res.json();
  _token = { access_token: data.access_token, expires_at: Date.now() + data.expires_in * 1000 };
  return _token.access_token;
}

async function gql(query, attempt = 0) {
  const token = await getToken();
  const res = await fetch(WCL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(30000),
  });

  if (res.status === 429 && attempt < 5) {
    const retryAfter = res.headers.get('retry-after');
    const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : 3000 * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, wait));
    return gql(query, attempt + 1);
  }

  if (!res.ok) throw new Error(`WCL GraphQL HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`WCL GraphQL: ${json.errors.map((e) => e.message).join(', ')}`);
  }
  return json.data;
}

function memberKey(name, zoneId, partition, metric) {
  return `${name}:${zoneId}:${partition ?? 'x'}:${metric}`;
}

function getMemberCache(name, zoneId, partition, metric) {
  const e = memberCache.get(memberKey(name, zoneId, partition, metric));
  return e && Date.now() - e.ts < CACHE_TTL_MS ? e.data : null;
}

function setMemberCache(name, zoneId, partition, metric, data) {
  memberCache.set(memberKey(name, zoneId, partition, metric), { data, ts: Date.now() });
}

function killTsKey(name, metric) { return `${name}:${metric}`; }

function getKillTsCache(name, metric) {
  const e = killTsCache.get(killTsKey(name, metric));
  return e && Date.now() - e.ts < KILL_TS_TTL ? e.data : null;
}

function setKillTsCache(name, metric, data) {
  killTsCache.set(killTsKey(name, metric), { data, ts: Date.now() });
}

function damageTakenKey(name) { return `${name}:dtps`; }

function getDamageTakenCache(name) {
  const e = damageTakenCache.get(damageTakenKey(name));
  return e && Date.now() - e.ts < KILL_TS_TTL ? e.data : null;
}

function setDamageTakenCache(name, data) {
  damageTakenCache.set(damageTakenKey(name), { data, ts: Date.now() });
}

async function fetchOneRanking(name, realm, region, zoneId, difficulty, partition, metric) {
  const cached = getMemberCache(name, zoneId, partition, metric);
  if (cached) return cached;

  const partArg = partition != null ? `, partition: ${partition}` : '';
  const zoneArgs = `zoneID: ${zoneId}, difficulty: ${difficulty}, metric: ${metric}${partArg}`;

  const data = await gql(`{
    characterData {
      character(name: "${name}", serverSlug: "${realm}", serverRegion: "${region.toUpperCase()}") {
        zoneRankings(${zoneArgs})
      }
    }
  }`);

  const zr = data.characterData?.character?.zoneRankings;
  if (!zr || typeof zr !== 'object') return null;

  setMemberCache(name, zoneId, partition, metric, zr);
  return zr;
}

async function fetchFirstKillTimestamps(name, realm, region, encounters, metric) {
  const cached = getKillTsCache(name, metric);
  if (cached) return cached;
  if (encounters.length === 0) return {};

  const unique = [...new Map(encounters.map((e) => [e.id, e])).values()];
  const aliases = unique.map((e) => {
    const partArg = e.partition != null ? `, partition: ${e.partition}` : '';
    return `enc${e.id}: encounterRankings(encounterID: ${e.id}, difficulty: ${e.difficulty}, metric: ${metric}${partArg})`;
  }).join('\n        ');

  try {
    const data = await gql(`{
      characterData {
        character(name: "${name}", serverSlug: "${realm}", serverRegion: "${region.toUpperCase()}") {
          ${aliases}
        }
      }
    }`);

    const char = data.characterData?.character;
    const result = {};

    if (char) {
      for (const e of unique) {
        const raw = char[`enc${e.id}`];
        const times = (raw?.ranks ?? [])
          .flatMap((r) => [r.startTime, r.report?.startTime])
          .filter((t) => typeof t === 'number' && t > 0);
        if (times.length > 0) result[e.id] = Math.min(...times);
      }
    }

    setKillTsCache(name, metric, result);
    return result;
  } catch (err) {
    console.warn(`[wcl] fetchFirstKillTimestamps failed for ${name}:`, err.message);
    return {};
  }
}

async function fetchDamageTakenByEncounter(name, realm, region, encounters) {
  const cached = getDamageTakenCache(name);
  if (cached) return cached;
  if (encounters.length === 0) return {};

  const unique = [...new Map(encounters.map((e) => [e.id, e])).values()];
  const aliases = unique.map((e) => {
    const partArg = e.partition != null ? `, partition: ${e.partition}` : '';
    return `enc${e.id}: encounterRankings(encounterID: ${e.id}, difficulty: ${e.difficulty}, metric: dtps${partArg})`;
  }).join('\n        ');

  try {
    const data = await gql(`{
      characterData {
        character(name: "${name}", serverSlug: "${realm}", serverRegion: "${region.toUpperCase()}") {
          ${aliases}
        }
      }
    }`);

    const char = data.characterData?.character;
    const result = {};

    if (char) {
      for (const e of unique) {
        const raw = char[`enc${e.id}`];
        const ranks = (raw?.ranks ?? []).filter((r) => typeof r.rankPercent === 'number');
        if (ranks.length === 0) continue;

        const bestByPercent = ranks.reduce((best, r) =>
          (r.rankPercent ?? 0) > (best.rankPercent ?? 0) ? r : best
        );
        const amountCandidates = [bestByPercent.amount, bestByPercent.total, bestByPercent.bestAmount]
          .filter((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0);

        result[e.id] = {
          rankPercent: bestByPercent.rankPercent ?? 0,
          bestAmount: amountCandidates.length > 0 ? Math.min(...amountCandidates) : null,
        };
      }
    }

    setDamageTakenCache(name, result);
    return result;
  } catch (err) {
    console.warn(`[wcl] fetchDamageTakenByEncounter failed for ${name}:`, err.message);
    return {};
  }
}

function getTierOpenMs(config) {
  const date = config.SEASON_START_DATE || config.tier?.openDate;
  return new Date(date).getTime();
}

function killWeek(startMs, tierOpenMs) {
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((startMs - tierOpenMs) / MS_PER_WEEK) + 1);
}

const BASE_MILESTONES = [
  { bossCount: 2, expectedWeek: 2, maxPts: 12.5 },
  { bossCount: 4, expectedWeek: 4, maxPts: 18.75 },
  { bossCount: 7, expectedWeek: 6, maxPts: 25 },
  { bossCount: 9, expectedWeek: 8, maxPts: 50 },
];

const BONUS_MILESTONES = [
  { bossCount: 9, byWeek: 4, bonusPts: 50 },
  { bossCount: 7, byWeek: 4, bonusPts: 25 },
  { bossCount: 4, byWeek: 4, bonusPts: 12.5 },
];

function calcScore(zoneData, totalBosses, firstKillMs, tierOpenMs) {
  const killed = (zoneData.rankings ?? []).filter((r) => r.totalKills > 0);
  if (killed.length === 0) return { parseScore: 0, speedScore: 0 };

  const avgParse = killed.reduce((s, r) => s + (r.rankPercent ?? 0), 0) / killed.length;
  const parseScore = avgParse;

  const killedWithTime = killed
    .map((r) => ({ id: r.encounter.id, ts: firstKillMs[r.encounter.id] ?? null }))
    .filter((r) => r.ts !== null)
    .sort((a, b) => a.ts - b.ts);

  let baseSpeed = 0;
  for (let i = BASE_MILESTONES.length - 1; i >= 0; i--) {
    const ms = BASE_MILESTONES[i];
    if (ms.bossCount > totalBosses) continue;
    if (killedWithTime.length < ms.bossCount) continue;
    const week = killWeek(killedWithTime[ms.bossCount - 1].ts, tierOpenMs);
    const weeksLate = Math.max(0, week - ms.expectedWeek);
    baseSpeed = Math.max(0, ms.maxPts - 2.5 * weeksLate);
    break;
  }

  let bonusSpeed = 0;
  for (const ms of BONUS_MILESTONES) {
    if (ms.bossCount > totalBosses) continue;
    if (killedWithTime.length < ms.bossCount) continue;
    const week = killWeek(killedWithTime[ms.bossCount - 1].ts, tierOpenMs);
    if (week <= ms.byWeek) {
      bonusSpeed = ms.bonusPts;
      break;
    }
  }

  return { parseScore, speedScore: baseSpeed + bonusSpeed };
}

const HEALER_SPECS = new Set(['Holy', 'Discipline', 'Restoration', 'Mistweaver', 'Preservation']);
const TANK_SPECS = new Set(['Blood', 'Guardian', 'Brewmaster', 'Protection', 'Vengeance']);

function specToRole(spec) {
  if (HEALER_SPECS.has(spec)) return 'Healer';
  if (TANK_SPECS.has(spec)) return 'Tank';
  return 'DPS';
}

function detectRole(zoneDataMap) {
  const counts = { Healer: 0, Tank: 0, DPS: 0 };
  let total = 0;
  for (const zd of Object.values(zoneDataMap)) {
    for (const r of zd.rankings) {
      if (r.totalKills > 0 && r.spec) {
        counts[specToRole(r.spec)]++;
        total++;
      }
    }
  }
  if (total === 0) return null;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Fetch WCL raid data for a single character.
 * @param {{ name: string, classID?: number, className?: string, realm?: string }} member
 * @param {'dps'|'hps'} metric
 */
export async function getCachedMemberData(member, metric) {
  const config = await getConfig();
  const zones = config.warcraftLogs?.zones ?? [];
  if (zones.length === 0) return null;

  const realm = (member.realm || config.GUILD_REALM).toLowerCase();
  const region = config.REGION || 'eu';
  const tierOpenMs = getTierOpenMs(config);
  const classID = member.classID ?? CLASS_NAME_TO_ID[member.className] ?? 0;

  const zoneDataMap = {};
  const encountersSeen = [];

  for (const zone of zones) {
    const zoneData = await fetchOneRanking(
      member.name, realm, region,
      zone.id, zone.difficulty, zone.partition,
      metric,
    );
    if (!zoneData) continue;
    zoneDataMap[zone.patch] = zoneData;

    for (const r of zoneData.rankings.filter((rank) => rank.totalKills > 0)) {
      if (!encountersSeen.some((e) => e.id === r.encounter.id)) {
        encountersSeen.push({ id: r.encounter.id, difficulty: zone.difficulty, partition: zone.partition });
      }
    }
  }

  const firstKillMsMap = await fetchFirstKillTimestamps(member.name, realm, region, encountersSeen, metric);
  const damageTakenByEncounter = await fetchDamageTakenByEncounter(member.name, realm, region, encountersSeen);

  const processedZones = {};

  for (const zone of zones) {
    const zoneData = zoneDataMap[zone.patch];
    if (!zoneData) continue;

    const killed = zoneData.rankings.filter((r) => r.totalKills > 0);
    const { parseScore, speedScore } = calcScore(zoneData, zone.bossCount, firstKillMsMap, tierOpenMs);
    const dtVals = killed
      .map((r) => damageTakenByEncounter[r.encounter.id]?.rankPercent)
      .filter((v) => typeof v === 'number');

    processedZones[zone.patch] = {
      zoneId: zone.id,
      zoneName: zone.name,
      patch: zone.patch,
      primaryMetric: metric,
      bestPerformanceAverage: zoneData.bestPerformanceAverage,
      damageTakenPerformanceAverage: dtVals.length > 0 ? dtVals.reduce((s, v) => s + v, 0) / dtVals.length : null,
      medianPerformanceAverage: zoneData.medianPerformanceAverage,
      kills: killed.length,
      totalBosses: zone.bossCount,
      parseScore,
      speedScore,
      progressScore: parseScore + speedScore,
      isBest: false,
      bossRankings: killed.map((r) => ({
        bossName: r.encounter.name,
        bestParse: r.rankPercent,
        medianParse: r.medianPercent,
        kills: r.totalKills,
        bestAmount: r.bestAmount,
        spec: r.spec,
        role: r.role,
        damageTakenPercentile: damageTakenByEncounter[r.encounter.id]?.rankPercent ?? null,
        damageTakenAmount: damageTakenByEncounter[r.encounter.id]?.bestAmount ?? null,
        killWeek: firstKillMsMap[r.encounter.id]
          ? killWeek(firstKillMsMap[r.encounter.id], tierOpenMs)
          : null,
      })),
    };
  }

  const zoneEntries = Object.values(processedZones);
  if (!zoneEntries.some((z) => z.kills > 0)) return null;

  const trueRole = detectRole(zoneDataMap);
  const role = trueRole ?? (metric === 'hps' ? 'Healer' : 'DPS');
  const bestScore = Math.max(0, ...zoneEntries.map((z) => z.progressScore));

  for (const z of zoneEntries) z.isBest = z.progressScore === bestScore;

  return {
    name: member.name,
    className: WCL_CLASS_NAMES[classID] ?? member.className ?? 'Unknown',
    classID,
    classColour: WCL_CLASS_COLOURS[classID] ?? '#aaa',
    role,
    zones: processedZones,
    overallProgressScore: bestScore,
  };
}
