import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function FormAPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [childName, setChildName] = useState('');
  const [familyId, setFamilyId] = useState<string | null>(null);

  const [kkNumber, setKkNumber] = useState('');
  const [address, setAddress] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [fatherOccupation, setFatherOccupation] = useState('');
  const [motherName, setMotherName] = useState('');
  const [motherOccupation, setMotherOccupation] = useState('');
  const [incomeRange, setIncomeRange] = useState('dibawah_2.5jt');
  const [dependentsCount, setDependentsCount] = useState(1);

  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('applications')
      .select('child_name_proposed, family_id, status')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data || data.status !== 'menunggu_form_a') {
          setNotFound(true);
        } else {
          setChildName(data.child_name_proposed ?? '');
          setFamilyId(data.family_id);
        }
        setLoading(false);
      });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!familyId || !id) return;
    setSaving(true);
    setErrorMsg(null);

    const { error: famErr } = await supabase
      .from('families')
      .update({
        kk_number: kkNumber,
        address,
        father_name: fatherName,
        father_occupation: fatherOccupation,
        mother_name: motherName,
        mother_occupation: motherOccupation,
        income_range: incomeRange,
        dependents_count: dependentsCount,
      })
      .eq('id', familyId);

    if (famErr) {
      setErrorMsg(famErr.message);
      setSaving(false);
      return;
    }

    const { error: appErr } = await supabase
      .from('applications')
      .update({
        status: 'masuk_antrian',
        form_a_submitted_at: new Date().toISOString(),
      })
      .eq('id', id);

    setSaving(false);
    if (appErr) setErrorMsg(appErr.message);
    else setDone(true);
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  if (notFound) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 text-center">
        <h2 className="text-xl font-bold text-red-700">Link Tidak Valid</h2>
        <p className="mt-2 text-gray-600">
          Pengajuan tidak ditemukan, atau sudah pernah diisi / belum disetujui Tim Anak.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 text-center">
        <h2 className="text-xl font-bold text-green-700">Form A Terkirim!</h2>
        <p className="mt-2 text-gray-600">
          Terima kasih. Pengajuan untuk <strong>{childName}</strong> akan masuk antrian survey.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-1">Form A — Data Keluarga</h2>
      <p className="text-sm text-gray-500 mb-4">
        Untuk: <strong>{childName}</strong>
      </p>

      {errorMsg && <p className="text-red-600 mb-3">{errorMsg}</p>}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Nomor KK</label>
          <input required value={kkNumber} onChange={(e) => setKkNumber(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Alamat</label>
          <textarea required value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Ayah</label>
            <input value={fatherName} onChange={(e) => setFatherName(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pekerjaan Ayah</label>
            <input value={fatherOccupation} onChange={(e) => setFatherOccupation(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Ibu</label>
            <input value={motherName} onChange={(e) => setMotherName(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pekerjaan Ibu</label>
            <input value={motherOccupation} onChange={(e) => setMotherOccupation(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Rentang Penghasilan Keluarga/Bulan</label>
          <select value={incomeRange} onChange={(e) => setIncomeRange(e.target.value)} className="w-full border rounded-lg px-3 py-2">
            <option value="dibawah_2.5jt">Di bawah Rp2,5 juta</option>
            <option value="2.5-5jt">Rp2,5 – 5 juta</option>
            <option value="diatas_5jt">Di atas Rp5 juta</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Jumlah Tanggungan</label>
          <input
            type="number"
            min={0}
            value={dependentsCount}
            onChange={(e) => setDependentsCount(Number(e.target.value))}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium mt-4 disabled:opacity-50"
        >
          {saving ? 'Mengirim...' : 'Kirim Form A'}
        </button>
      </form>
    </div>
  );
}