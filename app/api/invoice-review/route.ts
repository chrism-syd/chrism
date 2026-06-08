import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const recipientEmail = 'syd.fernandez@chrism.app'
const maxFileSizeBytes = 10 * 1024 * 1024
const acceptedMimeTypes = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

type BrevoApiError = {
  message?: string
  code?: string
}

function cleanText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function htmlLines(value: string) {
  return escapeHtml(value).replaceAll('\n', '<br />')
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof value === 'object' && value !== null && 'name' in value && 'size' in value && 'arrayBuffer' in value
}

function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY?.trim()
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim()
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || 'Chrism'

  if (!apiKey || !senderEmail) {
    throw new Error('Invoice review email is not configured yet.')
  }

  return {
    apiKey,
    sender: {
      email: senderEmail,
      name: senderName,
    },
  }
}

async function sendBrevoEmail(args: {
  replyToEmail: string
  replyToName: string
  subject: string
  htmlContent: string
  textContent: string
  attachment?: Array<{ name: string; content: string }>
}) {
  const config = getBrevoConfig()

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': config.apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: config.sender,
      to: [{ email: recipientEmail, name: 'Syd Fernandez' }],
      replyTo: { email: args.replyToEmail, name: args.replyToName },
      subject: args.subject,
      htmlContent: args.htmlContent,
      textContent: args.textContent,
      ...(args.attachment ? { attachment: args.attachment } : {}),
    }),
  })

  if (response.ok) return

  let details: BrevoApiError | null = null

  try {
    details = (await response.json()) as BrevoApiError
  } catch {
    details = null
  }

  throw new Error(details?.message?.trim() || `Brevo email send failed with status ${response.status}`)
}

async function sendInvoiceReviewEmail(args: {
  name: string
  email: string
  organization: string
  organizationType: string
  file: File
}) {
  const fileBuffer = Buffer.from(await args.file.arrayBuffer())
  const fileContent = fileBuffer.toString('base64')

  const subject = `Invoice review request from ${args.organization}`
  const textContent = [
    'New invoice review request',
    '',
    `Name: ${args.name}`,
    `Email: ${args.email}`,
    `Org: ${args.organization}`,
    `Org Type: ${args.organizationType}`,
    `File: ${args.file.name}`,
  ].join('\n')

  const htmlContent = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#151515;line-height:1.55;">
      <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.1;margin:0 0 18px;">New invoice review request</h1>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px;">
        <tr><td style="padding:8px 0;color:#64748b;width:130px;">Name</td><td style="padding:8px 0;">${escapeHtml(args.name)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Email</td><td style="padding:8px 0;">${escapeHtml(args.email)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Org</td><td style="padding:8px 0;">${escapeHtml(args.organization)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Org Type</td><td style="padding:8px 0;">${escapeHtml(args.organizationType)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">File</td><td style="padding:8px 0;">${escapeHtml(args.file.name)}</td></tr>
      </table>
    </div>
  `.trim()

  await sendBrevoEmail({
    replyToEmail: args.email,
    replyToName: args.name,
    subject,
    htmlContent,
    textContent,
    attachment: [
      {
        name: args.file.name,
        content: fileContent,
      },
    ],
  })
}

async function sendSchoolsContactEmail(args: {
  name: string
  email: string
  organization: string
  requestDetails: string
}) {
  const subject = `Schools contact request from ${args.organization}`
  const textContent = [
    'New schools contact request',
    '',
    `Name: ${args.name}`,
    `Email: ${args.email}`,
    `Org: ${args.organization}`,
    '',
    'Request:',
    args.requestDetails,
  ].join('\n')

  const htmlContent = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#151515;line-height:1.55;">
      <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.1;margin:0 0 18px;">New schools contact request</h1>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px;">
        <tr><td style="padding:8px 0;color:#64748b;width:130px;">Name</td><td style="padding:8px 0;">${escapeHtml(args.name)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Email</td><td style="padding:8px 0;">${escapeHtml(args.email)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Org</td><td style="padding:8px 0;">${escapeHtml(args.organization)}</td></tr>
      </table>
      <h2 style="font-size:18px;margin:24px 0 8px;">Request</h2>
      <p style="white-space:normal;margin:0;">${htmlLines(args.requestDetails)}</p>
    </div>
  `.trim()

  await sendBrevoEmail({
    replyToEmail: args.email,
    replyToName: args.name,
    subject,
    htmlContent,
    textContent,
  })
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const submissionType = cleanText(formData.get('submissionType')) || 'invoiceReview'
    const name = cleanText(formData.get('name'))
    const email = cleanText(formData.get('email'))
    const organization = cleanText(formData.get('organization'))

    if (submissionType === 'schoolsContact') {
      const requestDetails = cleanText(formData.get('requestDetails'))

      if (!name || !email || !organization || !requestDetails) {
        return NextResponse.json({ error: 'Please complete every field before submitting.' }, { status: 400 })
      }

      await sendSchoolsContactEmail({
        name,
        email,
        organization,
        requestDetails,
      })

      return NextResponse.json({ ok: true })
    }

    const organizationType = cleanText(formData.get('organizationType'))
    const invoice = formData.get('invoice')

    if (!name || !email || !organization || !organizationType) {
      return NextResponse.json({ error: 'Please complete every field before submitting.' }, { status: 400 })
    }

    if (!isUploadedFile(invoice) || invoice.size === 0) {
      return NextResponse.json({ error: 'Please attach an invoice before submitting.' }, { status: 400 })
    }

    if (invoice.size > maxFileSizeBytes) {
      return NextResponse.json({ error: 'Please upload a file under 10 MB.' }, { status: 400 })
    }

    if (invoice.type && !acceptedMimeTypes.has(invoice.type)) {
      return NextResponse.json(
        { error: 'Please upload a PDF, image, spreadsheet, CSV, or document file.' },
        { status: 400 }
      )
    }

    await sendInvoiceReviewEmail({
      name,
      email,
      organization,
      organizationType,
      file: invoice,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to submit your request right now.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
