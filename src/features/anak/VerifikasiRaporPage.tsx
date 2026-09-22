import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Report = {
  id: string;
  school_year: string;
  semester: number;
  report_type: string;
  file_url: string;
  anak_asak: { name: string } | null;
};

export default function VerifikasiRaporPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('academic_reports')
      .select('id, school_year, semester, report_type, file_url, anak_asak(name)')
      .eq('status', 'menunggu_verifikasi');
    setReports((data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handlePublish(id: string) {
    setProcessing(id);
    const { data: userData } = await supabase.auth.getUser();
    await supabase
      .from('academic_reports')
      .update({ status: 'dipublikasikan', verified_by_user_id: userData.user?.id })
      .eq('id', id);
    setProcessing(null);
    loadData();
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Verifikasi Laporan Akademik</h2>
      {reports.length === 0 && <p className="text-gray-500">Tidak ada yang menunggu verifikasi.</p>}
      <div className="space-y-3">
        {reports.map((r) => (
          <div key={r.id} className="border rounded-lg p-4">
            <p className="font-semibold">{r.anak_asak?.name}</p>
            <p className="text-sm text-gray-600">{r.report_type} — {r.school_year} Semester {r.semester}</p>
            <a href={r.file_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 break-all">{r.file_url}</a>
            <div className="mt-2">
              <button onClick={() => handlePublish(r.id)} disabled={processing !== null} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm">
                {processing === r.id ? 'Memproses...' : 'Publikasikan ke Penyantun'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}