import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Pending = {
  id: string;
  name: string;
  phone: string;
  wilayah: string;
  lingkungan: string;
  paroki_asal: string;
};

export default function PicPenyantunPoolPage() {
  const [items, setItems] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('donor_registrations')
      .select('id, name, phone, wilayah, lingkungan, paroki_asal')
      .eq('status', 'menunggu_pic')
      .order('id');
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleClaim(regId: string) {
    setClaiming(regId);
    const { data: userData } = await supabase.auth.getUser();
    const reg = items.find((i) => i.id === regId);
    if (!reg) return;

    // 1. Formalisasi jadi donor resmi
    const donorCode = `${reg.name.replace(/\s+/g, '').toUpperCase().slice(0, 8)}${Date.now().toString().slice(-4)}`;
    const { data: donor, error: donorErr } = await supabase
      .from('donors')
      .insert({
        donor_code: donorCode,
        name: reg.name,
        phone: reg.phone,
        paroki_asal: reg.paroki_asal,
        wilayah: reg.wilayah,
        lingkungan: reg.lingkungan,
        program: 'AYOSEKOLAH', // default, disesuaikan nanti kalau punya pledge campuran
        status: 'active',
      })
      .select('id')
      .single();

    if (donorErr || !donor) {
      alert('Gagal formalisasi donor: ' + donorErr?.message);
      setClaiming(null);
      return;
    }

    // 2. Catat PIC
    await supabase.from('donor_pic_assignments').insert({
      donor_id: donor.id,
      pic_user_id: userData.user?.id,
      assignment_method: 'self_assign',
      start_date: new Date().toISOString().slice(0, 10),
    });

    // 3. Update status registrasi
    await supabase
      .from('donor_registrations')
      .update({ status: 'formalisasi_selesai', donor_id: donor.id })
      .eq('id', regId);

    setClaiming(null);
    loadData();
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Pool Calon Penyantun — Menunggu PIC</h2>

      {loading && <p>Memuat...</p>}
      {!loading && items.length === 0 && <p className="text-gray-500">Tidak ada yang menunggu.</p>}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="border rounded-lg p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">{item.name}</p>
              <p className="text-sm text-gray-600">{item.phone} — {item.wilayah}, {item.lingkungan}</p>
            </div>
            <button
              onClick={() => handleClaim(item.id)}
              disabled={claiming !== null}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap"
            >
              {claiming === item.id ? 'Memproses...' : 'Jadi PIC'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}