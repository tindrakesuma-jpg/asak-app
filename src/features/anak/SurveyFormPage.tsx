import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const INDICATORS = [
  { no: 1, label: 'Yatim Piatu/single parent karena wafat', weight: 3 },
  { no: 2, label: 'Permasalahan Rumah Tangga (broken home)', weight: 3 },
  { no: 3, label: 'Permasalahan Ekonomi (ekonomi sulit, keluarga rukun)', weight: 2 },
  { no: 4, label: 'Tulang punggung keluarga seorang ibu', weight: 3 },
  { no: 5, label: 'Pendapatan keluarga tidak tetap tiap bulan', weight: 2 },
  { no: 6, label: 'Pendapatan keluarga < Rp3.000.000/bulan', weight: 3 },
  { no: 7, label: 'Pendapatan keluarga Rp3.000.001 - 4.500.000/bulan', weight: 2 },
  { no: 8, label: 'Pendapatan keluarga Rp4.500.001 - 6.000.000/bulan', weight: 1 },
  { no: 9, label: 'Tagihan listrik/token < Rp400.000', weight: 2 },
  { no: 10, label: 'Tidak ada bantuan rutin dari saudara', weight: 2 },
  { no: 11, label: 'Punya kredit/pinjaman > 30% pendapatan/bulan', weight: 2 },
  { no: 12, label: 'Tempat tinggal mengontrak/sewa', weight: 2 },
  { no: 13, label: 'Ada anggota keluarga sakit keras/dalam pengobatan', weight: 1 },
  { no: 14, label: 'Kepala keluarga lansia/sakit/tidak bekerja/PHK', weight: 1 },
  { no: 15, label: 'Ada anak sekolah Negeri/PTN/beasiswa ASAK di PTS mitra', weight: 2 },
  { no: 16, label: 'Punya 3+ anak yang belum bekerja', weight: 1 },
  { no: 17, label: 'Ada anggota keluarga difabel', weight: 1 },
];

export default function SurveyFormPage() {
  const { id: assignmentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [skorII, setSkorII] = useState(0);
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);

  const totalBobot = INDICATORS.filter((i) => checked[i.no]).reduce((sum, i) => sum + i.weight, 0);
  const skorProfilKeluarga = totalBobot / 2.5;
  const nilaiAkhir = (skorProfilKeluarga + skorII) / 1.5;

  function klasifikasi(nilai: number) {
    if (nilai >= 8.6) return 'A';
    if (nilai >= 7.0) return 'B';
    if (nilai >= 5.1) return 'C';
    return 'D';
  }

  async function handleSubmit() {
    if (!assignmentId) return;
    setSaving(true);

    const { data: survey, error: surveyErr } = await supabase
      .from('klmtd_surveys')
      .insert({
        survey_assignment_id: assignmentId,
        survey_date: new Date().toISOString().slice(0, 10),
        skor_profil_keluarga: skorProfilKeluarga,
        skor_ii: skorII,
        nilai_akhir: nilaiAkhir,
        klasifikasi: klasifikasi(nilaiAkhir),
        catatan_keluarga: catatan,
      })
      .select('id')
      .single();

    if (surveyErr || !survey) {
      alert('Gagal simpan survey: ' + surveyErr?.message);
      setSaving(false);
      return;
    }

    const items = INDICATORS.map((ind) => ({
      survey_id: survey.id,
      item_no: ind.no,
      item_label: ind.label,
      weight: ind.weight,
      is_checked: !!checked[ind.no],
    }));
    await supabase.from('klmtd_survey_items').insert(items);

    await supabase
      .from('survey_assignments')
      .update({ status: 'selesai', completed_at: new Date().toISOString() })
      .eq('id', assignmentId);

    // Ambil application_id dari assignment untuk update status
    const { data: assignment } = await supabase
      .from('survey_assignments')
      .select('application_id')
      .eq('id', assignmentId)
      .single();

    if (assignment) {
      await supabase
        .from('applications')
        .update({ status: 'survey_selesai' })
        .eq('id', assignment.application_id);
    }

    setSaving(false);
    navigate('/antrian-survey');
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Survey KLMTD</h2>

      <div className="space-y-2 mb-6">
        {INDICATORS.map((ind) => (
          <label key={ind.no} className="flex items-start gap-2 border rounded-lg p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!checked[ind.no]}
              onChange={(e) => setChecked({ ...checked, [ind.no]: e.target.checked })}
              className="mt-1"
            />
            <span className="text-sm">
              {ind.no}. {ind.label} <span className="text-gray-400">(bobot {ind.weight})</span>
            </span>
          </label>
        ))}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Skor II (penilaian objektif tambahan, maks 5)</label>
        <input
          type="number"
          min={0}
          max={5}
          step={0.5}
          value={skorII}
          onChange={(e) => setSkorII(Number(e.target.value))}
          className="w-full border rounded-lg px-3 py-2"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Catatan Keluarga</label>
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          rows={3}
        />
      </div>

      <div className="bg-gray-50 border rounded-lg p-4 mb-4 text-sm space-y-1">
        <p>Nilai Profil Keluarga: <strong>{skorProfilKeluarga.toFixed(2)}</strong></p>
        <p>Nilai Akhir: <strong>{nilaiAkhir.toFixed(2)}</strong></p>
        <p>Klasifikasi: <strong>{klasifikasi(nilaiAkhir)}</strong></p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium disabled:opacity-50"
      >
        {saving ? 'Menyimpan...' : 'Selesaikan Survey'}
      </button>
    </div>
  );
}