export function getOtpErrorMessage(error: unknown) {
  const rawMessage =
    typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : ''

  const message = rawMessage.trim().toLowerCase()

  if (!message) {
    return 'We could not verify that code. Please try again.'
  }

  if (
    message.includes('expired')
    || message.includes('invalid')
    || message.includes('otp')
  ) {
    return 'That code has expired or was already used. Send yourself a new code and try again.'
  }

  if (message.includes('rate limit')) {
    return 'You have tried a few times in a row. Please wait a moment, then try again.'
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'We could not reach the verification service just now. Please check your connection and try again.'
  }

  return rawMessage || 'We could not verify that code. Please try again.'
}

export function getOtpSendErrorMessage(error: unknown) {
  const rawMessage =
    typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : ''

  const message = rawMessage.trim().toLowerCase()

  if (!message) {
    return 'We could not send a verification code. Please try again.'
  }

  if (message.includes('signups not allowed for otp')) {
    return 'We could not send a code for that email. Try the email already connected to your account, or ask an administrator for help.'
  }

  if (message.includes('rate limit')) {
    return 'You have requested a few codes in a row. Please wait a moment, then try again.'
  }

  if (message.includes('invalid email')) {
    return 'Please enter a valid email address.'
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'We could not reach the verification service just now. Please check your connection and try again.'
  }

  return rawMessage || 'We could not send a verification code. Please try again.'
}
