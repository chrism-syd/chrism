import 'server-only'

import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto'

export const CCIC_ADMIN_SESSION_COOKIE = 'ccic_admin_session'
export const CCIC_ADMIN_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60
export const CCIC_ADMIN_CODE_TTL_MINUTES = 10
export const CCIC_ADMIN_MAX_CODE_ATTEMPTS = 5

function getAuthSecret() {
  const secret = process.env.CCIC_ADMIN_AUTH_SECRET?.trim()
  if (!secret) {
    throw new Error('Missing CCIC_ADMIN_AUTH_SECRET.')
  }
  return secret
}

export function normalizeCcicAdminEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || ''
}

export function hashCcicAdminEmail(email: string) {
  return createHash('sha256').update(normalizeCcicAdminEmail(email)).digest('hex')
}

export function generateCcicAdminCode() {
  return String(randomInt(100000, 1000000))
}

export function hashCcicAdminCode(email: string, code: string) {
  return createHmac('sha256', getAuthSecret())
    .update(`${normalizeCcicAdminEmail(email)}:${code}`)
    .digest('hex')
}

export function generateCcicAdminSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashCcicAdminSessionToken(token: string) {
  return createHmac('sha256', getAuthSecret()).update(token).digest('hex')
}

export function ccicAdminCodeExpiry() {
  return new Date(Date.now() + CCIC_ADMIN_CODE_TTL_MINUTES * 60 * 1000).toISOString()
}

export function ccicAdminSessionExpiry() {
  return new Date(Date.now() + CCIC_ADMIN_SESSION_MAX_AGE_SECONDS * 1000).toISOString()
}
