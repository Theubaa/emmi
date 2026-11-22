import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const KEY_LENGTH = 32
const ITERATIONS = 100000

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required to encrypt/decrypt credentials')
  }
  return key
}

/**
 * Encrypt sensitive credential string (e.g. SMTP password or OAuth token)
 */
export function encryptCredential(plainText: string): string {
  const masterKey = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const salt = crypto.randomBytes(SALT_LENGTH)

  const key = crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha512')
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64')
}

/**
 * Decrypt sensitive credential string
 */
export function decryptCredential(cipherText: string): string {
  const masterKey = getEncryptionKey()
  const buffer = Buffer.from(cipherText, 'base64')

  const salt = buffer.subarray(0, SALT_LENGTH)
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH)
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH)

  const key = crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha512')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return decipher.update(encrypted) + decipher.final('utf8')
}
