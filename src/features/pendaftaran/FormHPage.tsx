import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

async function uploadFile(file: File, folder: string): Promise<string> {
  const fileName = `${folder}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from('application-documents').upload(fileName, file);
  if (error) throw error;
  const { data } = supabase.storage.from('application-documents').getPublicUrl(fileName);
  return data.publicUrl;
}

function FileInput({ label, onUploaded }: { label: string; onUploaded: (url: string) => void }) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done'>('idle');
  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('uploading');
    try {
      onUploaded(await uploadFile(file, 'form-h'));
      setStatus('done');
    } catch (err: any) {
      alert('Gagal unggah: ' + err.message);
      setStatus('idle');
    }
  }
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input type="file" accept="image/*" onChange={handleChange} className="w-full border rounded-lg px-3 py-2 text-sm" />
      {status === 'uploading' && <p className="text-xs text-blue-600 mt-1">Mengunggah...</p>}
      {status === 'done' && <p className="text-xs text-green-600 mt-1">Berhasil diunggah ✓</p>}
    </div>
  );
}

export default function FormHPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [childName, setChildName] = useState('');
  const [anakId, setAnakId] = useState<string | null>(null);
  const [previousClass, setPreviousClass] = useState('');

  const [targetClass, setTargetClass] = useState('');
  const [progression, setProgression] = useState<'naik_kelas' | 'tinggal_kelas'>('naik_kelas');
  const [progressionNotes, setProgressionNotes] = useState('');

  const [rekSekolahBank, setRekSekolahBank] = useState('');
  const [rekSekolahNomor, setRekSekolahNomor] = useState('');
  const [rekSekolahNama, setRekSekolahNama] = useState('');
  const [rekOrtuBank, setRekOrtuBank] = useState('');
  const [rekOrtuNomor, setRekOrtuNomor] = useState('');
  const [rekOrtuNama, setRekOrtuNama] = useState('');

  const [fotoRaporUrl, setFotoRaporUrl] = useState('');
  const [fotoSklUrl, setFotoSklUrl] = useState('');

  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('applications')
      .select('child_name_proposed, anak_id, previous_class_semester, status')
      .eq('id', id)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data || data.status !== 'menunggu_form_h' || !data.anak_id) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setChildName(data.child_name_proposed ?? '');
        setAnakId(data.anak_id);
        setPreviousClass(data.previous_class_semester ?? '');

        const { data: anak } = await supabase
          .from('anak_asak')
          .select('school_account_bank, school_account_number, school_account_name, parent_account_bank, parent_account_number, parent_account_name')
          .eq('id', data.anak_id)
          .single();
        if (anak) {
          setRekSekolahBank(anak.school_account_bank ?? '');
          setRekSekolahNomor(anak.school_account_number ?? '');
          setRekSekolahNama(anak.school_account_name ?? '');
          setRekOrtuBank(anak.parent_account_bank ?? '');
          setRekOrtuNomor(anak.parent_account_number ?? '');
          setRekOrtuNama(anak.parent_account_name ?? '');
        }
        setLoading(false);
      });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !anakId) return;
    setSaving(true);
    setErrorMsg(null);

    const { error: anakErr } = await supabase
      .from('anak_asak')
      .update({
        class_semester: targetClass,
        school_account_bank: rekSekolahBank,
        school_account_number: rekSekolahNomor,
        school_account_name: rekSekolahNama,
        parent_account_bank: rekOrtuBank,
        parent_account_number: rekOrtuNomor,
        parent_account_name: rekOrtuNama,
      })
      .eq('id', anakId);

    if (anakErr) {
      setErrorMsg(anakErr.message);
      setSaving(false);
      return;
    }

    const { error: appErr } = await supabase
      .from('applications')
      .update({
 status: 'masuk_antrian', // masuk antrian survey normal, seperti anak baru
        target_class_semester: targetClass,
        class_progression: progression,
        progression_notes: progressionNotes || null,
        rekening_sekolah_bank: rekSekolahBank,
        rekening_sekolah_nomor: rekSekolahNomor,
        rekening_sekolah_nama: rekSekolahNama,
        rekening_ortu_bank: rekOrtuBank,
        rekening_ortu_nomor: rekOrtuNomor,
        rekening_ortu_nama: rekOrtuNama,
        foto_rapor_url: fotoRaporUrl || null,
        foto_skl_url: fotoSklUrl || null,
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
        <p className="mt-2 text-gray-600">Pengajuan tidak ditemukan atau sudah pernah diisi.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 text-center">
        <h2 className="text-xl font-bold text-green-700">Form H Terkirim!</h2>
        <p className="mt-2 text-gray-600">Terima kasih. Pendaftaran ulang <strong>{childName}</strong> akan segera diproses Tim Anak.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-1">Form H — Pendaftaran Ulang</h2>
      <p className="text-sm text-gray-500 mb-4">Untuk: <strong>{childName}</strong> (sebelumnya: {previousClass || '-'})</p>

      {errorMsg && <p className="text-red-600 mb-3">{errorMsg}</p>}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Kelas/Semester Sekarang</label>
          <input required value={targetClass} onChange={(e) => setTargetClass(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="mis. Kelas 4" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select value={progression} onChange={(e) => setProgression(e.target.value as any)} className="w-full border rounded-lg px-3 py-2">
            <option value="naik_kelas">Naik Kelas</option>
            <option value="tinggal_kelas">Tinggal Kelas</option>
          </select>
        </div>
        {progression === 'tinggal_kelas' && (
          <div>
            <label className="block text-sm font-medium mb-1">Alasan Tinggal Kelas</label>
            <textarea value={progressionNotes} onChange={(e) => setProgressionNotes(e.target.value)} className="w-full border rounded-lg px-3 py-2" rows={2} />
          </div>
        )}

        <hr className="my-2" />
        <p className="text-sm font-semibold text-gray-700">Rekening Sekolah (perbarui bila berubah)</p>
        <div className="grid grid-cols-3 gap-2">
          <input placeholder="Bank" value={rekSekolahBank} onChange={(e) => setRekSekolahBank(e.target.value)} className="border rounded-lg px-2 py-2 text-sm" />
          <input placeholder="No. Rekening" value={rekSekolahNomor} onChange={(e) => setRekSekolahNomor(e.target.value)} className="border rounded-lg px-2 py-2 text-sm col-span-2" />
        </div>
        <input placeholder="Nama Pemilik Rekening" value={rekSekolahNama} onChange={(e) => setRekSekolahNama(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />

        <p className="text-sm font-semibold text-gray-700 mt-3">Rekening Orang Tua (perbarui bila berubah)</p>
        <div className="grid grid-cols-3 gap-2">
          <input placeholder="Bank" value={rekOrtuBank} onChange={(e) => setRekOrtuBank(e.target.value)} className="border rounded-lg px-2 py-2 text-sm" />
          <input placeholder="No. Rekening" value={rekOrtuNomor} onChange={(e) => setRekOrtuNomor(e.target.value)} className="border rounded-lg px-2 py-2 text-sm col-span-2" />
        </div>
        <input placeholder="Nama Pemilik Rekening" value={rekOrtuNama} onChange={(e) => setRekOrtuNama(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />

        <hr className="my-2" />
        <p className="text-sm font-semibold text-gray-700">Dokumen</p>
        <FileInput label="Foto Rapor Terbaru" onUploaded={setFotoRaporUrl} />
        <FileInput label="Foto SKL (jika ada)" onUploaded={setFotoSklUrl} />

        <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium mt-4 disabled:opacity-50">
          {saving ? 'Mengirim...' : 'Kirim Form H'}
        </button>
      </form>
    </div>
  );
}