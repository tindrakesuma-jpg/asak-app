import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type QueueItem = {
  id: string;
  child_name_proposed: string;
  target_education_level: string;
  target_school_name: string;
  submitted_by_wilayah: string;
  submitted_by_lingkungan: string;
};

type MyAssignment = {
  id: string; // survey_assignment id
  claimed_at: string;
  applications: {
    child_name_proposed: string;
    target_education_level: string;
    target_school_name: string;
  } | null;
};

export default function AntrianSurveyPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [myAssignments, setMyAssignments] = useState<MyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const navigate = useNavigate();

  async function loadData() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();

    const { data: queue } = await supabase
      .from('applications')
      .select('id, child_name_proposed, target_education_level, target_school_name, submitted_by_wilayah, submitted_by_lingkungan')
      .eq('status', 'masuk_antrian')
      .order('id');
    setItems(queue ?? []);

    const { data: mine } = await supabase
      .from('survey_assignments')
      .select('id, claimed_at, applications(child_name_proposed, target_education_level, target_school_name)')
      .eq('surveyor_user_id', userData.user?.id)
      .eq('status', 'in_progress');
    setMyAssignments((mine ?? []) as any);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleClaim(applicationId: string) {
    setClaiming(applicationId);
    const { data: userData } = await supabase.auth.getUser();

    const { error: assignErr } = await supabase.from('survey_assignments').insert({
      application_id: applicationId,
      surveyor_user_id: userData.user?.id,
      status: 'in_progress',
    });

    if (assignErr) {
      alert('Gagal mengambil: ' + assignErr.message);
      setClaiming(null);
      return;
    }

    await supabase
      .from('applications')
      .update({ status: 'sedang_disurvey' })
      .eq('id', applicationId);

    setClaiming(null);
    loadData(); // tetap di halaman ini, pindah ke bagian "Antrian Saya"
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4 space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-4">Antrian Saya — Belum Disurvey</h2>
        {myAssignments.length === 0 && (
          <p className="text-gray-500">Belum ada yang Anda ambil.</p>
        )}
        <div className="space-y-3">
          {myAssignments.map((a) => (
            <div key={a.id} className="border rounded-lg p-4 bg-yellow-50 flex justify-between items-center">
              <div>
                <p className="font-semibold">{a.applications?.child_name_proposed}</p>
                <p className="text-sm text-gray-600">
                  {a.applications?.target_education_level} — {a.applications?.target_school_name}
                </p>
                <p className="text-xs text-gray-400">Diambil: {new Date(a.claimed_at).toLocaleDateString('id-ID')}</p>
              </div>
              <button
                onClick={() => navigate(`/survey/${a.id}`)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap"
              >
                Isi Survey
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Antrian Survey — Belum Diambil</h2>
        {items.length === 0 && <p className="text-gray-500">Antrian kosong.</p>}
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="border rounded-lg p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold">{item.child_name_proposed}</p>
                <p className="text-sm text-gray-600">{item.target_education_level} — {item.target_school_name}</p>
                <p className="text-sm text-gray-500">{item.submitted_by_wilayah}, {item.submitted_by_lingkungan}</p>
              </div>
              <button
                onClick={() => handleClaim(item.id)}
                disabled={claiming !== null}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap"
              >
                {claiming === item.id ? 'Mengambil...' : 'Ambil'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}