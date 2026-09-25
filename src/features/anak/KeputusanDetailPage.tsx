import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

function NumberStepper({
  value,
  onChange,
  step = 100000,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  const valueRef = useRef(value);
  const timeoutRef = useRef<number | null>(null);
  const speedRef = useRef(300);
  const tickCountRef = useRef(0);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  function stop() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    tickCountRef.current = 0;
  }

  function effectiveStep() {
    const accel = 1 + Math.floor(tickCountRef.current / 6) * 2;
    return step * Math.min(accel, 20);
  }

  function stepOnce(direction: 1 | -1) {
    const s = effectiveStep();
    const next = direction === 1 ? valueRef.current + s : Math.max(0, valueRef.current - s);
    valueRef.current = next;
    onChange(next);
  }

  function start(direction: 1 | -1) {
    speedRef.current = 300;
    tickCountRef.current = 0;
    function repeat() {
      tickCountRef.current += 1;
      stepOnce(direction);
      speedRef.current = Math.max(30, speedRef.current - 20);
      timeoutRef.current = window.setTimeout(repeat, speedRef.current);
    }
    timeoutRef.current = window.setTimeout(repeat, 300);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onMouseDown={() => { stepOnce(-1); start(-1); }}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={() => { stepOnce(-1); start(-1); }}
        onTouchEnd={stop}
        className="w-8 h-8 bg-gray-200 rounded text-lg font-bold select-none"
      >
        −
      </button>
      <input
        type="number"
        step={step}
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 border rounded-lg px-2 py-1.5 text-sm text-center"
      />
      <button
        type="button"
        onMouseDown={() => { stepOnce(1); start(1); }}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={() => { stepOnce(1); start(1); }}
        onTouchEnd={stop}
        className="w-8 h-8 bg-gray-200 rounded text-lg font-bold select-none"
      >
        +
      </button>
    </div>
  );
}

type AppDetail = {
  id: string;
  child_name_proposed: string;
  family_id: string;
  target_education_level: string;
  target_school_name: string;
  target_class_semester: string | null;
  school_year: string;
  is_new_child: boolean;
  anak_id: string | null;
};

type SurveyInfo = {
  nilai_akhir: number;
  klasifikasi: string;
  catatan_keluarga: string | null;
  foto_rumah_url: string | null;
  foto_wawancara_url: string | null;
};

type Decision = 'diterima' | 'ditolak' | 'kondisional';
type FollowUpType = 'tambahan_info' | 'survey_ulang';

export default function KeputusanDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();

  const [app, setApp] = useState<AppDetail | null>(null);
  const [survey, setSurvey] = useState<SurveyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [decision, setDecision] = useState<Decision>('diterima');
  const [followUpType, setFollowUpType] = useState<FollowUpType>('tambahan_info');
  const [reason, setReason] = useState('');
  const [uangPangkal, setUangPangkal] = useState(0);
  const [sppBulanan, setSppBulanan] = useState(0);
  const [tunjangan, setTunjangan] = useState(0);
  const [saving, setSaving] = useState(false);

  const [formALink, setFormALink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!applicationId) return;

    supabase
      .from('applications')
      .select('id, child_name_proposed, family_id, target_education_level, target_school_name, target_class_semester, school_year, is_new_child, anak_id')
      .eq('id', applicationId)
      .single()
      .then(({ data }) => setApp(data));

    supabase
      .from('survey_assignments')
      .select('id, klmtd_surveys(nilai_akhir, klasifikasi, catatan_keluarga, foto_rumah_url, foto_wawancara_url)')
      .eq('application_id', applicationId)
      .order('claimed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const s = (data as any)?.klmtd_surveys;
        setSurvey(Array.isArray(s) ? s[0] : s ?? null);
        setLoading(false);
      });
  }, [applicationId]);

  async function handleSubmit() {
    if (!app) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();

    const { data: meeting, error: meetingErr } = await supabase
      .from('meetings')
      .insert({ meeting_type: 'komite_penerimaan', mode: 'insidental', requested_by_user_id: userData.user?.id, status: 'selesai' })
      .select('id')
      .single();

    if (meetingErr || !meeting) {
      alert('Gagal membuat rapat: ' + meetingErr?.message);
      setSaving(false);
      return;
    }

    const { data: agendaItem, error: agendaErr } = await supabase
      .from('meeting_agenda_items')
      .insert({
        meeting_id: meeting.id,
        application_id: app.id,
        anak_id: app.anak_id,
        topic_type: 'penerimaan',
        decision,
        decision_reason: reason || null,
        decided_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (agendaErr || !agendaItem) {
      alert('Gagal menyimpan keputusan: ' + agendaErr?.message);
      setSaving(false);
      return;
    }

    if (decision === 'ditolak') {
      await supabase.from('applications').update({ status: 'ditolak_form_b' }).eq('id', app.id);
      setSaving(false);
      navigate('/rapat-keputusan');
      return;
    }

    if (decision === 'kondisional') {
      const newStatus = followUpType === 'survey_ulang' ? 'masuk_antrian' : 'perlu_followup';
      await supabase.from('applications').update({ status: newStatus }).eq('id', app.id);
      setSaving(false);
      navigate('/rapat-keputusan');
      return;
    }

    // decision === 'diterima' dari sini ke bawah

    if (app.anak_id) {
      // Anak lanjutan (Form H) — anak_asak sudah ada, langsung ke Menunggu SK, skip Form A
      const { error: updateErr } = await supabase
        .from('applications')
        .update({
          status: 'menunggu_sk',
          decision_reason: JSON.stringify({ uangPangkal, sppBulanan, tunjangan, agendaItemId: agendaItem.id }),
        })
        .eq('id', app.id);

      setSaving(false);
      if (updateErr) {
        alert('Gagal update status pengajuan: ' + updateErr.message);
        return;
      }
      navigate('/rapat-keputusan');
      return;
    }

    // Anak baru (Form B) — anak_asak belum ada, perlu Form A dulu
    const { error: updateErr } = await supabase
      .from('applications')
      .update({
        status: 'menunggu_form_a',
        decision_reason: JSON.stringify({ uangPangkal, sppBulanan, tunjangan, agendaItemId: agendaItem.id }),
      })
      .eq('id', app.id);

    setSaving(false);

    if (updateErr) {
      alert('Gagal update status pengajuan: ' + updateErr.message);
      return;
    }

    setFormALink(`${window.location.origin}/form-a/${app.id}`);
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;
  if (!app) return <p className="text-center mt-16">Data tidak ditemukan.</p>;

  if (formALink) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 text-center">
        <h2 className="text-xl font-bold text-green-700 mb-2">Diterima!</h2>
        <p className="text-gray-600 mb-4">
          Sampaikan link ini ke Orang Tua untuk melengkapi Form A (data keluarga & dokumen) sebelum bantuan bisa diproses.
        </p>
        <div className="bg-gray-50 border rounded-lg p-3 text-sm break-all mb-3">{formALink}</div>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(formALink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm mb-3"
        >
          {copied ? '✓ Tersalin!' : 'Salin Link'}
        </button>
        <div>
          <button onClick={() => navigate('/rapat-keputusan')} className="text-blue-600 text-sm underline">
            Kembali ke Rapat Keputusan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-1">{app.child_name_proposed}</h2>
      <p className="text-sm text-gray-600 mb-4">
        {app.target_education_level} — {app.target_school_name} ({app.school_year})
      </p>

      {survey ? (
        <div className="bg-gray-50 border rounded-lg p-4 mb-4 text-sm">
          <p>Nilai Akhir Survey: <strong>{survey.nilai_akhir}</strong></p>
          <p>Klasifikasi: <strong>{survey.klasifikasi}</strong></p>
          {survey.catatan_keluarga && <p className="mt-1 text-gray-600 whitespace-pre-wrap">"{survey.catatan_keluarga}"</p>}
          <div className="flex gap-2 mt-2">
            {survey.foto_rumah_url && (
              <a href={survey.foto_rumah_url} target="_blank" rel="noreferrer">
                <img src={survey.foto_rumah_url} alt="Foto rumah" className="w-20 h-20 object-cover rounded-lg border" />
              </a>
            )}
            {survey.foto_wawancara_url && (
              <a href={survey.foto_wawancara_url} target="_blank" rel="noreferrer">
                <img src={survey.foto_wawancara_url} alt="Foto wawancara" className="w-20 h-20 object-cover rounded-lg border" />
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4 text-sm text-yellow-800">
          Tidak ada data survey untuk pengajuan ini (survey dilewati, atau Form H tanpa survey ulang).
        </div>
      )}

      {!app.anak_id && (
        <p className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg p-2 mb-4">
          Anak baru — jika Diterima, Orang Tua akan diminta melengkapi Form A dulu.
        </p>
      )}
      {app.anak_id && (
        <p className="text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded-lg p-2 mb-4">
          Anak lanjutan (Form H) — jika Diterima, langsung lanjut ke penerbitan SK oleh Sekretaris.
        </p>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Keputusan</label>
        <select value={decision} onChange={(e) => setDecision(e.target.value as Decision)} className="w-full border rounded-lg px-3 py-2">
          <option value="diterima">Diterima</option>
          <option value="ditolak">Ditolak</option>
          <option value="kondisional">Perlu Follow-Up</option>
        </select>
      </div>

      {decision === 'diterima' && (
        <div className="space-y-3 mb-4 border rounded-lg p-4 bg-blue-50">
          <p className="text-sm font-semibold">Paket Bantuan (isi 0 kalau tidak berlaku)</p>
          <div>
            <label className="block text-xs mb-1">Uang Pangkal (sekali, naik tingkat)</label>
            <NumberStepper value={uangPangkal} onChange={setUangPangkal} />
          </div>
          <div>
            <label className="block text-xs mb-1">SPP/SKS per bulan</label>
            <NumberStepper value={sppBulanan} onChange={setSppBulanan} />
          </div>
          <div>
            <label className="block text-xs mb-1">Tunjangan per semester</label>
            <NumberStepper value={tunjangan} onChange={setTunjangan} />
          </div>
        </div>
      )}

      {(decision === 'ditolak' || decision === 'kondisional') && (
        <div className="mb-4">
          {decision === 'kondisional' && (
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Jenis Tindak Lanjut</label>
              <select
                value={followUpType}
                onChange={(e) => setFollowUpType(e.target.value as FollowUpType)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="tambahan_info">Cukup Tambahan Info (surveyor lama isi catatan)</option>
                <option value="survey_ulang">Perlu Survey Ulang Penuh (kembali ke Antrian Survey)</option>
              </select>
            </div>
          )}
          <label className="block text-sm font-medium mb-1">
            {decision === 'ditolak' ? 'Alasan Penolakan' : 'Catatan untuk Tim Anak'}
          </label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border rounded-lg px-3 py-2" rows={2} />
        </div>
      )}

      <button onClick={handleSubmit} disabled={saving} className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium disabled:opacity-50">
        {saving ? 'Menyimpan...' : 'Simpan Keputusan'}
      </button>
    </div>
  );
}