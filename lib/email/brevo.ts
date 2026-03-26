type BrevoRecipient = {
  email: string
  name?: string | null
}

type SendBrevoTransactionalEmailArgs = {
  to: BrevoRecipient[]
  subject: string
  htmlContent: string
  textContent?: string | null
  replyTo?: BrevoRecipient | null
}

type BrevoApiError = {
  message?: string
  code?: string
}

function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY?.trim()
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim()
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || 'Chrism'

  if (!apiKey) {
    throw new Error('Missing BREVO_API_KEY')
  }

  if (!senderEmail) {
    throw new Error('Missing BREVO_SENDER_EMAIL')
  }

  return {
    apiKey,
    sender: {
      email: senderEmail,
      name: senderName,
    },
  }
}

export async function sendBrevoTransactionalEmail(args: SendBrevoTransactionalEmailArgs) {
  const config = getBrevoConfig()

  if (!args.to.length) {
    throw new Error('At least one recipient is required before sending email.')
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': config.apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: config.sender,
      to: args.to.map((recipient) => ({
        email: recipient.email,
        ...(recipient.name ? { name: recipient.name } : {}),
      })),
      subject: args.subject,
      htmlContent: args.htmlContent,
      ...(args.textContent ? { textContent: args.textContent } : {}),
      ...(args.replyTo?.email
        ? {
            replyTo: {
              email: args.replyTo.email,
              ...(args.replyTo.name ? { name: args.replyTo.name } : {}),
            },
          }
        : {}),
    }),
  })

  if (response.ok) {
    return
  }

  let details: BrevoApiError | null = null

  try {
    details = (await response.json()) as BrevoApiError
  } catch {
    details = null
  }

  const message = details?.message?.trim() || `Brevo email send failed with status ${response.status}`
  throw new Error(message)
}
