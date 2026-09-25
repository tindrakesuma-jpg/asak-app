import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

type MenuItem = { path: string; label: string; roles: string[] };

const MENU_ITEMS: MenuItem[] = [
  { path: '/dashboard-ketua', label: '📊 Dashboard Ketua', roles: ['KetuaASAK'] },
  { path: '/form-b', label: 'Form B', roles: ['KetuaLingkungan'] },
  { path: '/tinjau-form-b', label: 'Tinjau Form B', roles: ['TimAnakASAK'] },
  { path: '/antrian-survey', label: 'Antrian Survey', roles: ['TimAnakASAK'] },
  { path: '/rapat-keputusan', label: 'Rapat Keputusan', roles: ['TimAnakASAK', 'KetuaASAK'] },
  { path: '/pic-pool', label: 'PIC Anak', roles: ['TimAnakASAK'] },
  { path: '/upload-rapor', label: 'Upload Rapor', roles: ['TimAnakASAK'] },
  { path: '/verifikasi-rapor', label: 'Verifikasi Rapor', roles: ['TimAnakASAK'] },
  { path: '/relay-komentar', label: 'Relay Komentar', roles: ['TimAnakASAK'] },

  { path: '/daftar-penyantun', label: 'Daftar Penyantun (Internal)', roles: ['TimPenyantunASAK', 'SekretarisASAK'] },
  { path: '/pool-penyantun', label: 'Pool Penyantun', roles: ['TimPenyantunASAK'] },
  { path: '/pairing', label: 'Pairing', roles: ['TimPenyantunASAK'] },
  { path: '/dashboard-penyantun', label: 'Dashboard Saya', roles: ['PenyantunASAK'] },

  { path: '/ajukan-pencairan', label: 'Ajukan Pencairan', roles: ['BendaharaASAK'] },
  { path: '/susun-batch', label: 'Susun Batch', roles: ['BendaharaASAK'] },
  { path: '/approval-batch', label: 'Approval Batch', roles: ['KetuaASAK'] },
  { path: '/batch-gereja', label: 'Batch Gereja', roles: ['BendaharaGereja'] },
  { path: '/batch-transfer', label: 'Batch Transfer', roles: ['ApproverGereja'] },
  { path: '/catat-realisasi', label: 'Catat Santunan', roles: ['BendaharaASAK'] },
  { path: '/dashboard-kas', label: 'Dashboard Kas', roles: ['BendaharaASAK', 'KetuaASAK'] },
  { path: '/pinjaman', label: 'Pinjaman', roles: ['BendaharaASAK'] },

  { path: '/buat-jadwal-rapat', label: '📅 Buat Jadwal Rapat', roles: ['KetuaASAK', 'SekretarisASAK'] },
  { path: '/presensi-rapat', label: '📅 Jadwal Rapat', roles: ['TimAnakASAK', 'BendaharaASAK', 'SekretarisASAK', 'KetuaASAK', 'TimPenyantunASAK'] },
  { path: '/menunggu-form-a', label: 'Menunggu Form A', roles: ['TimAnakASAK'] },
  { path: '/riwayat-form-b', label: 'Riwayat Pengajuan Saya', roles: ['KetuaLingkungan'] },
  { path: '/tindak-lanjut', label: 'Tindak Lanjut Saya', roles: ['TimAnakASAK'] },
  { path: '/terbitkan-sk', label: 'Terbitkan SK', roles: ['SekretarisASAK'] },
  { path: '/kelola-form-h', label: 'Kelola Form H', roles: ['TimAnakASAK'] },
  { path: '/status-semua-anak', label: '📊 Status Semua Anak', roles: ['TimAnakASAK', 'KetuaASAK'] },
  { path: '/tracker-due-penyantun', label: '📋 Tracker Due Penyantun', roles: ['TimPenyantunASAK', 'BendaharaASAK', 'KetuaASAK'] },
];

export default function NavBar({ name, roleName }: { name: string; roleName: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const visibleItems =
    roleName === 'SuperAdminASAK'
      ? MENU_ITEMS
      : MENU_ITEMS.filter((item) => item.roles.includes(roleName));

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/');
  }

  return (
    <nav className="bg-gray-100 border-b">
      <div className="px-4 py-3 flex justify-between items-center">
        <div className="text-sm">
          <strong>{name}</strong> <span className="text-gray-500">— {roleName}</span>
        </div>
        <div className="flex items-center gap-3">
        <Link
            to="/ringkasan-wa"
            className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center text-white text-lg"
            title="Ringkasan WhatsApp Group"
            >
                💬
        </Link>
            <button onClick={() => setOpen(!open)} className="text-sm bg-white border rounded-lg px-3 py-1.5">
                Menu {open ? '▲' : '▼'}
            </button>
            <button onClick={handleLogout} className="text-sm text-gray-600">Keluar</button>
        </div>
       </div>

      {open && (
        <div className="px-4 pb-4">
          {visibleItems.length === 0 && (
            <p className="text-sm text-gray-500">Tidak ada menu untuk peran ini.</p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {visibleItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className="text-sm bg-white border rounded-lg px-3 py-2 text-blue-600 text-center"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}