import cron from 'node-cron';
import { startGuildUpdate } from './services/guildUpdater.js';
import { hasAppSettings } from './database.js';

console.log('🔧 Cron script loaded successfully');

const cronSchedule = '*/30 * * * *'; // Every 30 minutes

export async function startCron(io) {
  // Check if AppSettings exists before starting cron
  const appSettingsExist = await hasAppSettings();
  if (!appSettingsExist) {
    console.log('⚠️ App settings not initialized. Cron jobs will not start until installation is complete.');
    return;
  }
  
  // // Run guild update immediately on startup
  console.log('🚀 Running initial guild update on startup...');
  startGuildUpdate(['raid', 'mplus', 'pvp'], io)
    .then(result => {
      if (result.success) {
        console.log('✅ Initial guild update completed successfully');
        console.log('📊 Process ID:', result.processId);
        console.log('🎯 Data types:', result.dataTypes);
      } else {
        console.log('❌ Initial guild update failed:', result.error);
        console.log('💬 Message:', result.message);
      }
    })
    .catch(error => {
      console.error('💥 Initial guild update crashed:', error);
    });

  // Schedule regular updates every 30 minutes
  cron.schedule(cronSchedule, async () => {
    console.log('🕐 Running scheduled guild update...');
    const result = await startGuildUpdate(['raid', 'mplus', 'pvp'], io);
    if (result.success) {
      console.log('✅ Scheduled guild update started successfully');
      console.log('📊 Process ID:', result.processId);
      console.log('🎯 Data types:', result.dataTypes);
    } else {
      console.log('❌ Scheduled guild update failed:', result.error);
      console.log('💬 Message:', result.message);
    }
  });
  
  console.log(`⏰ Scheduled guild updates every 30 minutes (cron: ${cronSchedule})`);
  console.log('🎯 Initial update completed, regular schedule active');
}

console.log('📋 Checking if running as standalone script...');
console.log('🔍 import.meta.url:', import.meta.url);
console.log('🔍 process.argv[1]:', process.argv[1]);

// Main execution block for running as standalone script
// Check if this file is being run directly (not imported)
const isMainModule = process.argv[1] && process.argv[1].endsWith('cron.js');

if (isMainModule) {
  console.log('🚀 Starting manual guild update...');
  console.log('📁 Current working directory:', process.cwd());
  console.log('🔍 Checking for required files...');
  
  // Check if required files exist
  const fs = await import('fs');
  const path = await import('path');
  
  const configPath = path.join(process.cwd(), 'app.config.js');
  const guildFetcherPath = path.join(process.cwd(), 'tools/guildFetcher/fetchGuild.mjs');
  
  console.log('📋 Config file path:', configPath);
  console.log('🔧 Guild fetcher path:', guildFetcherPath);
  
  if (!fs.existsSync(configPath)) {
    console.error('❌ Config file not found:', configPath);
    process.exit(1);
  }
  
  if (!fs.existsSync(guildFetcherPath)) {
    console.error('❌ Guild fetcher not found:', guildFetcherPath);
    process.exit(1);
  }
  
  console.log('✅ Required files found');
  
  // Create a mock io object for standalone execution
  const mockIo = {
    emit: (event, data) => {
      console.log(`📡 Emitting ${event}:`, data);
    }
  };
  
  try {
    console.log('🔄 Starting guild update process...');
    
    // Run the guild update immediately
    const result = await startGuildUpdate(['raid', 'mplus', 'pvp'], mockIo);
    
    if (result.success) {
      console.log('✅ Manual guild update completed successfully');
      console.log('📊 Process ID:', result.processId);
      console.log('🎯 Data types:', result.dataTypes);
      process.exit(0);
    } else {
      console.log('❌ Manual guild update failed:', result.error);
      console.log('💬 Message:', result.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Manual guild update crashed:', error);
    console.error('📚 Stack trace:', error.stack);
    process.exit(1);
  }
} else {
  console.log('📋 Script imported as module, not running standalone');
} 