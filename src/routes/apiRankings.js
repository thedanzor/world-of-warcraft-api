/**
 * @file Rankings API — aggregated Raider.io + WCL enrichment from member documents.
 */

import express from 'express';
import { getAllMembers } from '../database.js';
import { logError } from '../database.js';
import { combinedRankScore, tierForCombinedRank } from '../services/characterEnrichment.js';
import { normalizeRaiderScores } from '../services/mergeRaiderLogs.js';
import { normalizeMplusMember } from '../services/mplusEnrichment.js';

const router = express.Router();

/**
 * GET /api/rankings/all — Combined raid + M+ rankings for all members with enrichment data.
 */
router.get('/all', async (req, res) => {
  try {
    const members = await getAllMembers();

    const raiders = [];
    const mplusMembers = [];
    const combined = [];

    for (const member of members) {
      const enrichment = member.enrichment;
      if (!enrichment) continue;

      if (enrichment.raider) {
        const raider = normalizeRaiderScores(enrichment.raider);
        if (raider) raiders.push(raider);
      }

      if (enrichment.mplus) {
        const mplus = normalizeMplusMember(enrichment.mplus);
        if (mplus) mplusMembers.push(mplus);
      }

      if (enrichment.raider || enrichment.mplus) {
        combined.push({
          name: member.name,
          server: member.server,
          className: member.metaData?.class,
          spec: member.metaData?.spec,
          classColour: enrichment.raider?.classColour ?? enrichment.mplus?.classColour ?? '#aaa',
          raidScore: enrichment.raidScore ?? 0,
          mplusScore: enrichment.mplusScore ?? 0,
          mplusRating: enrichment.rioRating ?? enrichment.mplus?.score ?? 0,
          combinedScore: enrichment.combinedScore ?? combinedRankScore(
            enrichment.raidScore ?? 0,
            enrichment.mplusScore ?? 0,
          ),
          role: enrichment.raider?.role ?? member.processedStats?.role ?? 'DPS',
        });
      }
    }

    raiders.sort((a, b) => b.overallProgressScore - a.overallProgressScore);
    mplusMembers.sort((a, b) => b.totalMplusScore - a.totalMplusScore);
    combined.sort((a, b) => b.combinedScore - a.combinedScore);

    const ranked = combined.map((p, i) => ({
      ...p,
      rank: i + 1,
      tier: tierForCombinedRank(i + 1),
    }));

    res.json({
      success: true,
      raiders,
      mplus: mplusMembers,
      combined: ranked,
      fetchedAt: members.find((m) => m.enrichment?.fetchedAt)?.enrichment?.fetchedAt ?? null,
      count: ranked.length,
    });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/rankings/all',
      error,
      context: { method: 'GET' },
    });

    res.status(500).json({
      success: false,
      error: 'Failed to load rankings',
      message: error.message,
    });
  }
});

/**
 * GET /api/rankings/member/:realm/:name — Enrichment for a single member.
 */
router.get('/member/:realm/:name', async (req, res) => {
  try {
    const { realm, name } = req.params;
    const { findMemberByName } = await import('../database.js');
    const member = await findMemberByName(name.toLowerCase(), realm.toLowerCase());

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found',
      });
    }

    const enrichment = member.enrichment ?? null;
    if (enrichment?.raider) enrichment.raider = normalizeRaiderScores(enrichment.raider);
    if (enrichment?.mplus) enrichment.mplus = normalizeMplusMember(enrichment.mplus);

    res.json({
      success: true,
      name: member.name,
      server: member.server,
      enrichment,
      processedStats: member.processedStats,
    });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/api/rankings/member',
      error,
      context: { params: req.params },
    });

    res.status(500).json({
      success: false,
      error: 'Failed to load member enrichment',
      message: error.message,
    });
  }
});

export default router;
