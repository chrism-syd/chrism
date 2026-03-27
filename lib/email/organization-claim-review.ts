import { sendBrevoTransactionalEmail } from '@/lib/email/brevo'

type SendClaimReviewEmailArgs = {
  toEmail: string
  toName?: string | null
  status: 'approved' | 'rejected'
  councilLabel?: string | null
  reviewNotes?: string | null
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildSubject(args: SendClaimReviewEmailArgs) {
  const base = args.councilLabel ? `${args.councilLabel} access request` : 'Organization access request'
  return args.status === 'approved' ? `${base} approved` : `${base} rejected`
}

function buildText(args: SendClaimReviewEmailArgs) {
  const lead =
    args.status === 'approved'
      ? 'Your organization access request was approved.'
      : 'Your organization access request was rejected.'
  const lines = [lead]

  if (args.councilLabel) {
    lines.push(`Organization: ${args.councilLabel}`)
  }

  if (args.reviewNotes?.trim()) {
    lines.push('')
    lines.push('Reviewer note:')
    lines.push(args.reviewNotes.trim())
  }

  return lines.join('\n')
}

function buildHtml(args: SendClaimReviewEmailArgs) {
  const lead =
    args.status === 'approved'
      ? 'Your organization access request was approved.'
      : 'Your organization access request was rejected.'

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#2f2a36;line-height:1.5;">
      <p>${escapeHtml(lead)}</p>
      ${args.councilLabel ? `<p><strong>Organization:</strong> ${escapeHtml(args.councilLabel)}</p>` : ''}
      ${
        args.reviewNotes?.trim()
          ? `<div style="margin-top:16px;padding:16px;border:1px solid #d8d1ca;border-radius:12px;background:#f6f1ea;">
              <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7a6f66;">Reviewer note</div>
              <div style="margin-top:8px;">${escapeHtml(args.reviewNotes.trim())}</div>
            </div>`
          : ''
      }
    </div>
  `.trim()
}

export async function sendOrganizationClaimReviewEmail(args: SendClaimReviewEmailArgs) {
  await sendBrevoTransactionalEmail({
    to: [{ email: args.toEmail, name: args.toName ?? undefined }],
    subject: buildSubject(args),
    htmlContent: buildHtml(args),
    textContent: buildText(args),
  })
}
