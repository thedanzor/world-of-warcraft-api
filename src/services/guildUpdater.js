// Store active guild update processes
const activeProcesses = new Map();

/**
 * Starts a guild update process if one is not already running.
 * @param {Array} dataTypes - Types of data to update (e.g., ['raid', 'mplus', 'pvp'])
 * @param {object} io - Optional Socket.IO server instance for real-time updates.
 * @returns {Promise<object>} Result of the update process.
 */
export async function startGuildUpdate(dataTypes = ['raid', 'mplus', 'pvp'], io) {
  try {
    if (activeProcesses.size > 0) {
      console.log('Guild update process already running, skipping...');
      return {
        success: false,
        error: 'Guild update process already running'
      };
    }
    // Import the guild fetcher module
    const { startGuildUpdate: fetcherStartGuildUpdate } = await import('../../tools/guildFetcher/fetchGuild.mjs');
    const processId = Date.now().toString();
    const updateProcess = fetcherStartGuildUpdate(dataTypes, processId, io);
    activeProcesses.set(processId, updateProcess);
    updateProcess.then(() => {
      // Optionally emit events via io
    }).catch((error) => {
      console.error('Guild update failed:', error);
    }).finally(() => {
      activeProcesses.delete(processId);
      console.log(`Guild update process ${processId} completed and removed from active processes`);
    });
    console.log(`Guild update process started with ID: ${processId}`);
    return {
      success: true,
      message: 'Guild update process started',
      processId,
      dataTypes
    };
  } catch (error) {
    console.error('Error starting guild update:', error);
    return {
      success: false,
      error: 'Failed to start guild update',
      message: error.message
    };
  }
}

export { activeProcesses }; 