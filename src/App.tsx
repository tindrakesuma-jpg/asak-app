import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { supabase } from './lib/supabase';
import LoginPage from './features/auth/LoginPage';
import { useUserProfile } from './features/auth/useUserProfile';
import NavBar from './components/NavBar';

import DonorRegistrationPage from './features/penyantun/DonorRegistrationPage';

import FormBPage from './features/pendaftaran/FormBPage';
import TinjauFormBPage from './features/pendaftaran/TinjauFormBPage';
import FormAPage from './features/pendaftaran/FormAPage';
import AntrianSurveyPage from './features/anak/AntrianSurveyPage';
import SurveyFormPage from './features/anak/SurveyFormPage';
import RapatKeputusanPage from './features/anak/RapatKeputusanPage';
import KeputusanDetailPage from './features/anak/KeputusanDetailPage';
import PicPoolPage from './features/anak/PicPoolPage';
import UploadRaporPage from './features/anak/UploadRaporPage';
import VerifikasiRaporPage from './features/anak/VerifikasiRaporPage';
import RelayKomentarPage from './features/anak/RelayKomentarPage';

import PicPenyantunPoolPage from './features/penyantun/PicPenyantunPoolPage';
import PairingPage from './features/penyantun/PairingPage';
import DashboardPenyantunPage from './features/penyantun/DashboardPenyantunPage';

import AjukanPencairanPage from './features/keuangan/AjukanPencairanPage';
import SusunBatchPage from './features/keuangan/SusunBatchPage';
import ApprovalBatchPage from './features/keuangan/ApprovalBatchPage';
import BendaharaGerejaPage from './features/keuangan/BendaharaGerejaPage';
import ApproverGerejaPage from './features/keuangan/ApproverGerejaPage';
import CatatRealisasiPage from './features/keuangan/CatatRealisasiPage';
import DashboardKasPage from './features/keuangan/DashboardKasPage';
import PinjamanPage from './features/keuangan/PinjamanPage';
import KetuaDashboardPage from './features/ketua/KetuaDashboardPage';

import BuatJadwalRapatPage from './features/rapat/BuatJadwalRapatPage';
import PresensiRapatPage from './features/rapat/PresensiRapatPage';

import MenungguFormAPage from './features/anak/MenungguFormAPage';
import RiwayatFormBPage from './features/pendaftaran/RiwayatFormBPage';

import type { Session } from '@supabase/supabase-js';

function AuthenticatedApp() {
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
      <NavBar name={profile.name} roleName={profile.roleName} />
      <Routes>
        <Route path="/" element={<p className="text-center mt-16">Selamat datang, {profile.name}</p>} />
        <Route path="/form-b" element={<FormBPage />} />
        <Route path="/tinjau-form-b" element={<TinjauFormBPage />} />
        <Route path="/form-a/:id" element={<FormAPage />} />
        <Route path="/antrian-survey" element={<AntrianSurveyPage />} />
        <Route path="/survey/:id" element={<SurveyFormPage />} />
        <Route path="/rapat-keputusan" element={<RapatKeputusanPage />} />
        <Route path="/keputusan/:applicationId" element={<KeputusanDetailPage />} />
        <Route path="/pic-pool" element={<PicPoolPage />} />
        <Route path="/upload-rapor" element={<UploadRaporPage />} />
        <Route path="/verifikasi-rapor" element={<VerifikasiRaporPage />} />
        <Route path="/relay-komentar" element={<RelayKomentarPage />} />
        <Route path="/daftar-penyantun" element={<DonorRegistrationPage />} />
        <Route path="/pool-penyantun" element={<PicPenyantunPoolPage />} />
        <Route path="/pairing" element={<PairingPage />} />
        <Route path="/dashboard-penyantun" element={<DashboardPenyantunPage />} />
        <Route path="/ajukan-pencairan" element={<AjukanPencairanPage />} />
        <Route path="/susun-batch" element={<SusunBatchPage />} />
        <Route path="/approval-batch" element={<ApprovalBatchPage />} />
        <Route path="/batch-gereja" element={<BendaharaGerejaPage />} />
        <Route path="/batch-transfer" element={<ApproverGerejaPage />} />
        <Route path="/catat-realisasi" element={<CatatRealisasiPage />} />
        <Route path="/dashboard-kas" element={<DashboardKasPage />} />
        <Route path="/pinjaman" element={<PinjamanPage />} />
        <Route path="/dashboard-ketua" element={<KetuaDashboardPage />} />
        <Route path="/buat-jadwal-rapat" element={<BuatJadwalRapatPage />} />
        <Route path="/presensi-rapat" element={<PresensiRapatPage />} />
        <Route path="/menunggu-form-a" element={<MenungguFormAPage />} />
        <Route path="/riwayat-form-b" element={<RiwayatFormBPage />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Rute PUBLIK — tanpa login sama sekali */}
      <Route path="/daftar-penyantun-baru" element={<DonorRegistrationPage />} />

      {/* Semua rute lain wajib login */}
      <Route path="/*" element={<AuthenticatedApp />} />
    </Routes>
  );
}

export default App;