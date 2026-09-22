import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type PendingApp = {
  id: string;
  child_name_proposed: string;
  target_education_level: string;
  target_school_name: string;
  submitted_by_name: string;
  submitted_by_phone: string;
  submitted_by_wilayah: string;
  submitted_by_lingkungan: string;
  is_new_child: boolean;
};

export default function TinjauFormBPage() {
  const [items, setItems] = useState<PendingApp[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('applications')
      .select('id, child_name_proposed, target_education_level, target_school_name, submitted_by_name, submitted_by_phone, submitted_by_wilayah, submitted_by_lingkungan, is_new_child')
      .eq('status', 'menunggu_tinjau_form_b')
      .order('id');
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleApprove(id: string) {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('applications')
      .update({
        status: 'masuk_antrian',
        form_b_reviewed_by_user_id: userData.user?.id,
        form_b_reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      alert('Gagal: ' + error.message);
      return;
    }
    loadData();
  }

  async function handleReject(id: string) {
    const reason = prompt('Alasan penolakan:');
    if (reason === null) return;

    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('applications')
      .update({
        status: 'ditolak_form_b',
        form_b_reviewed_by_user_id: userData.user?.id,
        form_b_reviewed_at: new Date().toISOString(),
        form_b_review_notes: reason,
      })
      .eq('id', id);

    if (error) alert('Gagal: ' + error.message);
    else loadData();
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Tinjau Form B — Menunggu Persetujuan</h2>
      <p className="text-sm text-gray-500 mb-4">
        Setelah disetujui, anak langsung masuk Antrian Survey. Form A (data keluarga lengkap) baru diminta setelah Rapat Komite memutuskan diterima.
      </p>

      {loading && <p>Memuat...</p>}
      {!loading && items.length === 0 && <p className="text-gray-500">Tidak ada yang menunggu tinjauan.</p>}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="border rounded-lg p-4">
            <p className="font-semibold">{item.child_name_proposed}</p>
            <p className="text-sm text-gray-600">
              {item.is_new_child ? 'Anak Baru' : 'Naik Tingkat'} → {item.target_education_level}, {item.target_school_name}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Diajukan oleh: {item.submitted_by_name} ({item.submitted_by_phone})<br />
              {item.submitted_by_wilayah}, {item.submitted_by_lingkungan}
            </p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => handleApprove(item.id)} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm">
                Setujui → Antrian Survey
              </button>
              <button onClick={() => handleReject(item.id)} className="bg-red-100 text-red-700 px-4 py-1.5 rounded-lg text-sm">
                Tolak
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}