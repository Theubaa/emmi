import { Queue, Worker, QueueEvents } from 'bullmq'
import Redis from 'ioredis'
import dotenv from 'dotenv'

dotenv.config()

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

redisConnection.on('error', (err) => {
  console.warn('⚠️ Redis connection notice:', err.message)
})

export const emailSendingQueue = new Queue('email-sending', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
})

export const imapSyncQueue = new Queue('imap-sync', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: true,
  },
})

export interface SendEmailJobData {
  queueItemId?: string
  workspaceId: string
  campaignId: string
  campaignLeadId: string
  sequenceStepId: string
  emailAccountId: string
  leadId: string
  toEmail: string
  fromName: string
  fromEmail: string
  subject: string
  bodyHtml: string
  bodyText: string
  inReplyTo?: string
  references?: string[]
}
