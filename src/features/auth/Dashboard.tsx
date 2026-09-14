import { supabase } from '../../lib/supabase';

const MENU_BY_ROLE: Record<string, string[]> = {
  BendaharaASAK: ['Kas Umum & Ledger', 'Komitmen & Realisasi Santunan', 'Antrian Pencairan', 'Susun Batch', 'Fundraising', 'Pinjaman', 'Dashboard Cash Flow'],
  KetuaASAK: ['Approval Batch Pencairan', 'Rapat', 'Tarif Santunan', 'Distribusi Pool PIC'],
  BendaharaGereja: ['Terima Batch Disetujui', 'Ajukan ke Approver Gereja', 'Riwayat Batch'],
  ApproverGereja: ['Daftar Batch Menunggu Transfer', 'Eksekusi & Unggah Bukti Transfer'],
  TimAnakASAK: ['Antrian & Survey KLMTD', 'Latar Belakang Keluarga', 'Pengajuan (Form A/B/H)', 'PIC & Pool Anak', 'Monitoring & Kasus/Isu'],
  TimPenyantunASAK: ['Pendaftaran Donor Baru', 'PIC Penyantun', 'Mesin Pencocokan Pairing', 'Kasus/Isu Donor'],
  SekretarisASAK: ['Master Data', 'Penerbitan SK', 'Resolusi Nama/Alias Anak', 'Arsip Surat'],
  SuperAdminASAK: ['Akses Penuh Semua Modul', 'Manajemen Peran & Akun', 'Master Tarif', 'Pengaturan Sistem'],
  PenyantunASAK: ['Profil Anak Dampingan', 'Laporan Akademik & Komentar', 'Status Komitmen Saya', 'Pesan dari ASAK'],
};

export default function Dashboard({ name, roleName }: { name: string; roleName: string }) {
  const menuItems = MENU_BY_ROLE[roleName] ?? [];

  return (
    <div style={{ maxWidth: 600, margin: '60px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>{name}</h2>
          <p style={{ margin: 0, color: '#666' }}>{roleName}</p>
        </div>
        <button onClick={() => supabase.auth.signOut()} style={{ padding: '8px 16px' }}>
          Keluar
        </button>
      </div>

      <h3>Menu Anda:</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        {menuItems.map((item) => (
          <div key={item} style={{ padding: '12px 16px', border: '1px solid #ddd', borderRadius: 8 }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}