import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type ReadyItem = {
  id: string;
  child_name_proposed: string;
  target_education_level: string;
  target_school_name: string;
};

type SurveyDetail = {
  nilai_akhir: number;
  klasifikasi: string;
  catatan_keluarga: string | null;
  foto_rumah_url: string | null;
  foto_wawancara_url: string | null;
  checkedItems: { item_no: number; item_label: string; weight: number; is_checked: boolean }[];
  financial: { totalIncome: number; totalExpense: number; sisa: number } | null;
  deadlines: { item_label: string; amount: number; deadline_date: string | null; consequence: string; consequence_detail: string | null }[];
} | null;

export default function RapatKeputusanPage() {
  const [items, setItems] = useState<ReadyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, SurveyDetail>>({});
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    supabase
      .from('applications')
      .select('id, child_name_proposed, target_education_level, target_school_name')
      .eq('status', 'survey_selesai')
      .order('id')
      .then(({ data }) => {
        setItems(data ?? []);
        setLoading(false);
      });
  }, []);

  async function toggleExpand(applicationId: string) {
    if (expandedId === applicationId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(applicationId);

    if (detailCache[applicationId]) return; // sudah pernah dimuat

    setDetailLoading(true);

    const { data: assignment } = await supabase
      .from('survey_assignments')
      .select('id, klmtd_surveys(id, nilai_akhir, klasifikasi, catatan_keluarga, foto_rumah_url, foto_wawancara_url)')
      .eq('application_id', applicationId)
      .maybeSingle();

    const surveyRaw = (assignment as any)?.klmtd_surveys;
    const survey = Array.isArray(surveyRaw) ? surveyRaw[0] : surveyRaw;

    if (!survey) {
      setDetailCache((prev) => ({ ...prev, [applicationId]: null }));
      setDetailLoading(false);
      return;
    }

    const { data: checkedItems } = await supabase
      .from('klmtd_survey_items')
      .select('item_no, item_label, weight, is_checked')
      .eq('survey_id', survey.id)
      .order('item_no');

    const { data: financialRow } = await supabase
      .from('klmtd_financial_details')
      .select('income_items, expense_makan, expense_listrik, expense_air, expense_sewa_rumah, expense_bensin, expense_transport_sekolah, expense_transport_ortu, expense_biaya_sekolah, expense_lainnya')
      .eq('survey_id', survey.id)
      .maybeSingle();

    let financial = null;
    if (financialRow) {
      const totalIncome = (financialRow.income_items ?? []).reduce((s: number, i: any) => s + (i.amount || 0), 0);
      const totalExpense = [
        financialRow.expense_makan, financialRow.expense_listrik, financialRow.expense_air,
        financialRow.expense_sewa_rumah, financialRow.expense_bensin, financialRow.expense_transport_sekolah,
        financialRow.expense_transport_ortu, financialRow.expense_biaya_sekolah, financialRow.expense_lainnya,
      ].reduce((s, v) => s + (Number(v) || 0), 0);
      financial = { totalIncome, totalExpense, sisa: totalIncome - totalExpense };
    }

    const { data: deadlines } = await supabase
      .from('survey_payment_deadlines')
      .select('item_label, amount, deadline_date, consequence, consequence_detail')
      .eq('survey_id', survey.id);

    setDetailCache((prev) => ({
      ...prev,
      [applicationId]: {
        nilai_akhir: survey.nilai_akhir,
        klasifikasi: survey.klasifikasi,
        catatan_keluarga: survey.catatan_keluarga,
        foto_rumah_url: survey.foto_rumah_url,
        foto_wawancara_url: survey.foto_wawancara_url,
        checkedItems: checkedItems ?? [],
        financial,
        deadlines: deadlines ?? [],
      },
    }));
    setDetailLoading(false);
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Rapat Komite — Siap Diputuskan</h2>
      {items.length === 0 && <p className="text-gray-500">Tidak ada yang siap diputuskan.</p>}

      <div className="space-y-3">
        {items.map((item) => {
          const isOpen = expandedId === item.id;
          const detail = detailCache[item.id];
          return (
            <div key={item.id} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleExpand(item.id)}
                className="w-full text-left p-4 hover:bg-gray-50 flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold">{item.child_name_proposed}</p>
                  <p className="text-sm text-gray-600">{item.target_education_level} — {item.target_school_name}</p>
                </div>
                <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="p-4 border-t bg-gray-50 space-y-3 text-sm">
                  {detailLoading && !detail && <p>Memuat detail...</p>}

                  {detail === null && <p className="text-orange-600">Survey belum ditemukan untuk anak ini.</p>}

                  {detail && (
                    <>
                      <div className="bg-white rounded-lg p-3 border">
                        <p>Nilai Akhir: <strong>{detail.nilai_akhir}</strong> — Klasifikasi: <strong>{detail.klasifikasi}</strong></p>
                        {detail.catatan_keluarga && <p className="text-gray-600 mt-1 italic">"{detail.catatan_keluarga}"</p>}
                        <div className="flex gap-2 mt-2">
                          {detail.foto_rumah_url && (
                            <a href={detail.foto_rumah_url} target="_blank" rel="noreferrer">
                              <img src={detail.foto_rumah_url} className="w-16 h-16 object-cover rounded-lg border" />
                            </a>
                          )}
                          {detail.foto_wawancara_url && (
                            <a href={detail.foto_wawancara_url} target="_blank" rel="noreferrer">
                              <img src={detail.foto_wawancara_url} className="w-16 h-16 object-cover rounded-lg border" />
                            </a>
                          )}
                        </div>
                      </div>

                      {detail.financial && (
                        <div className="bg-blue-50 rounded-lg p-3 border">
                          <p className="font-semibold mb-1">Keuangan Keluarga</p>
                          <p>Pemasukan: Rp{detail.financial.totalIncome.toLocaleString('id-ID')}</p>
                          <p>Pengeluaran: Rp{detail.financial.totalExpense.toLocaleString('id-ID')}</p>
                          <p className={detail.financial.sisa < 0 ? 'text-red-700 font-bold' : 'text-green-700 font-bold'}>
                            Sisa: Rp{detail.financial.sisa.toLocaleString('id-ID')}
                          </p>
                        </div>
                      )}

                      <div className="bg-white rounded-lg p-3 border">
                        <p className="font-semibold mb-1">17 Indikator KLMTD</p>
                        <div className="grid grid-cols-1 gap-0.5">
                          {detail.checkedItems.map((ci) => (
                            <p key={ci.item_no} className={ci.is_checked ? 'text-green-700' : 'text-gray-400'}>
                              {ci.is_checked ? '✓' : '✕'} {ci.item_no}. {ci.item_label} (bobot {ci.weight})
                            </p>
                          ))}
                        </div>
                      </div>

                      {detail.deadlines.length > 0 && (
                        <div className="bg-purple-50 rounded-lg p-3 border">
                          <p className="font-semibold mb-1">Deadline Biaya Sekolah</p>
                          {detail.deadlines.map((d, i) => (
                            <div key={i} className="border-b last:border-b-0 py-1">
                              <p>{d.item_label} — Rp{Number(d.amount).toLocaleString('id-ID')} — {d.deadline_date || '(tanggal belum diisi)'}</p>
                              {d.consequence !== 'tidak_ada' && (
                                <p className="text-xs text-red-600">Risiko: {d.consequence_detail || d.consequence}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  <Link
                    to={`/keputusan/${item.id}`}
                    className="block text-center bg-blue-600 text-white rounded-lg py-2 font-medium mt-2"
                  >
                    Buat Keputusan →
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}