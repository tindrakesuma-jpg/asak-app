import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type FollowUpItem = {
  application_id: string;
  child_name_proposed: string;
  reason: string | null;
  survey_id: string;
  catatan_keluarga: string | null;
};

export default function TindakLanjutPage() {
  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();

    const { data: apps } = await supabase
      .from('applications')
      .select('id, child_name_proposed')
      .eq('status', 'perlu_followup');

    if (!apps || apps.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const result: FollowUpItem[] = [];
    for (const app of apps) {
      const { data: assignment } = await supabase
        .from('survey_assignments')
        .select('id, surveyor_user_id, klmtd_surveys(id, catatan_keluarga)')
        .eq('application_id', app.id)
        .eq('surveyor_user_id', userData.user?.id)
        .maybeSingle();

      if (!assignment) continue;

      const { data: agendaItem } = await supabase
        .from('meeting_agenda_items')
        .select('decision_reason')
        .eq('application_id', app.id)
        .eq('decision', 'kondisional')
        .order('decided_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const surveyRaw = (assignment as any).klmtd_surveys;
      const survey = Array.isArray(surveyRaw) ? surveyRaw[0] : surveyRaw;

      result.push({
        application_id: app.id,
        child_name_proposed: app.child_name_proposed,
        reason: agendaItem?.decision_reason ?? null,
        survey_id: survey?.id,
        catatan_keluarga: survey?.catatan_keluarga ?? null,
      });
    }

    setItems(result);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleResubmit(item: FollowUpItem) {
    setSaving(item.application_id);
    const additionalNote = notes[item.application_id] || '';

    if (item.survey_id && additionalNote) {
      const combined = (item.catatan_keluarga ? item.catatan_keluarga + '\n\n' : '') + `[Follow-up] ${additionalNote}`;
      await supabase.from('klmtd_surveys').update({ catatan_keluarga: combined }).eq('id', item.survey_id);
    }

    await supabase.from('applications').update({ status: 'survey_selesai' }).eq('id', item.application_id);

    setSaving(null);
    loadData();
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-1">Tindak Lanjut Diminta Rapat</h2>
      <p className="text-sm text-gray-500 mb-4">
        Anak yang Anda survey, diminta melengkapi info sebelum bisa diputuskan lagi.
      </p>

      {items.length === 0 && <p className="text-gray-500">Tidak ada tindak lanjut untuk Anda.</p>}

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.application_id} className="border rounded-lg p-4 bg-yellow-50">
            <p className="font-semibold">{item.child_name_proposed}</p>
            {item.reason && <p className="text-sm text-orange-700 mt-1">Diminta Rapat: {item.reason}</p>}

            <label className="block text-sm font-medium mt-3 mb-1">Info Tambahan</label>
            <textarea
              value={notes[item.application_id] || ''}
              onChange={(e) => setNotes({ ...notes, [item.application_id]: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={3}
              placeholder="Tulis info tambahan yang berhasil didapat..."
            />

            <button
              onClick={() => handleResubmit(item)}
              disabled={saving !== null}
              className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              {saving === item.application_id ? 'Mengirim...' : 'Selesai, Kirim Ulang ke Rapat'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}