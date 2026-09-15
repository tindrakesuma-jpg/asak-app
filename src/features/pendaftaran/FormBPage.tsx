import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function FormBPage() {
  const [childName, setChildName] = useState('');
  const [isNewChild, setIsNewChild] = useState(true);
  const [targetLevel, setTargetLevel] = useState('SD');
  const [targetSchool, setTargetSchool] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [submitterPhone, setSubmitterPhone] = useState('');
  const [wilayah, setWilayah] = useState('');
  const [lingkungan, setLingkungan] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    // Perlu family_id — untuk sekarang kita buat family baru otomatis (disederhanakan;
    // idealnya nanti ada pencarian keluarga yang sudah ada dulu).
    const { data: family, error: famErr } = await supabase
      .from('families')
      .insert({ kk_number: 'BELUM_DIISI', address: 'BELUM_DIISI' })
      .select('id')
      .single();

    if (famErr || !family) {
      setErrorMsg('Gagal membuat data keluarga: ' + famErr?.message);
      setSaving(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from('applications').insert({
      application_type: 'B',
      submitted_by_user_id: userData.user?.id,
      school_year: '2026/2027',
      family_id: family.id,
      child_name_proposed: childName,
      is_new_child: isNewChild,
      is_tingkat_baru: !isNewChild,
      target_education_level: targetLevel,
      target_school_name: targetSchool,
      submitted_by_name: submitterName,
      submitted_by_phone: submitterPhone,
      submitted_by_wilayah: wilayah,
      submitted_by_lingkungan: lingkungan,
      status: 'menunggu_tinjau_form_b',
    });

    setSaving(false);
    if (error) setErrorMsg(error.message);
    else setDone(true);
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 text-center">
        <h2 className="text-xl font-bold text-green-700">Form B Terkirim!</h2>
        <p className="mt-2 text-gray-600">
          Terima kasih. Pengajuan akan ditinjau oleh Tim Anak ASAK.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-1">Form B — Pengajuan Bantuan ASAK</h2>
      <p className="text-sm text-gray-500 mb-4">Diisi oleh Ketua Lingkungan</p>

      {errorMsg && <p className="text-red-600 mb-3">{errorMsg}</p>}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Nama Anak</label>
          <input
            required
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Jenis Pengajuan</label>
          <select
            value={isNewChild ? 'baru' : 'naik_tingkat'}
            onChange={(e) => setIsNewChild(e.target.value === 'baru')}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="baru">Anak Baru</option>
            <option value="naik_tingkat">Naik Tingkat</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tingkat Tujuan</label>
          <select
            value={targetLevel}
            onChange={(e) => setTargetLevel(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option>TK</option><option>SD</option><option>SMP</option>
            <option>SMA</option><option>SMK</option><option>PT</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nama Sekolah Tujuan</label>
          <input
            required
            value={targetSchool}
            onChange={(e) => setTargetSchool(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <hr className="my-4" />
        <p className="text-sm font-semibold text-gray-700">Data Pengaju (Ketua Lingkungan)</p>

        <div>
          <label className="block text-sm font-medium mb-1">Nama Anda</label>
          <input
            required
            value={submitterName}
            onChange={(e) => setSubmitterName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">No. HP/WA</label>
          <input
            required
            value={submitterPhone}
            onChange={(e) => setSubmitterPhone(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Wilayah</label>
            <input
              required
              value={wilayah}
              onChange={(e) => setWilayah(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Lingkungan</label>
            <input
              required
              value={lingkungan}
              onChange={(e) => setLingkungan(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium mt-4 disabled:opacity-50"
        >
          {saving ? 'Mengirim...' : 'Kirim Form B'}
        </button>
      </form>
    </div>
  );
}