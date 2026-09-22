import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type AppRow = {
  id: string;
  child_name_proposed: string;
  target_education_level: string;
  target_school_name: string;
  status: string;
  created_at: string;
  form_b_review_notes: string | null;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  menunggu_tinjau_form_b: { label: 'Menunggu Ditinjau Tim Anak', color: 'text-orange-600' },
  ditolak_form_b: { label: 'Ditolak / Dibatalkan', color: 'text-red-600' },
  menunggu_form_a: { label: 'Disetujui — Menunggu Form A dari Ortu', color: 'text-blue-600' },
  masuk_antrian: { label: 'Menunggu Antrian Survey', color: 'text-gray-600' },
  sedang_disurvey: { label: 'Sedang Disurvey', color: 'text-gray-600' },
  survey_selesai: { label: 'Menunggu Rapat Keputusan', color: 'text-gray-600' },
  diputuskan: { label: 'Sudah Diputuskan', color: 'text-green-600' },
};

const STORAGE_KEY = 'asak_verified_ketua_lingkungan_phone';

export default function RiwayatFormBPage() {
  const [phone, setPhone] = useState<string | null>(() => sessionStorage.getItem(STORAGE_KEY));
  const [inputPhone, setInputPhone] = useState('');
  const [items, setItems] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFoundMsg, setNotFoundMsg] = useState<string | null>(null);

  async function loadData(phoneToUse: string) {
    setLoading(true);
    const { data } = await supabase
      .from('applications')
      .select('id, child_name_proposed, target_education_level, target_school_name, status, created_at, form_b_review_notes')
      .eq('submitted_by_phone', phoneToUse)
      .order('created_at', { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (phone) loadData(phone);
  }, [phone]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setNotFoundMsg(null);

    const { data } = await supabase
      .from('applications')
      .select('id')
      .eq('submitted_by_phone', inputPhone)
      .limit(1);

    if (!data || data.length === 0) {
      setNotFoundMsg('Belum ada pengajuan Form B dengan No. HP ini. Cek kembali nomornya.');
      return;
    }

    sessionStorage.setItem(STORAGE_KEY, inputPhone);
    setPhone(inputPhone);
  }

  function handleSwitch() {
    sessionStorage.removeItem(STORAGE_KEY);
    setPhone(null);
    setInputPhone('');
    setItems([]);
  }

  if (!phone) {
    return (
      <div className="max-w-sm mx-auto mt-16 p-6">
        <h2 className="text-xl font-bold mb-1 text-center">Riwayat Pengajuan Form B</h2>
        <p className="text-sm text-gray-500 mb-4 text-center">
          Masukkan No. HP yang sama seperti saat mengisi Form B untuk melihat status pengajuan Anda.
        </p>
        {notFoundMsg && <p className="text-red-600 text-sm mb-3">{notFoundMsg}</p>}
        <form onSubmit={handleVerify} className="space-y-3">
          <input
            required
            value={inputPhone}
            onChange={(e) => setInputPhone(e.target.value)}
            placeholder="No. HP/WA"
            className="w-full border rounded-lg px-3 py-2"
          />
          <button type="submit" className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium">
            Lihat Riwayat
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Riwayat Pengajuan Form B</h2>
        <button onClick={handleSwitch} className="text-sm text-gray-500 underline">Ganti No. HP</button>
      </div>

      {loading && <p>Memuat...</p>}
      {!loading && items.length === 0 && <p className="text-gray-500">Belum ada pengajuan.</p>}

      <div className="space-y-3">
        {items.map((item) => {
          const statusInfo = STATUS_LABEL[item.status] ?? { label: item.status, color: 'text-gray-600' };
          return (
            <div key={item.id} className="border rounded-lg p-4">
              <p className="font-semibold">{item.child_name_proposed}</p>
              <p className="text-sm text-gray-600">{item.target_education_level} — {item.target_school_name}</p>
              <p className="text-xs text-gray-400">Diajukan: {new Date(item.created_at).toLocaleDateString('id-ID')}</p>
              <p className={`text-sm font-semibold mt-1 ${statusInfo.color}`}>{statusInfo.label}</p>
              {item.status === 'ditolak_form_b' && item.form_b_review_notes && (
                <p className="text-xs text-red-600 mt-1">Alasan: {item.form_b_review_notes}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}