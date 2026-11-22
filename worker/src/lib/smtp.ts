import nodemailer from 'nodemailer'
import { decryptCredential } from './crypto.js'

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
}

export function createSmtpTransporter(config: SmtpConfig) {
  return nodemailer.createTransporter({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false, // Prevents self-signed cert blocks on custom corporate mail servers
    },
  })
}

export interface SendMailOptions {
  from: string
  to: string
  subject: string
  text: string
  html: string
  replyTo?: string
  messageId?: string
  inReplyTo?: string
  references?: string[]
}

export async function sendEmailViaSmtp(transporter: nodemailer.Transporter, options: SendMailOptions) {
  const mailOptions: any = {
    from: options.from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    replyTo: options.replyTo,
    headers: {
      'X-Mailer': 'Emmil Outreach Engine v1.0',
    },
  }

  if (options.messageId) {
    mailOptions.messageId = options.messageId
  }
  if (options.inReplyTo) {
    mailOptions.inReplyTo = options.inReplyTo
  }
  if (options.references && options.references.length > 0) {
    mailOptions.references = options.references
  }

  return await transporter.sendMail(mailOptions)
}
