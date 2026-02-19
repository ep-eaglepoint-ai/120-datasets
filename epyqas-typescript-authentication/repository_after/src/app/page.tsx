import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export default async function IndexPage() {
  const session = await getSession();

  if (session) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
