import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

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
};

export default function KeputusanDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();

  const [app, setApp] = useState<AppDetail | null>(null);
  const [survey, setSurvey] = useState<SurveyInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [decision, setDecision] = useState<'diterima' | 'ditolak'>('diterima');
  const [reason, setReason] = useState('');
  const [uangPangkal, setUangPangkal] = useState(0);
  const [sppBulanan, setSppBulanan] = useState(0);
  const [tunjangan, setTunjangan] = useState(0);
  const [saving, setSaving] = useState(false);

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
      .select('id, klmtd_surveys(nilai_akhir, klasifikasi, catatan_keluarga)')
      .eq('application_id', applicationId)
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

    // 1. Buat data anak_asak kalau anak baru
    let anakId = app.anak_id;
    if (decision === 'diterima' && !anakId) {
      const { data: anak, error: anakErr } = await supabase
        .from('anak_asak')
        .insert({
          name: app.child_name_proposed,
          family_id: app.family_id,
          school_name: app.target_school_name,
          education_level: app.target_education_level,
          class_semester: app.target_class_semester,
          status: 'active',
        })
        .select('id')
        .single();

      if (anakErr || !anak) {
        alert('Gagal membuat data anak: ' + anakErr?.message);
        setSaving(false);
        return;
      }
      anakId = anak.id;
    }

    // 2. Buat meeting (insidental, langsung selesai — model rapat kilat per keputusan)
    const { data: meeting, error: meetingErr } = await supabase
      .from('meetings')
      .insert({
        meeting_type: 'komite_penerimaan',
        mode: 'insidental',
        requested_by_user_id: userData.user?.id,
        status: 'selesai',
      })
      .select('id')
      .single();

    if (meetingErr || !meeting) {
      alert('Gagal membuat rapat: ' + meetingErr?.message);
      setSaving(false);
      return;
    }

    // 3. Buat agenda item + keputusan
    const { data: agendaItem, error: agendaErr } = await supabase
      .from('meeting_agenda_items')
      .insert({
        meeting_id: meeting.id,
        application_id: app.id,
        anak_id: anakId,
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

    if (decision === 'diterima' && anakId) {
      // 4. Terbitkan SK (nomor sederhana, belum counter transaksional formal)
      const skNumber = `SK-ASAK-${app.school_year.replace('/', '-')}-${Date.now().toString().slice(-6)}`;

      const { data: sk, error: skErr } = await supabase
        .from('sk_letters')
        .insert({
          agenda_item_id: agendaItem.id,
          anak_id: anakId,
          sk_number: skNumber,
          school_year: app.school_year,
          issued_by_user_id: userData.user?.id,
          issued_date: new Date().toISOString().slice(0, 10),
        })
        .select('id')
        .single();

      if (skErr || !sk) {
        alert('Gagal menerbitkan SK: ' + skErr?.message);
        setSaving(false);
        return;
      }

      // 5. Simpan komponen paket bantuan yang diisi (nominal > 0 saja)
      const packages = [];
      if (uangPangkal > 0) packages.push({ sk_id: sk.id, anak_id: anakId, school_year: app.school_year, component_type: 'uang_pangkal', nominal: uangPangkal });
      if (sppBulanan > 0) packages.push({ sk_id: sk.id, anak_id: anakId, school_year: app.school_year, component_type: 'spp_bulanan', nominal: sppBulanan });
      if (tunjangan > 0) packages.push({ sk_id: sk.id, anak_id: anakId, school_year: app.school_year, component_type: 'tunjangan_semester', nominal: tunjangan });

      if (packages.length > 0) {
        await supabase.from('bantuan_packages').insert(packages);
      }
    }

    // 6. Update status pengajuan
    await supabase
      .from('applications')
      .update({ status: 'diputuskan', anak_id: anakId })
      .eq('id', app.id);

    setSaving(false);
    navigate('/rapat-keputusan');
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;
  if (!app) return <p className="text-center mt-16">Data tidak ditemukan.</p>;

  return (
    <div className="max-w-xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-1">{app.child_name_proposed}</h2>
      <p className="text-sm text-gray-600 mb-4">
        {app.target_education_level} — {app.target_school_name} ({app.school_year})
      </p>

      {survey && (
        <div className="bg-gray-50 border rounded-lg p-4 mb-4 text-sm">
          <p>Nilai Akhir Survey: <strong>{survey.nilai_akhir}</strong></p>
          <p>Klasifikasi: <strong>{survey.klasifikasi}</strong></p>
          {survey.catatan_keluarga && <p className="mt-1 text-gray-600">"{survey.catatan_keluarga}"</p>}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Keputusan</label>
        <select
          value={decision}
          onChange={(e) => setDecision(e.target.value as 'diterima' | 'ditolak')}
          className="w-full border rounded-lg px-3 py-2"
        >
          <option value="diterima">Diterima</option>
          <option value="ditolak">Ditolak</option>
        </select>
      </div>

      {decision === 'diterima' && (
        <div className="space-y-3 mb-4 border rounded-lg p-4 bg-blue-50">
          <p className="text-sm font-semibold">Paket Bantuan (isi 0 kalau tidak berlaku)</p>
          <div>
            <label className="block text-xs mb-1">Uang Pangkal (sekali, naik tingkat)</label>
            <input type="number" value={uangPangkal} onChange={(e) => setUangPangkal(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs mb-1">SPP/SKS per bulan</label>
            <input type="number" value={sppBulanan} onChange={(e) => setSppBulanan(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-xs mb-1">Tunjangan per semester</label>
            <input type="number" value={tunjangan} onChange={(e) => setTunjangan(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2" />
          </div>
        </div>
      )}

      {decision === 'ditolak' && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Alasan Penolakan</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border rounded-lg px-3 py-2" rows={2} />
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium disabled:opacity-50"
      >
        {saving ? 'Menyimpan...' : 'Simpan Keputusan'}
      </button>
    </div>
  );
}