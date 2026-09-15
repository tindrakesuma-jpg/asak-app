import { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { supabase } from './lib/supabase';
import LoginPage from './features/auth/LoginPage';
import { useUserProfile } from './features/auth/useUserProfile';
import FormBPage from './features/pendaftaran/FormBPage';
import TinjauFormBPage from './features/pendaftaran/TinjauFormBPage';
import FormAPage from './features/pendaftaran/FormAPage';
import AntrianSurveyPage from './features/anak/AntrianSurveyPage';
import SurveyFormPage from './features/anak/SurveyFormPage';
import type { Session } from '@supabase/supabase-js';
import RapatKeputusanPage from './features/anak/RapatKeputusanPage';
import KeputusanDetailPage from './features/anak/KeputusanDetailPage';
import PicPoolPage from './features/anak/PicPoolPage';

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

  if (loading) return <p className="text-center mt-16">Memuat...</p>;
  if (!session) return <LoginPage />;
  if (profileLoading || !profile) return <p className="text-center mt-16">Memuat profil...</p>;

  return (
    <div>
      <nav className="bg-gray-100 px-4 py-3 flex justify-between items-center text-sm">
        <div>
          <strong>{profile.name}</strong> — {profile.roleName}
        </div>
        <div className="flex gap-4">
          <Link to="/form-b" className="text-blue-600">Form B</Link>
          <Link to="/tinjau-form-b" className="text-blue-600">Tinjau Form B</Link>
          <Link to="/antrian-survey" className="text-blue-600">Antrian Survey</Link>
          <Link to="/rapat-keputusan" className="text-blue-600">Rapat Keputusan</Link>
          <Link to="/pic-pool" className="text-blue-600">PIC Anak</Link>
          <button onClick={() => supabase.auth.signOut()}>Keluar</button>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<p className="text-center mt-16">Selamat datang, {profile.name}</p>} />
        <Route path="/form-b" element={<FormBPage />} />
        <Route path="/tinjau-form-b" element={<TinjauFormBPage />} />
        <Route path="/form-a/:id" element={<FormAPage />} />
        <Route path="/antrian-survey" element={<AntrianSurveyPage />} />
        <Route path="/survey/:id" element={<SurveyFormPage />}/>
        <Route path="/rapat-keputusan" element={<RapatKeputusanPage />} />
        <Route path="/keputusan/:applicationId" element={<KeputusanDetailPage />} />
        <Route path="/pic-pool" element={<PicPoolPage />} />
      </Routes>
    </div>
  );
}

export default App;