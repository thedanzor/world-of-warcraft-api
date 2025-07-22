import cron from 'node-cron';
import { startGuildUpdate } from './services/guildUpdater.js';

const cronSchedule = '*/30 * * * *'; // Every 30 minutes

export function startCron(io) {
  cron.schedule(cronSchedule, async () => {
    console.log('🕐 Running scheduled guild update...');
    const result = await startGuildUpdate(['raid', 'mplus', 'pvp'], io);
    if (result.success) {
      console.log('✅ Scheduled guild update started successfully');
    } else {
      console.log('❌ Scheduled guild update failed:', result.error);
    }
  });
  console.log(`⏰ Scheduled guild updates every 30 minutes (cron: ${cronSchedule})`);
} 