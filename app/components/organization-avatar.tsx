'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'

type Props = {
  displayName: string
  logoPath?: string | null
  logoStoragePath?: string | null
  logoAltText?: string | null
  fallbackLogoPath?: string | null
  size?: number
  title?: string
}

const STOP_WORDS = new Set(['of', 'the', 'and', 'at', 'for', 'de', 'du', 'la'])

function buildInitials(displayName: string) {
  const tokens = displayName
    .split(/\s+/)
    .map((token) => token.replace(/[^A-Za-z0-9']/g, '').trim())
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token.toLowerCase()))

  if (tokens.length === 0) return '??'

  return tokens
    .slice(0, 2)
    .map((token) => token.charAt(0).toUpperCase())
    .join('')
}

function normalizeLogoSrc(rawLogoPath?: string | null) {
  if (!rawLogoPath) return null

  const trimmed = rawLogoPath.trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (trimmed.startsWith('/')) {
    return trimmed
  }

  const withoutPublicPrefix = trimmed.replace(/^public\//i, '')
  const normalized = withoutPublicPrefix.replace(/^organizations\//i, 'organizations/')

  if (normalized.startsWith('organizations/')) {
    return `/${normalized}`
  }

  return `/organizations/${normalized}`
}

export default function OrganizationAvatar({
  displayName,
  logoPath,
  logoStoragePath,
  logoAltText,
  fallbackLogoPath,
  size = 72,
  title,
}: Props) {
  const [failedPrimary, setFailedPrimary] = useState(false)
  const [failedFallback, setFailedFallback] = useState(false)
  const initials = useMemo(() => buildInitials(displayName), [displayName])
  const primarySrc = useMemo(() => normalizeLogoSrc(logoPath ?? logoStoragePath), [logoPath, logoStoragePath])
  const fallbackSrc = useMemo(() => normalizeLogoSrc(fallbackLogoPath), [fallbackLogoPath])
  const src = !failedPrimary && primarySrc ? primarySrc : !failedFallback && fallbackSrc ? fallbackSrc : null

  if (src) {
    return (
      <Image
        src={src}
        alt={logoAltText ?? displayName}
        title={title ?? displayName}
        width={size}
        height={size}
        onError={() => {
          if (!failedPrimary && primarySrc && src === primarySrc) {
            setFailedPrimary(true)
            return
          }
          setFailedFallback(true)
        }}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
          flexShrink: 0,
        }}
      />
    )
  }

  return (
    <div
      title={title ?? displayName}
      aria-label={logoAltText ?? displayName}
      style={{
        width: size,
        height: size,
        borderRadius: '999px',
        display: 'grid',
        placeItems: 'center',
        background: 'color-mix(in srgb, var(--interactive) 12%, var(--bg-card))',
        border: '1px solid var(--divider)',
        color: 'var(--interactive)',
        fontSize: Math.max(14, Math.round(size * 0.28)),
        fontWeight: 700,
        letterSpacing: '0.05em',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}
