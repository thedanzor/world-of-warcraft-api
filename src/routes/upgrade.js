/**
 * @file Route handler for /api/upgrade endpoint - Database migration and upgrade utilities
 * @module routes/upgrade
 *
 * Provides admin-authenticated endpoints to inspect and run database migrations.
 * Each migration is idempotent: safe to run multiple times.
 */

import express from 'express';
import bcrypt from 'bcrypt';
import {
  getAdminByUsername,
  getAppSettings,
  connectToDatabase,
  logError,
} from '../database.js';
import { clearConfigCache } from '../config.js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

/* ─── Auth middleware (same pattern as settings.js) ──────────── */
async function verifyAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please provide admin credentials',
      });
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (!username || !password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Username and password are required',
      });
    }

    const admin = await getAdminByUsername(username);
    if (!admin) {
      await logError({
        type: 'security',
        endpoint: req.path,
        error: new Error('Invalid admin username'),
        context: { username, ip: req.ip },
      });
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid username or password',
      });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      await logError({
        type: 'security',
        endpoint: req.path,
        error: new Error('Invalid admin password'),
        context: { username, ip: req.ip },
      });
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        message: 'Invalid username or password',
      });
    }

    req.admin = { username };
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: error.message,
    });
  }
}

/* ─── Migration definitions ──────────────────────────────────── */

/**
 * Each migration has:
 *   id        - unique key
 *   name      - display name
 *   description - what it does
 *   check()   - async: returns { needed: bool, reason: string }
 *   run()     - async: performs the migration, returns { success, message, ...extra }
 */
const MIGRATIONS = [
  {
    id: 'migrate-config-keys',
    name: 'Migrate Config Keys',
    description:
      'Renames the legacy CURRENT_RAID key to CURRENT_EXPANSION in AppSettings. ' +
      'The system now tracks lockouts for all raids within an expansion automatically, ' +
      'so only the expansion name (e.g. "Midnight") is needed.',
    check: async () => {
      const settings = await getAppSettings();
      if (!settings) {
        return { needed: false, reason: 'No AppSettings found in database' };
      }
      if (settings.CURRENT_EXPANSION) {
        return {
          needed: false,
          reason: `Already migrated — CURRENT_EXPANSION is set to "${settings.CURRENT_EXPANSION}"`,
        };
      }
      if (settings.CURRENT_RAID) {
        return {
          needed: true,
          reason: `CURRENT_RAID="${settings.CURRENT_RAID}" will be renamed to CURRENT_EXPANSION`,
        };
      }
      return {
        needed: true,
        reason: 'CURRENT_EXPANSION is missing and will be set to "Midnight"',
      };
    },
    run: async () => {
      const { db } = await connectToDatabase();
      const settings = await getAppSettings();

      const updateDoc = {};

      if (settings?.CURRENT_RAID && !settings?.CURRENT_EXPANSION) {
        // Rename the key: copy value, delete old key
        updateDoc.$set = { CURRENT_EXPANSION: settings.CURRENT_RAID };
        updateDoc.$unset = { CURRENT_RAID: '' };
      } else if (!settings?.CURRENT_EXPANSION) {
        updateDoc.$set = { CURRENT_EXPANSION: 'Midnight' };
      }

      if (Object.keys(updateDoc).length === 0) {
        return { success: true, message: 'Nothing to change — already up to date.' };
      }

      await db.collection('AppSettings').updateOne({}, updateDoc);
      clearConfigCache();

      return {
        success: true,
        message: updateDoc.$unset
          ? `Renamed CURRENT_RAID → CURRENT_EXPANSION ("${settings.CURRENT_RAID}") and cleared config cache.`
          : 'Added CURRENT_EXPANSION: "Midnight" and cleared config cache.',
      };
    },
  },

  {
    id: 'resync-raid-data',
    name: 'Re-sync Raid Data',
    description:
      'Re-fetches raid encounter data for all guild members from the Battle.net API. ' +
      'This populates the new raidHistory (Midnight expansion) and lockStatus.raids ' +
      '(per-instance lockout breakdown) fields. Runs as a background job.',
    check: async () => {
      const { db } = await connectToDatabase();
      const col = db.collection(process.env.MEMBERS_COLLECTION_NAME);

      const total = await col.countDocuments({});
      if (total === 0) {
        return { needed: false, reason: 'No guild members in database yet' };
      }

      const withRaids = await col.countDocuments({ 'lockStatus.raids': { $exists: true } });
      const withRaidHistory = await col.countDocuments({
        'raidHistory.instances': { $exists: true, $not: { $size: 0 } },
      });

      if (withRaids >= total && withRaidHistory >= total) {
        return {
          needed: false,
          reason: `All ${total} members have up-to-date raid data`,
        };
      }

      return {
        needed: true,
        reason:
          `${total - withRaids}/${total} members missing lockStatus.raids; ` +
          `${total - withRaidHistory}/${total} missing raidHistory data`,
      };
    },
    run: async () => {
      const host = process.env.HOST || 'localhost';
      const port = process.env.PORT || 8000;

      const response = await fetch(`http://${host}:${port}/api/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataTypes: ['raid'] }),
      });

      const data = await response.json();

      // 409 = update already in progress, treat as success
      if (!response.ok && response.status !== 409) {
        return {
          success: false,
          message: data.message || 'Failed to start raid resync',
        };
      }

      return {
        success: true,
        message:
          response.status === 409
            ? 'A guild update is already in progress — it will include raid data.'
            : 'Raid data resync started in the background. Monitor progress on the install page.',
        processId: data.processId,
        background: true,
      };
    },
  },

  {
    id: 'resync-tier-data',
    name: 'Re-sync Tier Set Data',
    description:
      'Re-fetches equipment data for all guild members to update tier set detection ' +
      'against the current CURRENT_SEASON_TIER_SETS configuration. Run this after ' +
      'updating the tier set list in settings.',
    check: async () => {
      const { db } = await connectToDatabase();
      const col = db.collection(process.env.MEMBERS_COLLECTION_NAME);
      const total = await col.countDocuments({});

      if (total === 0) {
        return { needed: false, reason: 'No guild members in database yet' };
      }

      const settings = await getAppSettings();
      const tierSets = settings?.CURRENT_SEASON_TIER_SETS || [];

      if (tierSets.length === 0) {
        return {
          needed: false,
          reason: 'No tier sets configured in CURRENT_SEASON_TIER_SETS — update settings first',
        };
      }

      return {
        needed: true,
        reason: `Will re-check tier set status for all ${total} members against ${tierSets.length} configured tier sets`,
      };
    },
    run: async () => {
      const host = process.env.HOST || 'localhost';
      const port = process.env.PORT || 8000;

      // Equipment is included in the default guild update - we don't need a separate dataType
      const response = await fetch(`http://${host}:${port}/api/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataTypes: ['raid', 'mplus', 'pvp'] }),
      });

      const data = await response.json();

      if (!response.ok && response.status !== 409) {
        return {
          success: false,
          message: data.message || 'Failed to start guild resync',
        };
      }

      return {
        success: true,
        message:
          response.status === 409
            ? 'A guild update is already in progress.'
            : 'Full guild resync started (includes equipment/tier data). Monitor on the install page.',
        processId: data.processId,
        background: true,
      };
    },
  },
];

/* ─── GET /api/upgrade/status ────────────────────────────────── */
router.get('/status', verifyAdmin, async (req, res) => {
  try {
    const migrationStatus = await Promise.all(
      MIGRATIONS.map(async (migration) => {
        try {
          const check = await migration.check();
          return {
            id: migration.id,
            name: migration.name,
            description: migration.description,
            needed: check.needed,
            reason: check.reason,
          };
        } catch (error) {
          return {
            id: migration.id,
            name: migration.name,
            description: migration.description,
            needed: false,
            reason: null,
            error: error.message,
          };
        }
      })
    );

    const pendingCount = migrationStatus.filter((m) => m.needed).length;

    res.json({
      success: true,
      migrations: migrationStatus,
      summary: {
        total: MIGRATIONS.length,
        pending: pendingCount,
        upToDate: MIGRATIONS.length - pendingCount,
      },
    });
  } catch (error) {
    await logError({ type: 'api', endpoint: '/api/upgrade/status', error, context: {} });
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ─── POST /api/upgrade/run/:migrationId ─────────────────────── */
router.post('/run/:migrationId', verifyAdmin, async (req, res) => {
  const { migrationId } = req.params;
  const migration = MIGRATIONS.find((m) => m.id === migrationId);

  if (!migration) {
    return res.status(404).json({
      success: false,
      message: `Migration "${migrationId}" not found`,
    });
  }

  try {
    console.log(`🔧 Running migration "${migrationId}" by admin: ${req.admin.username}`);
    const result = await migration.run(req.app.get('io'));

    await logError({
      type: 'admin-action',
      endpoint: `/api/upgrade/run/${migrationId}`,
      error: new Error(`Migration run: ${migrationId}`),
      context: { username: req.admin.username, ip: req.ip, result },
    });

    res.json({ success: true, migration: migrationId, ...result });
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: `/api/upgrade/run/${migrationId}`,
      error,
      context: { migrationId, admin: req.admin.username },
    });
    res.status(500).json({ success: false, message: error.message });
  }
});

/* ─── POST /api/upgrade/run-all ──────────────────────────────── */
router.post('/run-all', verifyAdmin, async (req, res) => {
  try {
    console.log(`🔧 Running all pending migrations by admin: ${req.admin.username}`);
    const results = [];

    for (const migration of MIGRATIONS) {
      let check;
      try {
        check = await migration.check();
      } catch (error) {
        results.push({
          id: migration.id,
          name: migration.name,
          skipped: true,
          reason: `Check failed: ${error.message}`,
        });
        continue;
      }

      if (!check.needed) {
        results.push({
          id: migration.id,
          name: migration.name,
          skipped: true,
          reason: check.reason,
        });
        continue;
      }

      try {
        const result = await migration.run(req.app.get('io'));
        results.push({ id: migration.id, name: migration.name, ...result });
      } catch (error) {
        results.push({
          id: migration.id,
          name: migration.name,
          success: false,
          message: error.message,
        });
      }
    }

    await logError({
      type: 'admin-action',
      endpoint: '/api/upgrade/run-all',
      error: new Error('Run-all migrations executed'),
      context: { username: req.admin.username, ip: req.ip, results },
    });

    res.json({ success: true, results });
  } catch (error) {
    await logError({ type: 'api', endpoint: '/api/upgrade/run-all', error, context: {} });
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
