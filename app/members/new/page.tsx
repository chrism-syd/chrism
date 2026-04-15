import AppHeader from '@/app/app-header';
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context';
import MemberForm from '../member-form';

export default async function NewMemberPage() {
  await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/members',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  });

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <p className="qv-eyebrow">People Directory</p>
          <h1 className="qv-title">Add person</h1>
          <p className="qv-subtitle">
            Choose whether this person should start as a member, volunteer, or prospect. Manual members stay
            provisional until matched to an official import.
          </p>
        </section>

        <section className="qv-card">
          <MemberForm mode="create" initialValues={{ primary_relationship_code: 'member' }} cancelHref="/members" />
        </section>
      </div>
    </main>
  );
}
