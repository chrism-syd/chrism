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
          <p className="qv-eyebrow">Member Directory</p>
          <h1 className="qv-title">Add member</h1>
          <p className="qv-subtitle">
            Manual entries are created as provisional members until matched to an official import.
          </p>
        </section>

        <section className="qv-card">
          <MemberForm mode="create" initialValues={{}} cancelHref="/members" />
        </section>
      </div>
    </main>
  );
}
