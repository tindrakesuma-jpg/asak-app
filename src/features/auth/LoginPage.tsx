import { useState } from 'react';
import { supabase } from '../../lib/supabase';

const ROLES = [
  'BendaharaASAK',
  'KetuaASAK',
  'BendaharaGereja',
  'ApproverGereja',
  'TimAnakASAK',
  'TimPenyantunASAK',
  'SekretarisASAK',
  'SuperAdminASAK',
  'PenyantunASAK',
];

const INTERIM_PASSWORD = 'ASAK2026';

export default function LoginPage() {
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loginAsRole(role: string) {
    setLoadingRole(role);
    setErrorMsg(null);

    const email = `placeholder.${role.toLowerCase()}@asak.internal`;
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: INTERIM_PASSWORD,
    });

    setLoadingRole(null);
    if (error) {
      setErrorMsg(`Login gagal untuk ${role}: ${error.message}`);
    }
    // Kalau sukses, tidak perlu ngapa-ngapain lagi di sini —
    // App.tsx akan otomatis mendeteksi sesi login berubah.
  }

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center' }}>ASAK Paroki Serpong</h1>
      <p style={{ textAlign: 'center', color: '#555' }}>
        Pilih peran Anda untuk masuk (login sementara)
      </p>

      {errorMsg && (
        <p style={{ color: 'red', textAlign: 'center' }}>{errorMsg}</p>
      )}

      <div style={{ display: 'grid', gap: 10, marginTop: 24 }}>
        {ROLES.map((role) => (
          <button
            key={role}
            onClick={() => loginAsRole(role)}
            disabled={loadingRole !== null}
            style={{
              padding: '12px 16px',
              fontSize: 16,
              borderRadius: 8,
              border: '1px solid #ccc',
              cursor: 'pointer',
              background: loadingRole === role ? '#eee' : '#fff',
            }}
          >
            {loadingRole === role ? 'Masuk...' : role}
          </button>
        ))}
      </div>
    </div>
  );
}