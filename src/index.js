import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

// Import routers
import dataFilteredRouter from './routes/data.js';
import statsMissingEnchantsRouter from './routes/statsMissingEnchants.js';
import statsTopPvpRouter from './routes/statsTopPvp.js';
import statsTopPveRouter from './routes/statsTopPve.js';
import statsRoleCountsRouter from './routes/statsRoleCounts.js';
import updateRouter from './routes/update.js';
import statusRouter from './routes/status.js';
import healthRouter from './routes/health.js';
import apiSeason3DataRouter from './routes/apiSeason3Data.js';
import apiSeason3SignupRouter from './routes/apiSeason3Signup.js';
import apiCharacterFetchRouter from './routes/apiCharacterFetch.js';
import apiSeasonalStatsRouter from './routes/apiSeasonalStats.js';
import errorsRouter from './routes/errors.js';
import { logError } from './database.js';
import { startCron } from './cron.js';

import dotenv from 'dotenv';
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 8000;
const host = process.env.HOST || 'localhost';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Register routers
app.use('/api/data', dataFilteredRouter);
app.use('/api/data/filtered', dataFilteredRouter);
app.use('/api/stats/missing-enchants', statsMissingEnchantsRouter);
app.use('/api/stats/top-pvp', statsTopPvpRouter);
app.use('/api/stats/top-pve', statsTopPveRouter);
app.use('/api/stats/role-counts', statsRoleCountsRouter);
app.use('/api/update', updateRouter);
app.use('/api/status', statusRouter);
app.use('/api/health', healthRouter);
app.use('/api/season3/data', apiSeason3DataRouter);
app.use('/api/season3/signup', apiSeason3SignupRouter);
app.use('/api/fetch', apiCharacterFetchRouter);
app.use('/api/seasonal-stats', apiSeasonalStatsRouter);
app.use('/api/errors', errorsRouter);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});


// Error handling middleware
app.use(async (error, req, res, next) => {
  await logError({
    type: 'api',
    endpoint: req.url,
    error: error,
    context: {
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      body: req.body,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    }
  });
  
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start the server and log the port
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});

// Start the cron job for scheduled guild updates
startCron(io);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, server, io };