import { NextResponse } from 'next/server'
import { sendBrevoTransactionalEmail } from '@/lib/email/brevo'
import { createAdminClient } from '@/lib/supabase/admin'

type PublicContactMessageJobRow = {
  id: string
  recipient_email: string
  recipient_label: string | null
  reply_to_email: string
  submitter_name: string
  subject: string
  body_text: string
}

const JOB_LIMIT = 25

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) return false

  const authHeader = request.headers.get('authorization') ?? ''
  return authHeader === `Bearer ${cronSecret}`
}

function textToHtml(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .map((line) => (line ? `<p>${escapeHtml(line)}</p>` : '<br />'))
    .join('')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function processPublicContactMessageJobs() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('local_unit_public_contact_message_jobs')
    .select('id, recipient_email, recipient_label, reply_to_email, submitter_name, subject, body_text')
    .eq('status_code', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(JOB_LIMIT)

  if (error) {
    throw new Error(error.message)
  }

  const jobs = (data ?? []) as PublicContactMessageJobRow[]
  const results: Array<{ id: string; status: 'sent' | 'failed'; error?: string }> = []

  for (const job of jobs) {
    try {
      await admin
        .from('local_unit_public_contact_message_jobs')
        .update({ status_code: 'pending' })
        .eq('id', job.id)
        .eq('status_code', 'pending')

      await sendBrevoTransactionalEmail({
        to: [{ email: job.recipient_email, name: job.recipient_label ?? undefined }],
        subject: job.subject,
        textContent: job.body_text,
        htmlContent: textToHtml(job.body_text),
        replyTo: { email: job.reply_to_email, name: job.submitter_name },
      })

      const { error: sentError } = await admin
        .from('local_unit_public_contact_message_jobs')
        .update({
          status_code: 'sent',
          sent_at: new Date().toISOString(),
          failed_at: null,
          failure_message: null,
        })
        .eq('id', job.id)

      if (sentError) {
        throw new Error(sentError.message)
      }

      results.push({ id: job.id, status: 'sent' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown public contact email failure'
      await admin
        .from('local_unit_public_contact_message_jobs')
        .update({
          status_code: 'failed',
          failed_at: new Date().toISOString(),
          failure_message: message,
        })
        .eq('id', job.id)

      results.push({ id: job.id, status: 'failed', error: message })
    }
  }

  return results
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await processPublicContactMessageJobs()
  return NextResponse.json({ processed: results.length, results })
}

export async function GET(request: Request) {
  return POST(request)
}
