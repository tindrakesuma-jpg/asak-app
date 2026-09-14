import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import LoginPage from './features/auth/LoginPage';
import Dashboard from './features/auth/Dashboard';
import { useUserProfile } from './features/auth/useUserProfile';
import type { Session } from '@supabase/supabase-js';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { profile, loading: profileLoading } = useUserProfile(session);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return <p style={{ textAlign: 'center', marginTop: 80 }}>Memuat...</p>;
  if (!session) return <LoginPage />;
  if (profileLoading || !profile) return <p style={{ textAlign: 'center', marginTop: 80 }}>Memuat profil...</p>;

  return <Dashboard name={profile.name} roleName={profile.roleName} />;
}

export default App;