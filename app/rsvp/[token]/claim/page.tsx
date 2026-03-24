import Link from 'next/link';
import { notFound } from 'next/navigation';
import AppHeader from '@/app/app-header';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadPublicInviteContext } from '@/lib/rsvp/public';
import ClaimStartForm from './claim-start-form';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ClaimPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ submission?: string }>;
};

export default async function ClaimPage({ params, searchParams }: ClaimPageProps) {
  const { token } = await params;
  const { submission } = await searchParams;
  const supabase = createAdminClient();

  const context = await loadPublicInviteContext(supabase, token);

  if (!context || context.event.scope_code !== 'home_council_only') {
    notFound();
  }

  let defaultEmail = context.invite.invite_email ?? '';

  if (submission) {
    const { data } = await supabase
      .from('event_person_rsvps')
      .select('id, primary_email')
      .eq('id', submission)
      .eq('event_id', context.event.id)
      .eq('status_code', 'active')
      .maybeSingle();

    if (data?.id) {
      defaultEmail = data.primary_email ?? defaultEmail;
    }
  }

  const nextPath = `/rsvp/${token}/manage${submission ? `?submission=${encodeURIComponent(submission)}` : ''}`;

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-card">
          <p className="qv-eyebrow">Manage your RSVP</p>
          <h1 className="qv-section-title" style={{ fontSize: 32 }}>
            Confirm your email
          </h1>
          <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
            We will email you a secure sign-in link so you can manage your RSVP without creating a password.
          </p>

          <div style={{ marginTop: 18 }}>
            <ClaimStartForm defaultEmail={defaultEmail} nextPath={nextPath} />
          </div>

          <p style={{ marginTop: 18, fontSize: 14, color: 'var(--text-secondary)' }}>
            Use the email address tied to your RSVP or member record. If we find a match, you will be able to secure and manage it.
          </p>

          <div className="qv-form-actions" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
            <Link href={`/rsvp/${token}`} className="qv-link-button qv-button-secondary">
              Back to RSVP
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
