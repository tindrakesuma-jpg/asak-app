import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Anak = { id: string; name: string };

export default function UploadRaporPage() {
  const [anakList, setAnakList] = useState<Anak[]>([]);
  const [anakId, setAnakId] = useState('');
  const [schoolYear, setSchoolYear] = useState('2026/2027');
  const [semester, setSemester] = useState(1);
  const [reportType, setReportType] = useState('rapor');
  const [fileUrl, setFileUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.from('anak_asak').select('id, name').eq('status', 'active').order('name')
      .then(({ data }) => setAnakList(data ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from('academic_reports').insert({
      anak_id: anakId,
      school_year: schoolYear,
      semester,
      report_type: reportType,
      file_url: fileUrl,
      uploaded_by_type: 'tim_anak',
      uploaded_by_user_id: userData.user?.id,
      status: 'menunggu_verifikasi',
    });

    setSaving(false);
    if (error) {
      alert('Gagal: ' + error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 text-center">
        <h2 className="text-xl font-bold text-green-700">Laporan Terkirim!</h2>
        <p className="mt-2 text-gray-600">Menunggu verifikasi sebelum tampil ke Penyantun.</p>
        <button onClick={() => setDone(false)} className="mt-4 text-blue-600 underline text-sm">Unggah Lagi</button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Unggah Laporan Akademik</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Anak</label>
          <select required value={anakId} onChange={(e) => setAnakId(e.target.value)} className="w-full border rounded-lg px-3 py-2">
            <option value="">Pilih anak...</option>
            {anakList.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Tahun Ajaran</label>
            <input value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Semester</label>
            <select value={semester} onChange={(e) => setSemester(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2">
              <option value={1}>Ganjil</option>
              <option value={2}>Genap</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Jenis Laporan</label>
          <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="w-full border rounded-lg px-3 py-2">
            <option value="rapor">Rapor</option>
            <option value="khs">KHS</option>
            <option value="laporan_prestasi_lain">Laporan Prestasi Lain</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Link Dokumen (Google Drive, dll)</label>
          <input required type="url" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." className="w-full border rounded-lg px-3 py-2" />
        </div>
        <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium disabled:opacity-50">
          {saving ? 'Mengirim...' : 'Kirim untuk Verifikasi'}
        </button>
      </form>
    </div>
  );
}