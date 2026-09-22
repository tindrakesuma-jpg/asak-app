import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Comment = {
  id: string;
  comment_text: string;
  relay_status: string;
  academic_reports: { report_type: string; school_year: string; anak_asak: { name: string } | null } | null;
};

export default function RelayKomentarPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('report_comments')
      .select('id, comment_text, relay_status, academic_reports(report_type, school_year, anak_asak(name))')
      .eq('relay_status', 'menunggu_relay');
    setComments((data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleRelay(id: string) {
    setProcessing(id);
    const { data: userData } = await supabase.auth.getUser();

    await supabase
      .from('report_comments')
      .update({
        relay_status: 'sudah_direlay',
        relayed_by_user_id: userData.user?.id,
        relayed_at: new Date().toISOString(),
      })
      .eq('id', id);

    setProcessing(null);
    loadData();
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-1">Relay Komentar Penyantun</h2>
      <p className="text-sm text-gray-500 mb-4">
        Sampaikan komentar ke keluarga secara manual (WA), tanpa menyebut identitas Penyantun. Lalu tandai selesai.
      </p>

      {comments.length === 0 && <p className="text-gray-500">Tidak ada komentar menunggu.</p>}

      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="border rounded-lg p-4">
            <p className="font-semibold">{c.academic_reports?.anak_asak?.name}</p>
            <p className="text-xs text-gray-500 mb-2">
              {c.academic_reports?.report_type} — {c.academic_reports?.school_year}
            </p>
            <p className="text-sm bg-gray-50 rounded-lg p-3 italic">"{c.comment_text}"</p>
            <button
              onClick={() => handleRelay(c.id)}
              disabled={processing !== null}
              className="mt-3 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm"
            >
              {processing === c.id ? 'Memproses...' : 'Tandai Sudah Diteruskan'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}