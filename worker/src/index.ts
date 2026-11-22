import dotenv from 'dotenv'
import { startEmailSenderWorker } from './jobs/email-sender.js'
import { runAllImapSyncs } from './jobs/imap-sync.js'
import { runFollowUpScheduler } from './jobs/follow-up-scheduler.js'

dotenv.config()

console.log('====================================================')
console.log('🚀 EMMIL BACKGROUND WORKER SERVICE STARTING')
console.log('====================================================')

// 1. Start BullMQ outbound sending queue worker
const emailSenderWorker = startEmailSenderWorker()
console.log('✅ BullMQ Email Sending Worker online')

// 2. Start IMAP Synchronization Loop (every 2 minutes)
const IMAP_SYNC_INTERVAL_MS = parseInt(process.env.IMAP_SYNC_INTERVAL_MS || '120000', 10)
const imapInterval = setInterval(async () => {
  try {
    await runAllImapSyncs()
  } catch (err: any) {
    console.error('❌ IMAP sync loop error:', err.message)
  }
}, IMAP_SYNC_INTERVAL_MS)

// Run initial IMAP sync on startup
runAllImapSyncs().catch((err) => console.warn('Initial IMAP sync warning:', err.message))

// 3. Start Campaign Follow-Up Scheduler Loop (every 1 minute)
const SCHEDULER_INTERVAL_MS = parseInt(process.env.SCHEDULER_INTERVAL_MS || '60000', 10)
const schedulerInterval = setInterval(async () => {
  try {
    await runFollowUpScheduler()
  } catch (err: any) {
    console.error('❌ Follow-up scheduler loop error:', err.message)
  }
}, SCHEDULER_INTERVAL_MS)

// Run initial scheduler check
runFollowUpScheduler().catch((err) => console.warn('Initial scheduler check warning:', err.message))

console.log(`⏱️ IMAP sync scheduled every ${IMAP_SYNC_INTERVAL_MS / 1000}s`)
console.log(`⏱️ Campaign follow-up scheduler running every ${SCHEDULER_INTERVAL_MS / 1000}s`)

// Graceful shutdown
async function shutdown() {
  console.log('\n🛑 Gracefully shutting down worker...')
  clearInterval(imapInterval)
  clearInterval(schedulerInterval)
  await emailSenderWorker.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
