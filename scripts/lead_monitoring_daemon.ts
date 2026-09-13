import { processPendingLeadsMonitoring } from '../lib/lead-monitoring';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

async function runDaemonLoop() {
  console.log('🚀 Starting GapAnchor Lead Status Monitoring Cron Daemon (Every 5 minutes)...');

  const execute = async () => {
    const timestamp = new Date().toLocaleString('en-IN');
    console.log(`\n⏰ [${timestamp}] Running Lead Monitoring Cron Check...`);
    try {
      const res = await processPendingLeadsMonitoring();
      console.log(`✅ Cron Execution Completed in ${res.executionDurationMs}ms:`);
      console.log(`   - Pending Leads Checked: ${res.leadsCheckedCount}`);
      console.log(`   - First Alerts Sent (4h+): ${res.firstAlertsSentCount}`);
      console.log(`   - Recurring Alerts Sent (+30m): ${res.recurringAlertsSentCount}`);
      console.log(`   - Status Changes Deactivated: ${res.statusChangesDetectedCount}`);
      if (res.errorsEncountered.length > 0) {
        console.warn(`   ⚠️ Errors (${res.errorsEncountered.length}):`, res.errorsEncountered);
      }
    } catch (err) {
      console.error('❌ Cron Daemon Exception:', err);
    }
  };

  // Run immediately on start
  await execute();

  // Schedule every 5 minutes
  setInterval(execute, FIVE_MINUTES_MS);
}

runDaemonLoop();
