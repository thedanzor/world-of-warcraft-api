/**
 * @file Route handler for error management endpoints.
 * @module routes/errors
 */

import express from 'express';
import { 
  getErrorLogs, 
  getErrorStats, 
  getErrorById,
  resolveError, 
  deleteError, 
  deleteAllErrors,
  logError 
} from '../database.js';

const router = express.Router();

/**
 * GET /errors - Get error logs with optional filtering.
 * @route GET /errors
 * @query {string} type - Filter by error type
 * @query {string} endpoint - Filter by endpoint
 * @query {boolean} resolved - Filter by resolved status
 * @query {string} severity - Filter by severity
 * @query {number} limit - Limit number of results (default: 100)
 * @returns {Object} JSON response with error logs.
 */
router.get('/', async (req, res) => {
  try {
    const { type, endpoint, resolved, severity, limit = 100 } = req.query;
    
    // Parse resolved parameter
    let resolvedFilter = null;
    if (resolved !== undefined) {
      resolvedFilter = resolved === 'true';
    }
    
    // Parse limit parameter
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid limit parameter',
        message: 'Limit must be a number between 1 and 1000'
      });
    }
    
    const errors = await getErrorLogs({
      type: type || null,
      endpoint: endpoint || null,
      resolved: resolvedFilter,
      severity: severity || null,
      limit: limitNum
    });
    
    res.json({
      success: true,
      errors,
      count: errors.length,
      filters: {
        type: type || null,
        endpoint: endpoint || null,
        resolved: resolvedFilter,
        severity: severity || null,
        limit: limitNum
      }
    });
    
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/errors',
      error: error,
      context: {
        method: req.method,
        url: req.url,
        query: req.query,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch error logs',
      message: error.message
    });
  }
});

/**
 * GET /errors/stats - Get error statistics.
 * @route GET /errors/stats
 * @returns {Object} JSON response with error statistics.
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getErrorStats();
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/errors/stats',
      error: error,
      context: {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch error statistics',
      message: error.message
    });
  }
});

/**
 * GET /errors/:id - Get a specific error log by ID.
 * @route GET /errors/:id
 * @param {string} id - MongoDB ObjectId of the error
 * @returns {Object} JSON response with error details.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Missing error ID',
        message: 'Error ID is required'
      });
    }
    
    const error = await getErrorById(id);
    
    if (!error) {
      return res.status(404).json({
        success: false,
        error: 'Error not found',
        message: `No error found with ID: ${id}`
      });
    }
    
    res.json({
      success: true,
      error
    });
    
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: `/errors/${req.params.id}`,
      error: error,
      context: {
        method: req.method,
        url: req.url,
        params: req.params,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch error details',
      message: error.message
    });
  }
});

/**
 * PUT /errors/:id/resolve - Mark an error as resolved.
 * @route PUT /errors/:id/resolve
 * @param {string} id - MongoDB ObjectId of the error
 * @returns {Object} JSON response with update result.
 */
router.put('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Missing error ID',
        message: 'Error ID is required'
      });
    }
    
    const result = await resolveError(id);
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Error not found',
        message: `No error found with ID: ${id}`
      });
    }
    
    res.json({
      success: true,
      message: 'Error marked as resolved',
      result
    });
    
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: `/errors/${req.params.id}/resolve`,
      error: error,
      context: {
        method: req.method,
        url: req.url,
        params: req.params,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to resolve error',
      message: error.message
    });
  }
});

/**
 * DELETE /errors/:id - Delete a specific error log.
 * @route DELETE /errors/:id
 * @param {string} id - MongoDB ObjectId of the error
 * @returns {Object} JSON response with delete result.
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Missing error ID',
        message: 'Error ID is required'
      });
    }
    
    const result = await deleteError(id);
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Error not found',
        message: `No error found with ID: ${id}`
      });
    }
    
    res.json({
      success: true,
      message: 'Error deleted successfully',
      result
    });
    
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: `/errors/${req.params.id}`,
      error: error,
      context: {
        method: req.method,
        url: req.url,
        params: req.params,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete error',
      message: error.message
    });
  }
});

/**
 * DELETE /errors - Delete multiple error logs with optional filtering.
 * @route DELETE /errors
 * @query {string} type - Delete only errors of specific type
 * @query {boolean} resolved - Delete only resolved/unresolved errors
 * @query {string} severity - Delete only errors of specific severity
 * @returns {Object} JSON response with delete result.
 */
router.delete('/', async (req, res) => {
  try {
    const { type, resolved, severity } = req.query;
    
    console.log('Bulk delete request received:', { type, resolved, severity });
    
    // Parse resolved parameter
    let resolvedFilter = null;
    if (resolved !== undefined) {
      resolvedFilter = resolved === 'true';
    }
    
    // Build delete options
    const deleteOptions = {
      type: type || null,
      resolved: resolvedFilter,
      severity: severity || null
    };
    
    console.log('Delete options:', deleteOptions);
    
    const result = await deleteAllErrors(deleteOptions);
    
    console.log('Delete result:', result);
    
    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} error logs`,
      result,
      filters: deleteOptions
    });
    
  } catch (error) {
    await logError({
      type: 'api',
      endpoint: '/errors',
      error: error,
      context: {
        method: req.method,
        url: req.url,
        query: req.query,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to delete errors',
      message: error.message
    });
  }
});

export default router;
