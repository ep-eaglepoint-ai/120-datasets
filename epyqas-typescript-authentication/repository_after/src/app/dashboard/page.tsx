import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="dashboard-card">
      <h1>Dashboard</h1>
      <p>Welcome, <strong>{session.username}</strong>!</p>
      
      <div style={{ marginTop: '2rem' }}>
        <h3>Your Session Info:</h3>
        <pre style={{ 
          background: '#1a1a1a', 
          padding: '1rem', 
          borderRadius: '0.5rem', 
          marginTop: '1rem',
          fontSize: '0.875rem',
          overflow: 'auto'
        }}>
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>

      <LogoutButton />
    </div>
  );
}
