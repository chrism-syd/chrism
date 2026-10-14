import 'server-only'

export type CcicSquareEnvironment = 'sandbox' | 'production'

/** Fail closed: live payments require explicit opt-in in addition to live credentials. */
export function getCcicSquareConfig() {
  const environment = process.env.SQUARE_ENVIRONMENT
  if (environment !== 'sandbox' && environment !== 'production') return null
  if (environment === 'production' && process.env.CCIC_SQUARE_LIVE_PAYMENTS_ENABLED !== 'true') return null
  const applicationId = process.env.SQUARE_APPLICATION_ID || ''
  const locationId = process.env.SQUARE_LOCATION_ID || ''
  const accessToken = process.env.SQUARE_ACCESS_TOKEN || ''
  if (!applicationId || !locationId || !accessToken) return null
  return {
    environment,
    applicationId,
    locationId,
    accessToken,
    apiBase: environment === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com',
  } as const
}
