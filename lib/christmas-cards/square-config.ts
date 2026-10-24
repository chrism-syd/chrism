import 'server-only'

export type CcicSquareEnvironment = 'sandbox' | 'production'

/** Explicitly approved schools only; independent from the ordering-window gate. */
export function getCcicSchoolSquareEnvironment(schoolSlug: string): CcicSquareEnvironment {
  return (schoolSlug === 'st-francis-xavier' || schoolSlug === 'all-saints') && process.env.SQUARE_ENVIRONMENT === 'production'
    ? 'production'
    : 'sandbox'
}

/**
 * Fail closed for live payments. Sandbox on the production Vercel deployment
 * uses dedicated credentials, never the production access token.
 */
export function getCcicSquareConfig(environment: CcicSquareEnvironment = process.env.SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox') {
  if (environment === 'production' && (process.env.SQUARE_ENVIRONMENT !== 'production' || process.env.CCIC_SQUARE_LIVE_PAYMENTS_ENABLED !== 'true')) return null
  if (process.env.SQUARE_ENVIRONMENT !== 'sandbox' && process.env.SQUARE_ENVIRONMENT !== 'production') return null
  const sandboxOnProduction = environment === 'sandbox' && process.env.SQUARE_ENVIRONMENT === 'production'
  const applicationId = (sandboxOnProduction ? process.env.SQUARE_SANDBOX_APPLICATION_ID : process.env.SQUARE_APPLICATION_ID) || ''
  const locationId = (sandboxOnProduction ? process.env.SQUARE_SANDBOX_LOCATION_ID : process.env.SQUARE_LOCATION_ID) || ''
  const accessToken = (sandboxOnProduction ? process.env.SQUARE_SANDBOX_ACCESS_TOKEN : process.env.SQUARE_ACCESS_TOKEN) || ''
  if (!applicationId || !locationId || !accessToken) return null
  return {
    environment,
    applicationId,
    locationId,
    accessToken,
    apiBase: environment === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com',
  } as const
}
