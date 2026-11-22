import { ImapFlow } from 'imapflow'
import { simpleParser, ParsedMail } from 'mailparser'

export interface ImapConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

export function createImapClient(config: ImapConfig): ImapFlow {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    logger: false,
    tls: {
      rejectUnauthorized: false,
    },
  })
}

export interface InboundEmail {
  uid: number
  messageId: string
  inReplyTo?: string
  references?: string[]
  from: {
    name?: string
    address?: string
  }
  to: string[]
  subject: string
  bodyText?: string
  bodyHtml?: string
  date: Date
}

export async function fetchNewEmails(client: ImapFlow, sinceUid = 0): Promise<InboundEmail[]> {
  await client.connect()
  const lock = await client.getMailboxLock('INBOX')

  const results: InboundEmail[] = []

  try {
    const searchRange = sinceUid > 0 ? `${sinceUid + 1}:*` : '1:*'
    const messages = client.fetch(searchRange, {
      uid: true,
      envelope: true,
      source: true,
    })

    for await (const msg of messages) {
      if (msg.source) {
        const parsed: ParsedMail = await simpleParser(msg.source)

        const fromAddress = parsed.from?.value?.[0]?.address || ''
        const fromName = parsed.from?.value?.[0]?.name || ''
        const toAddresses = (parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]) : [])
          .flatMap((addr) => addr.value.map((v) => v.address || ''))
          .filter(Boolean)

        const references = parsed.references
          ? Array.isArray(parsed.references)
            ? parsed.references
            : [parsed.references]
          : []

        results.push({
          uid: msg.uid,
          messageId: parsed.messageId || `<uid-${msg.uid}@emmil.local>`,
          inReplyTo: parsed.inReplyTo || undefined,
          references,
          from: { name: fromName, address: fromAddress },
          to: toAddresses,
          subject: parsed.subject || '(No Subject)',
          bodyText: parsed.text || '',
          bodyHtml: parsed.html || (parsed.text ? `<p>${parsed.text}</p>` : ''),
          date: parsed.date || new Date(),
        })
      }
    }
  } finally {
    lock.release()
    await client.logout()
  }

  return results
}
