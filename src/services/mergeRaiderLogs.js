/**
 * Merge DPS + HPS WCL snapshots into a single raider profile.
 */

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

const PURE_DPS_CLASSES = new Set(['Hunter', 'Mage', 'Rogue', 'Warlock']);
const HEALING_SPEC_MARKERS = ['holy', 'discipline', 'restoration', 'mistweaver', 'preservation'];
const TANK_SPEC_MARKERS = ['protection', 'prot', 'guardian', 'blood', 'brewmaster', 'vengeance'];
const DPS_SPEC_MARKERS = [
  'retribution', 'ret', 'shadow', 'fury', 'arms', 'enhancement', 'elemental',
  'windwalker', 'havoc', 'devastation', 'augmentation', 'marksmanship',
  'beast mastery', 'survival', 'arcane', 'fire', 'frost', 'assassination',
  'outlaw', 'subtlety', 'balance', 'feral', 'affliction', 'demonology',
  'destruction', 'unholy',
];

function classifySpec(spec) {
  const s = (spec || '').toLowerCase().trim();
  if (!s) return null;
  if (s.includes('unholy')) return 'dps';
  if (HEALING_SPEC_MARKERS.some((m) => s.includes(m))) return 'hps';
  if (TANK_SPEC_MARKERS.some((m) => s.includes(m))) return 'tank';
  if (DPS_SPEC_MARKERS.some((m) => s.includes(m))) return 'dps';
  return null;
}

function preferredMetricForSpec(className, spec) {
  if (PURE_DPS_CLASSES.has(className)) return 'dps';
  const bucket = classifySpec(spec);
  if (bucket === 'hps' || bucket === 'tank') return 'hps';
  if (bucket === 'dps') return 'dps';
  return null;
}

function roleForSpec(className, spec) {
  if (PURE_DPS_CLASSES.has(className)) return 'DPS';
  const bucket = classifySpec(spec);
  if (bucket === 'hps') return 'Healer';
  if (bucket === 'tank') return 'Tank';
  if (bucket === 'dps') return 'DPS';
  return null;
}

function chooseBestBossLog(className, dpsBoss, hpsBoss) {
  if (PURE_DPS_CLASSES.has(className)) return dpsBoss;
  if (!dpsBoss && !hpsBoss) return null;
  if (!dpsBoss) return hpsBoss;
  if (!hpsBoss) return dpsBoss;

  const dpsPref = preferredMetricForSpec(className, dpsBoss.spec);
  if (dpsPref === 'dps') return dpsBoss;
  if (dpsPref === 'hps') return hpsBoss;

  const hpsPref = preferredMetricForSpec(className, hpsBoss.spec);
  if (hpsPref === 'dps') return dpsBoss;
  if (hpsPref === 'hps') return hpsBoss;

  if (hpsBoss.bestParse === dpsBoss.bestParse) return dpsBoss;
  return hpsBoss.bestParse > dpsBoss.bestParse ? hpsBoss : dpsBoss;
}

export function calcSpeedScoreFromKillWeeks(killWeeks, totalBosses) {
  if (killWeeks.length === 0) return 0;
  const sorted = [...killWeeks].sort((a, b) => a - b);

  let baseSpeed = 0;
  for (let i = BASE_MILESTONES.length - 1; i >= 0; i--) {
    const ms = BASE_MILESTONES[i];
    if (ms.bossCount > totalBosses) continue;
    if (sorted.length < ms.bossCount) continue;
    const week = sorted[ms.bossCount - 1];
    const weeksLate = Math.max(0, week - ms.expectedWeek);
    baseSpeed = Math.max(0, ms.maxPts - 2.5 * weeksLate);
    break;
  }

  let bonusSpeed = 0;
  for (const ms of BONUS_MILESTONES) {
    if (ms.bossCount > totalBosses) continue;
    if (sorted.length < ms.bossCount) continue;
    const week = sorted[ms.bossCount - 1];
    if (week <= ms.byWeek) {
      bonusSpeed = ms.bonusPts;
      break;
    }
  }

  return baseSpeed + bonusSpeed;
}

export function mergeRaiderLogs(name, dpsRaider, hpsRaider) {
  const source = dpsRaider ?? hpsRaider;
  if (!source) return null;

  const { className, classID, classColour } = source;
  const patches = new Set([
    ...Object.keys(dpsRaider?.zones ?? {}),
    ...Object.keys(hpsRaider?.zones ?? {}),
  ]);

  const zones = {};

  for (const patch of patches) {
    const dpsZone = dpsRaider?.zones[patch];
    const hpsZone = hpsRaider?.zones[patch];
    if (!dpsZone && !hpsZone) continue;

    const totalBosses = dpsZone?.totalBosses ?? hpsZone?.totalBosses ?? 0;
    const zoneId = dpsZone?.zoneId ?? hpsZone?.zoneId ?? 0;
    const zoneName = dpsZone?.zoneName ?? hpsZone?.zoneName ?? patch;

    const dpsByBoss = new Map();
    const hpsByBoss = new Map();

    for (const boss of dpsZone?.bossRankings ?? []) {
      dpsByBoss.set(boss.bossName, { ...boss, metric: 'dps' });
    }
    for (const boss of hpsZone?.bossRankings ?? []) {
      hpsByBoss.set(boss.bossName, { ...boss, metric: 'hps' });
    }

    const bossNames = new Set([...dpsByBoss.keys(), ...hpsByBoss.keys()]);
    const chosenBosses = [];
    let dpsPicked = 0;
    let hpsPicked = 0;

    for (const bossName of bossNames) {
      const chosen = chooseBestBossLog(
        className,
        dpsByBoss.get(bossName) ?? null,
        hpsByBoss.get(bossName) ?? null,
      );
      if (!chosen) continue;
      chosenBosses.push(chosen);
      if (chosen.metric === 'hps') hpsPicked++;
      else dpsPicked++;
    }

    if (chosenBosses.length === 0) continue;

    const avgBestParse = chosenBosses.reduce((sum, boss) => sum + (boss.bestParse ?? 0), 0) / chosenBosses.length;
    const avgMedianParse = chosenBosses.reduce((sum, boss) => sum + (boss.medianParse ?? 0), 0) / chosenBosses.length;
    const parseScore = avgBestParse;
    const speedScore = calcSpeedScoreFromKillWeeks(
      chosenBosses.map((boss) => boss.killWeek).filter((week) => week != null),
      totalBosses,
    );
    const progressScore = parseScore + speedScore;

    zones[patch] = {
      zoneId,
      zoneName,
      patch,
      primaryMetric: hpsPicked > dpsPicked ? 'hps' : 'dps',
      bestPerformanceAverage: avgBestParse,
      dpsPerformanceAverage: dpsZone?.bestPerformanceAverage ?? null,
      hpsPerformanceAverage: hpsZone?.bestPerformanceAverage ?? null,
      damageTakenPerformanceAverage:
        chosenBosses.length > 0
          ? (() => {
              const vals = chosenBosses
                .map((b) => b.damageTakenPercentile)
                .filter((v) => typeof v === 'number');
              return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
            })()
          : null,
      medianPerformanceAverage: avgMedianParse,
      kills: chosenBosses.length,
      totalBosses,
      parseScore,
      speedScore,
      progressScore,
      isBest: false,
      bossRankings: chosenBosses.map((boss) => ({
        bossName: boss.bossName,
        bestParse: boss.bestParse,
        medianParse: boss.medianParse,
        kills: boss.kills,
        bestAmount: boss.bestAmount,
        spec: boss.spec,
        role: boss.role,
        damageTakenPercentile: boss.damageTakenPercentile ?? null,
        damageTakenAmount: boss.damageTakenAmount ?? null,
        killWeek: boss.killWeek,
      })),
    };
  }

  const zoneEntries = Object.values(zones);
  if (zoneEntries.length === 0) return null;
  const bestScore = Math.max(...zoneEntries.map((zone) => zone.progressScore));
  for (const zone of zoneEntries) zone.isBest = zone.progressScore === bestScore;

  const roleCounts = zoneEntries.reduce(
    (acc, zone) => {
      for (const boss of zone.bossRankings) {
        const role = roleForSpec(className, boss.spec);
        if (role) acc[role]++;
      }
      return acc;
    },
    { DPS: 0, Healer: 0, Tank: 0 },
  );

  let resolvedRole = 'DPS';
  if (roleCounts.Tank >= roleCounts.Healer && roleCounts.Tank >= roleCounts.DPS && roleCounts.Tank > 0) {
    resolvedRole = 'Tank';
  } else if (roleCounts.Healer >= roleCounts.DPS && roleCounts.Healer > 0) {
    resolvedRole = 'Healer';
  }

  return {
    name,
    className,
    classID,
    classColour,
    role: resolvedRole,
    zones,
    overallProgressScore: bestScore,
  };
}

export function normalizeRaiderScores(raider) {
  if (!raider) return null;
  const rescaledZones = {};
  for (const [patch, zone] of Object.entries(raider.zones)) {
    const killedBosses = zone.bossRankings ?? [];
    const parseScore = killedBosses.length > 0
      ? killedBosses.reduce((sum, b) => sum + (b.bestParse ?? 0), 0) / killedBosses.length
      : 0;
    const killWeeks = killedBosses.map((b) => b.killWeek).filter((w) => w != null);
    const speedScore = calcSpeedScoreFromKillWeeks(killWeeks, zone.totalBosses);
    rescaledZones[patch] = {
      ...zone,
      parseScore,
      speedScore,
      progressScore: parseScore + speedScore,
      isBest: false,
    };
  }
  const zoneEntries = Object.values(rescaledZones);
  if (zoneEntries.length === 0) {
    return { ...raider, zones: rescaledZones, overallProgressScore: 0 };
  }
  const bestScore = Math.max(...zoneEntries.map((z) => z.progressScore));
  for (const zone of zoneEntries) zone.isBest = zone.progressScore === bestScore;
  return { ...raider, zones: rescaledZones, overallProgressScore: bestScore };
}
