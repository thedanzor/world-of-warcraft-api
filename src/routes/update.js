/**
 * @file Route handler for /update endpoint.
 * @module routes/update
 */

import express from 'express';
// Import startGuildUpdate from the appropriate module (may need to be refactored to utils.js)

/**
 * POST /update - Starts a guild data update process.
 * @route POST /update
 * @returns {Object} JSON response with update status.
 */
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { dataTypes = ['raid', 'mplus', 'pvp'] } = req.body;
    // const result = await startGuildUpdate(dataTypes);
    // if (result.success) {
    //   return res.json(result);
    // } else {
    //   return res.status(409).json(result);
    // }
    res.json({ success: true, message: 'Stub for update endpoint' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start guild update', message: error.message });
  }
});

export default router; 