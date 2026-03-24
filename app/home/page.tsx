import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AppHeader from '@/app/app-header';
import { getCurrentUserPermissions } from '@/lib/auth/permissions';

export const metadata: Metadata = {
  title: 'Chrism',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MemberBridgePage() {
  const permissions = await getCurrentUserPermissions();

  if (!permissions.authUser) {
    redirect('/login');
  }

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />
      </div>
    </main>
  );
}
