/**
 * @file Route handler for /data/filtered endpoint.
 * @module routes/dataFiltered
 */

import express from 'express';
import { getAllActiveMembers } from '../database.js';
import { transformCharacterData, applyFilters } from '../utils.js';

/**
 * GET /data/filtered - Returns filtered and paginated guild data.
 * @route GET /data/filtered
 * @returns {Object} JSON response with filtered and paginated guild data.
 */
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const activeMembers = await getAllActiveMembers();
    if (!activeMembers.length) {
      return res.status(404).json({ success: false, error: 'No guild data available' });
    }
    const transformedData = activeMembers.map(transformCharacterData);
    const {
      filter = 'all',
      page = 1,
      limit = 30,
      search = '',
      rankFilter = 'all',
      classFilter = '',
      specFilter = 'all',
      minItemLevel = 0
    } = req.query;
    const filteredData = applyFilters(transformedData, {
      search,
      rankFilter,
      classFilter,
      specFilter,
      minItemLevel,
      filter
    });
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / limit);
    const currentPage = Math.max(1, Math.min(parseInt(page), totalPages));
    const startIndex = (currentPage - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedData = filteredData.slice(startIndex, endIndex);
    const statistics = {
      totalItems,
      totalPages,
      currentPage,
      itemsPerPage: parseInt(limit),
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1
    };
    return res.json({
      success: true,
      data: paginatedData,
      statistics,
      filter,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to read filtered guild data', message: error.message });
  }
});

export default router; 