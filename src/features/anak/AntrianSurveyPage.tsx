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

export default function AntrianSurveyPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const navigate = useNavigate();

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('applications')
      .select('id, child_name_proposed, target_education_level, target_school_name, submitted_by_wilayah, submitted_by_lingkungan')
      .eq('status', 'masuk_antrian')
      .order('id');
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleClaim(applicationId: string) {
    setClaiming(applicationId);
    const { data: userData } = await supabase.auth.getUser();

    const { data: assignment, error: assignErr } = await supabase
      .from('survey_assignments')
      .insert({
        application_id: applicationId,
        surveyor_user_id: userData.user?.id,
        status: 'in_progress',
      })
      .select('id')
      .single();

    if (assignErr || !assignment) {
      alert('Gagal mengambil: ' + assignErr?.message);
      setClaiming(null);
      return;
    }

    await supabase
      .from('applications')
      .update({ status: 'sedang_disurvey' })
      .eq('id', applicationId);

    navigate(`/survey/${assignment.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Antrian Survey KLMTD</h2>

      {loading && <p>Memuat...</p>}
      {!loading && items.length === 0 && <p className="text-gray-500">Antrian kosong.</p>}

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
  );
}