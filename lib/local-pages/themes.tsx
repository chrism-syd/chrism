import type { CSSProperties } from 'react'

export type LocalPageThemeKey =
  | 'default'
  | 'knights_of_columbus'
  | 'parish'
  | 'school'
  | 'custom'

export type LocalPageThemeInput = {
  organizationTypeCode?: string | null
  councilNumber?: string | number | null
  themeKey?: string | null
}

type ThemeColors = {
  primary: string
  primaryDark: string
  secondary: string
  accent: string
  accentDark: string
  softBackground: string
  softBackgroundLight: string
  footerBackground: string
  buttonPrimaryBackground: string
  buttonPrimaryText: string
  buttonSecondaryText: string
}

export type LocalPageTheme = {
  key: LocalPageThemeKey
  className: string
  colors: ThemeColors
  heroBackground: string
}

const DEFAULT_THEME: LocalPageTheme = {
  key: 'default',
  className: 'local-page-theme-default',
  colors: {
    primary: '#5c4a72',
    primaryDark: '#3e3151',
    secondary: '#8fa08c',
    accent: '#f5c84b',
    accentDark: '#d6ad3b',
    softBackground: '#f7f4ea',
    softBackgroundLight: '#fdfcf9',
    footerBackground: '#5c4a72',
    buttonPrimaryBackground: '#f5c84b',
    buttonPrimaryText: '#15121c',
    buttonSecondaryText: '#5c4a72',
  },
  heroBackground: [
    'radial-gradient(circle at 82% 18%, rgba(245, 200, 75, 0.24), transparent 34%)',
    'linear-gradient(135deg, #dfeade 0%, #eee8d6 58%, #f7f3e8 100%)',
  ].join(', '),
}

const KNIGHTS_OF_COLUMBUS_THEME: LocalPageTheme = {
  key: 'knights_of_columbus',
  className: 'local-page-theme-knights',
  colors: {
    primary: '#112866',
    primaryDark: '#071a4d',
    secondary: '#0277d9',
    accent: '#f7b718',
    accentDark: '#e2a501',
    softBackground: '#d7e4f1',
    softBackgroundLight: '#ebf1f8',
    footerBackground: '#071a4d',
    buttonPrimaryBackground: '#f7b718',
    buttonPrimaryText: '#071a4d',
    buttonSecondaryText: '#112866',
  },
  heroBackground: 'linear-gradient(129deg, #071a4d 38.83%, #0277d9 107.53%)',
}

const PARISH_THEME: LocalPageTheme = {
  ...DEFAULT_THEME,
  key: 'parish',
  className: 'local-page-theme-parish',
}

const SCHOOL_THEME: LocalPageTheme = {
  ...DEFAULT_THEME,
  key: 'school',
  className: 'local-page-theme-school',
}

const CUSTOM_THEME: LocalPageTheme = {
  ...DEFAULT_THEME,
  key: 'custom',
  className: 'local-page-theme-custom',
}

export const LOCAL_PAGE_THEMES: Record<LocalPageThemeKey, LocalPageTheme> = {
  default: DEFAULT_THEME,
  knights_of_columbus: KNIGHTS_OF_COLUMBUS_THEME,
  parish: PARISH_THEME,
  school: SCHOOL_THEME,
  custom: CUSTOM_THEME,
}

function normalizeThemeKey(value?: string | null): LocalPageThemeKey | null {
  if (!value) return null

  if (value in LOCAL_PAGE_THEMES) {
    return value as LocalPageThemeKey
  }

  return null
}

export function getLocalPageTheme(input: LocalPageThemeInput = {}): LocalPageTheme {
  const explicitThemeKey = normalizeThemeKey(input.themeKey)
  if (explicitThemeKey) return LOCAL_PAGE_THEMES[explicitThemeKey]

  const organizationThemeKey = normalizeThemeKey(input.organizationTypeCode)
  if (organizationThemeKey) return LOCAL_PAGE_THEMES[organizationThemeKey]

  if (input.councilNumber) return LOCAL_PAGE_THEMES.knights_of_columbus

  return LOCAL_PAGE_THEMES.default
}

function localPageThemeVars(theme: LocalPageTheme): CSSProperties {
  return {
    '--local-page-primary': theme.colors.primary,
    '--local-page-primary-dark': theme.colors.primaryDark,
    '--local-page-secondary': theme.colors.secondary,
    '--local-page-accent': theme.colors.accent,
    '--local-page-accent-dark': theme.colors.accentDark,
    '--local-page-soft-bg': theme.colors.softBackground,
    '--local-page-soft-bg-light': theme.colors.softBackgroundLight,
    '--local-page-footer-bg': theme.colors.footerBackground,
    '--local-page-button-primary-bg': theme.colors.buttonPrimaryBackground,
    '--local-page-button-primary-text': theme.colors.buttonPrimaryText,
    '--local-page-button-secondary-text': theme.colors.buttonSecondaryText,
    '--local-page-hero-bg': theme.heroBackground,
    '--qv-plum': theme.colors.primaryDark,
  } as CSSProperties
}

export function LocalPageThemeStyle({ theme }: { theme: LocalPageTheme }) {
  return (
    <style>{`
      .local-page.${theme.className} {
        ${Object.entries(localPageThemeVars(theme))
          .map(([key, value]) => `${key}: ${value};`)
          .join('\n        ')}
      }

      .local-page.${theme.className} .local-page-hero {
        color: white;
        background: var(--local-page-hero-bg);
        border-bottom-color: color-mix(in srgb, var(--local-page-accent) 38%, transparent);
      }

      .local-page.${theme.className} .local-page-hero {
        --text-secondary: rgba(255, 255, 255, 0.86);
      }

      .local-page.${theme.className} .local-page-hero .qv-button-primary {
        background: var(--local-page-button-primary-bg);
        border-color: var(--local-page-button-primary-bg);
        color: var(--local-page-button-primary-text);
        box-shadow: 0 14px 30px color-mix(in srgb, var(--local-page-primary-dark) 24%, transparent);
      }

      .local-page.${theme.className} .qv-button-secondary {
        border-color: var(--local-page-primary);
        color: var(--local-page-button-secondary-text);
      }

      .local-page.${theme.className} .qv-button-secondary:hover,
      .local-page.${theme.className} .qv-button-secondary:focus-visible {
        border-color: var(--local-page-primary-dark);
        color: var(--local-page-primary-dark);
      }

      .local-page.${theme.className} .local-page-story-visual {
        border-color: color-mix(in srgb, var(--local-page-accent) 42%, transparent);
      }

      .local-page.${theme.className} .local-page-story-card,
      .local-page.${theme.className} .local-page-contact-copy {
        border-color: color-mix(in srgb, var(--local-page-primary) 16%, transparent);
        background:
          radial-gradient(circle at 92% 8%, rgba(255, 255, 255, 0.58), transparent 26%),
          linear-gradient(135deg, var(--local-page-soft-bg-light) 0%, var(--local-page-soft-bg) 100%);
      }

      .local-page.${theme.className} footer {
        border-top: 4px solid var(--local-page-accent);
      }
    `}</style>
  )
}
