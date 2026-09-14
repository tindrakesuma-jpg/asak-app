import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Session } from '@supabase/supabase-js';

type UserProfile = {
  name: string;
  roleName: string;
};

export function useUserProfile(session: Session | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setLoading(false);
      return;
    }

    supabase
      .from('users')
      .select('name, roles(name)')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Gagal ambil profil:', error.message);
          setProfile(null);
        } else if (data) {
          setProfile({
            name: data.name,
            roleName: (data.roles as any)?.name ?? 'Tidak diketahui',
          });
        }
        setLoading(false);
      });
  }, [session]);

  return { profile, loading };
}