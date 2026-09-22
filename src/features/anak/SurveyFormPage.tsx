import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const INDICATORS = [
  { no: 1, label: 'Yatim Piatu/single parent karena wafat', weight: 3, auto: false },
  { no: 2, label: 'Permasalahan Rumah Tangga (broken home)', weight: 3, auto: false },
  { no: 3, label: 'Permasalahan Ekonomi (ekonomi sulit, keluarga rukun)', weight: 2, auto: false },
  { no: 4, label: 'Tulang punggung keluarga seorang ibu', weight: 3, auto: false },
  { no: 5, label: 'Pendapatan keluarga tidak tetap tiap bulan', weight: 2, auto: false },
  { no: 6, label: 'Pendapatan keluarga < Rp3.000.000/bulan', weight: 3, auto: true },
  { no: 7, label: 'Pendapatan keluarga Rp3.000.001 - 4.500.000/bulan', weight: 2, auto: true },
  { no: 8, label: 'Pendapatan keluarga Rp4.500.001 - 6.000.000/bulan', weight: 1, auto: true },
  { no: 9, label: 'Tagihan listrik/token < Rp400.000', weight: 2, auto: true },
  { no: 10, label: 'Tidak ada bantuan rutin dari saudara', weight: 2, auto: false },
  { no: 11, label: 'Punya kredit/pinjaman > 30% pendapatan/bulan', weight: 2, auto: false },
  { no: 12, label: 'Tempat tinggal mengontrak/sewa', weight: 2, auto: false },
  { no: 13, label: 'Ada anggota keluarga sakit keras/dalam pengobatan', weight: 1, auto: false },
  { no: 14, label: 'Kepala keluarga lansia/sakit/tidak bekerja/PHK', weight: 1, auto: false },
  { no: 15, label: 'Ada anak sekolah Negeri/PTN/beasiswa ASAK di PTS mitra', weight: 2, auto: false },
  { no: 16, label: 'Punya 3+ anak yang belum bekerja', weight: 1, auto: false },
  { no: 17, label: 'Ada anggota keluarga difabel', weight: 1, auto: false },
];

type IncomeItem = { label: string; amount: number };
type Freq = 'harian' | 'mingguan' | 'bulanan';

const FREQ_MULTIPLIER: Record<Freq, number> = { harian: 30, mingguan: 30 / 7, bulanan: 1 };

const FIXED_MONTHLY_FIELDS = [
  { key: 'expense_listrik', label: 'Listrik' },
  { key: 'expense_air', label: 'Air' },
  { key: 'expense_sewa_rumah', label: 'Sewa Rumah' },
  { key: 'expense_biaya_sekolah', label: 'Biaya Sekolah Lain' },
] as const;

const FLEXIBLE_FIELDS = [
  { key: 'expense_makan', label: 'Makan Harian', defaultFreq: 'harian' as Freq },
  { key: 'expense_bensin', label: 'Bensin', defaultFreq: 'harian' as Freq },
  { key: 'expense_transport_sekolah', label: 'Transport Sekolah', defaultFreq: 'harian' as Freq },
  { key: 'expense_transport_ortu', label: 'Transport Orang Tua', defaultFreq: 'harian' as Freq },
  { key: 'expense_lainnya', label: 'Lainnya', defaultFreq: 'bulanan' as Freq },
] as const;

// ---- Komponen input angka dengan tombol +/- (langkah default 10.000, makin cepat kalau ditahan) ----
function NumberStepper({
  value,
  onChange,
  step = 10000,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  const valueRef = useRef(value);
  const timeoutRef = useRef<number | null>(null);
  const speedRef = useRef(350);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  function stop() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function stepOnce(direction: 1 | -1) {
    const next = direction === 1 ? valueRef.current + step : Math.max(0, valueRef.current - step);
    valueRef.current = next;
    onChange(next);
  }

  function start(direction: 1 | -1) {
    speedRef.current = 350;
    function repeat() {
      stepOnce(direction);
      speedRef.current = Math.max(40, speedRef.current - 25);
      timeoutRef.current = window.setTimeout(repeat, speedRef.current);
    }
    timeoutRef.current = window.setTimeout(repeat, 350);
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
        className="w-8 h-8 bg-gray-200 rounded text-lg font-bold"
      >
        −
      </button>
      <input
        type="number"
        step={step}
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-28 border rounded-lg px-2 py-1.5 text-sm text-center"
      />
      <button
        type="button"
        onMouseDown={() => { stepOnce(1); start(1); }}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={() => { stepOnce(1); start(1); }}
        onTouchEnd={stop}
        className="w-8 h-8 bg-gray-200 rounded text-lg font-bold"
      >
        +
      </button>
    </div>
  );
}

export default function SurveyFormPage() {
  const { id: assignmentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [skorII, setSkorII] = useState('');
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);

  const [incomeItems, setIncomeItems] = useState<IncomeItem[]>([
    { label: 'Suami', amount: 0 },
    { label: 'Istri', amount: 0 },
  ]);

  const [fixedExpenses, setFixedExpenses] = useState<Record<string, number>>(
    Object.fromEntries(FIXED_MONTHLY_FIELDS.map((f) => [f.key, 0]))
  );
  const [flexRaw, setFlexRaw] = useState<Record<string, number>>(
    Object.fromEntries(FLEXIBLE_FIELDS.map((f) => [f.key, 0]))
  );
  const [flexFreq, setFlexFreq] = useState<Record<string, Freq>>(
    Object.fromEntries(FLEXIBLE_FIELDS.map((f) => [f.key, f.defaultFreq]))
  );

  const totalIncome = incomeItems.reduce((s, i) => s + (i.amount || 0), 0);

  const flexMonthly: Record<string, number> = {};
  FLEXIBLE_FIELDS.forEach((f) => {
    flexMonthly[f.key] = Math.round((flexRaw[f.key] || 0) * FREQ_MULTIPLIER[flexFreq[f.key]]);
  });

  const totalExpense =
    Object.values(fixedExpenses).reduce((s, v) => s + (v || 0), 0) +
    Object.values(flexMonthly).reduce((s, v) => s + v, 0);

  const sisa = totalIncome - totalExpense;

  const autoChecked: Record<number, boolean> = {
    6: totalIncome > 0 && totalIncome < 3_000_000,
    7: totalIncome >= 3_000_001 && totalIncome <= 4_500_000,
    8: totalIncome >= 4_500_001 && totalIncome <= 6_000_000,
    9: (fixedExpenses.expense_listrik || 0) > 0 && (fixedExpenses.expense_listrik || 0) < 400_000,
  };

  function isChecked(itemNo: number) {
    const ind = INDICATORS.find((i) => i.no === itemNo);
    return ind?.auto ? autoChecked[itemNo] : !!checked[itemNo];
  }

  const skorIINum = parseFloat(skorII) || 0;
  const totalBobot = INDICATORS.filter((i) => isChecked(i.no)).reduce((sum, i) => sum + i.weight, 0);
  const skorProfilKeluarga = totalBobot / 2.5;
  const nilaiAkhir = (skorProfilKeluarga + skorIINum) / 1.5;

  function klasifikasi(nilai: number) {
    if (nilai >= 8.6) return 'A';
    if (nilai >= 7.0) return 'B';
    if (nilai >= 5.1) return 'C';
    return 'D';
  }

  function addIncomeRow() {
    setIncomeItems([...incomeItems, { label: '', amount: 0 }]);
  }
  function updateIncomeAmount(i: number, value: number) {
    setIncomeItems(incomeItems.map((row, idx) => (idx === i ? { ...row, amount: value } : row)));
  }
  function updateIncomeLabel(i: number, value: string) {
    setIncomeItems(incomeItems.map((row, idx) => (idx === i ? { ...row, label: value } : row)));
  }
  function removeIncomeRow(i: number) {
    setIncomeItems(incomeItems.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    if (!assignmentId) return;
    setSaving(true);

    const allMonthlyExpenses = { ...fixedExpenses, ...flexMonthly };

    const { data: survey, error: surveyErr } = await supabase
      .from('klmtd_surveys')
      .insert({
        survey_assignment_id: assignmentId,
        survey_date: new Date().toISOString().slice(0, 10),
        skor_profil_keluarga: skorProfilKeluarga,
        skor_ii: skorIINum,
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
      is_checked: isChecked(ind.no),
    }));
    await supabase.from('klmtd_survey_items').insert(items);

    await supabase.from('klmtd_financial_details').insert({
      survey_id: survey.id,
      income_items: incomeItems,
      ...allMonthlyExpenses,
    });

    await supabase
      .from('survey_assignments')
      .update({ status: 'selesai', completed_at: new Date().toISOString() })
      .eq('id', assignmentId);

    const { data: assignment } = await supabase
      .from('survey_assignments')
      .select('application_id')
      .eq('id', assignmentId)
      .single();

    if (assignment) {
      await supabase.from('applications').update({ status: 'survey_selesai' }).eq('id', assignment.application_id);
    }

    setSaving(false);
    navigate('/antrian-survey');
  }

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Survey KLMTD</h2>

      {/* PEMASUKAN */}
      <div className="border rounded-lg p-4 mb-6 bg-blue-50">
        <h3 className="font-semibold mb-3">Wawancara Pemasukan</h3>
        {incomeItems.map((item, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <input
              placeholder="Sumber (mis. Suami, Istri)"
              value={item.label}
              onChange={(e) => updateIncomeLabel(i, e.target.value)}
              className="flex-1 border rounded-lg px-2 py-1.5 text-sm"
            />
            <NumberStepper value={item.amount} onChange={(v) => updateIncomeAmount(i, v)} />
            <button onClick={() => removeIncomeRow(i)} className="text-red-600 text-sm px-1">✕</button>
          </div>
        ))}
        <button onClick={addIncomeRow} className="text-sm text-blue-600">+ Tambah sumber pemasukan</button>
        <p className="text-sm font-semibold mt-3">Total Pemasukan: Rp{totalIncome.toLocaleString('id-ID')}</p>
      </div>

      {/* PENGELUARAN BULANAN TETAP */}
      <div className="border rounded-lg p-4 mb-4 bg-orange-50">
        <h3 className="font-semibold mb-3">Pengeluaran Bulanan</h3>
        {FIXED_MONTHLY_FIELDS.map((f) => (
          <div key={f.key} className="flex justify-between items-center gap-2 mb-2">
            <label className="text-sm w-36">{f.label}</label>
            <NumberStepper
              value={fixedExpenses[f.key]}
              onChange={(v) => setFixedExpenses({ ...fixedExpenses, [f.key]: v })}
            />
          </div>
        ))}
      </div>

      {/* PENGELUARAN FLEKSIBEL (harian/mingguan/bulanan) */}
      <div className="border rounded-lg p-4 mb-6 bg-orange-50">
        <h3 className="font-semibold mb-3">Pengeluaran Lain (pilih frekuensi sesuai jawaban keluarga)</h3>
        {FLEXIBLE_FIELDS.map((f) => (
          <div key={f.key} className="mb-3">
            <div className="flex justify-between items-center gap-2">
              <label className="text-sm w-32">{f.label}</label>
              <NumberStepper
                value={flexRaw[f.key]}
                onChange={(v) => setFlexRaw({ ...flexRaw, [f.key]: v })}
                step={f.key === 'expense_makan' ? 5000 : 10000}
              />
              <select
                value={flexFreq[f.key]}
                onChange={(e) => setFlexFreq({ ...flexFreq, [f.key]: e.target.value as Freq })}
                className="border rounded-lg px-2 py-1.5 text-xs"
              >
                <option value="harian">/hari</option>
                <option value="mingguan">/minggu</option>
                <option value="bulanan">/bulan</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 text-right mt-1">≈ Rp{flexMonthly[f.key].toLocaleString('id-ID')}/bulan</p>
          </div>
        ))}
        <p className="text-sm font-semibold mt-2">Total Pengeluaran: Rp{totalExpense.toLocaleString('id-ID')}</p>
      </div>

      <div
        className={`border rounded-lg p-4 mb-6 text-center font-bold ${
          sisa < 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}
      >
        Sisa Tersedia untuk Anak: Rp{sisa.toLocaleString('id-ID')}
      </div>

      {/* INDIKATOR KLMTD */}
      <h3 className="font-semibold mb-2">17 Indikator KLMTD</h3>
      <div className="space-y-2 mb-6">
        {INDICATORS.map((ind) => {
          const checkedNow = isChecked(ind.no);
          return (
            <label
              key={ind.no}
              className={`flex items-start gap-2 border rounded-lg p-3 ${ind.auto ? '' : 'cursor-pointer'} ${
                ind.auto ? (checkedNow ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-200') : ''
              }`}
            >
              <input
                type="checkbox"
                checked={checkedNow}
                disabled={ind.auto}
                onChange={(e) => !ind.auto && setChecked({ ...checked, [ind.no]: e.target.checked })}
                className="mt-1"
              />
              <span className="text-sm">
                {ind.no}. {ind.label} <span className="text-gray-400">(bobot {ind.weight})</span>
                {ind.auto && <span className="text-xs ml-2 italic text-gray-500">— otomatis dari data keuangan</span>}
              </span>
            </label>
          );
        })}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Skor II (penilaian objektif tambahan, maks 5)</label>
        <input
          type="number"
          min={0}
          max={5}
          step={0.5}
          value={skorII}
          onChange={(e) => setSkorII(e.target.value)}
          placeholder="0"
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