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
import DonorRegistrationPage from './features/penyantun/DonorRegistrationPage';
import PicPenyantunPoolPage from './features/penyantun/PicPenyantunPoolPage';
import PairingPage from './features/penyantun/PairingPage';
import AjukanPencairanPage from './features/keuangan/AjukanPencairanPage';
import SusunBatchPage from './features/keuangan/SusunBatchPage';
import ApprovalBatchPage from './features/keuangan/ApprovalBatchPage';
import { useNavigate } from 'react-router-dom';
import BendaharaGerejaPage from './features/keuangan/BendaharaGerejaPage';
import ApproverGerejaPage from './features/keuangan/ApproverGerejaPage';
import CatatRealisasiPage from './features/keuangan/CatatRealisasiPage';
import DashboardKasPage from './features/keuangan/DashboardKasPage';
import PinjamanPage from './features/keuangan/PinjamanPage';
import DashboardPenyantunPage from './features/penyantun/DashboardPenyantunPage';
import UploadRaporPage from './features/anak/UploadRaporPage';
import VerifikasiRaporPage from './features/anak/VerifikasiRaporPage';
import RelayKomentarPage from './features/anak/RelayKomentarPage';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { profile, loading: profileLoading } = useUserProfile(session);
  const navigate = useNavigate();

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
          <Link to="/daftar-penyantun" className="text-blue-600">Daftar Penyantun</Link>
          <Link to="/pool-penyantun" className="text-blue-600">Pool Penyantun</Link>
          <Link to="/pairing" className="text-blue-600">Pairing</Link>
          <Link to="/ajukan-pencairan" className="text-blue-600">Ajukan Pencairan</Link>
          <Link to="/susun-batch" className="text-blue-600">Susun Batch</Link>
          <Link to="/approval-batch" className="text-blue-600">Approval Batch</Link>
          <Link to="/batch-gereja" className="text-blue-600">Batch Gereja</Link>
          <Link to="/batch-transfer" className="text-blue-600">Batch Transfer</Link>
          <Link to="/catat-realisasi" className="text-blue-600">Catat Santunan</Link>
          <Link to="/dashboard-kas" className="text-blue-600">Dashboard Kas</Link>
          <Link to="/pinjaman" className="text-blue-600">Pinjaman</Link>
          <Link to="/dashboard-penyantun" className="text-blue-600">Dashboard Saya</Link>
          <Link to="/upload-rapor" className="text-blue-600">Upload Rapor</Link>
          <Link to="/verifikasi-rapor" className="text-blue-600">Verifikasi Rapor</Link>
          <Link to="/relay-komentar" className="text-blue-600">Relay Komentar</Link>
          <button onClick={async () => { await supabase.auth.signOut(); navigate('/'); }}>Keluar</button>
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
        <Route path="/daftar-penyantun" element={<DonorRegistrationPage />} />
        <Route path="/pool-penyantun" element={<PicPenyantunPoolPage />} />
        <Route path="/pairing" element={<PairingPage />} />
        <Route path="/ajukan-pencairan" element={<AjukanPencairanPage />} />
        <Route path="/susun-batch" element={<SusunBatchPage />} />
        <Route path="/approval-batch" element={<ApprovalBatchPage />} />
        <Route path="/batch-gereja" element={<BendaharaGerejaPage />} />
        <Route path="/batch-transfer" element={<ApproverGerejaPage />} />
        <Route path="/catat-realisasi" element={<CatatRealisasiPage />} />
        <Route path="/dashboard-kas" element={<DashboardKasPage />} />
        <Route path="/pinjaman" element={<PinjamanPage />} />
        <Route path="/dashboard-penyantun" element={<DashboardPenyantunPage />} />
        <Route path="/upload-rapor" element={<UploadRaporPage />} />
        <Route path="/verifikasi-rapor" element={<VerifikasiRaporPage />} />
        <Route path="/relay-komentar" element={<RelayKomentarPage />} />
      </Routes>
    </div>
  );
}

export default App;