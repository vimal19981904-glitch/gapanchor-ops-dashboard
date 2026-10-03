import { processPendingLeadsMonitoring } from '../lib/lead-monitoring';
import { syncOutlookGraphEnquiries } from '../lib/outlook-graph-sync';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

async function runDaemonLoop() {
  console.log('🚀 Starting GapAnchor Combined 5-Minute Cron Daemon (Graph Sync + Lead Monitoring)...');

  const execute = async () => {
    const timestamp = new Date().toLocaleString('en-IN');
    console.log(`\n⏰ [${timestamp}] Running 5-Minute Automated Cycle...`);
    
    // Step 1: Microsoft Graph Cloud Intake Sync
    try {
      console.log('  📧 [1/2] Syncing Microsoft Graph (contact@gapanchor.com -> Demo enquiry!)...');
      const syncRes = await syncOutlookGraphEnquiries();
      if (syncRes.success) {
        console.log(`  ✅ Graph Sync Successful: ${syncRes.message}`);
      } else {
        console.warn(`  ⚠️ Graph Sync Warning: ${syncRes.error}`);
      }
    } catch (graphErr: any) {
      console.error('  ❌ Graph Sync Exception:', graphErr.message);
    }

    // Step 2: Lead SLA Inactivity Monitoring (4h Initial Breach & 30m Recurring Alerts)
    try {
      console.log('  🔔 [2/2] Checking Pending Leads for SLA Breaches...');
      const res = await processPendingLeadsMonitoring();
      console.log(`  ✅ SLA Monitoring Completed in ${res.executionDurationMs}ms:`);
      console.log(`     - Pending Leads Checked: ${res.leadsCheckedCount}`);
      console.log(`     - First Alerts Sent (4h+ SLA Breach): ${res.firstAlertsSentCount}`);
      console.log(`     - Recurring Alerts Sent (+30m Follow-ups): ${res.recurringAlertsSentCount}`);
      console.log(`     - Status Changes Resolved: ${res.statusChangesDetectedCount}`);
      if (res.errorsEncountered.length > 0) {
        console.warn(`     ⚠️ Alert Errors (${res.errorsEncountered.length}):`, res.errorsEncountered);
      }
    } catch (err) {
      console.error('  ❌ SLA Monitoring Exception:', err);
    }
  };

  // Run immediately on start
  await execute();

  // Schedule every 5 minutes
  setInterval(execute, FIVE_MINUTES_MS);
}

runDaemonLoop();
