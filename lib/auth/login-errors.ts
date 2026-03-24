export function getLoginMessage(error: unknown): string {
  const rawMessage =
    typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : ''

  const message = rawMessage.trim().toLowerCase()

  if (!message) {
    return 'Check your email for your secure sign-in link.'
  }

  if (message.includes('signups not allowed for otp')) {
    return 'We could not send a sign-in link for that email. Try the email already connected to your account, or ask an administrator to help set up your access.'
  }

  if (message.includes('email not confirmed')) {
    return 'Please confirm your email address before trying to sign in again.'
  }

  if (message.includes('invalid email')) {
    return 'Please enter a valid email address.'
  }

  if (message.includes('rate limit') || message.includes('security purposes')) {
    return 'You have tried a few times in a row. Please wait a moment, then try again.'
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'We could not reach the sign-in service just now. Please check your connection and try again.'
  }

  if (message.includes('otp') || message.includes('email')) {
    return 'We could not send your sign-in link just now. Please try again, or use the email address already connected to your account.'
  }

  return 'We could not sign you in just now. Please try again in a moment.'
}
