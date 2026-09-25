import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const CURRENT_SCHOOL_YEAR = '2026/2027';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  menunggu_tinjau_form_b: { label: 'Menunggu Tinjau', color: 'text-orange-600' },
  ditolak_form_b: { label: 'Ditolak', color: 'text-red-600' },
  menunggu_form_a: { label: 'Menunggu Form A', color: 'text-blue-600' },
  menunggu_form_h: { label: 'Menunggu Form H', color: 'text-blue-600' },
  masuk_antrian: { label: 'Antrian Survey', color: 'text-gray-600' },
  sedang_disurvey: { label: 'Sedang Disurvey', color: 'text-gray-600' },
  survey_selesai: { label: 'Menunggu Rapat', color: 'text-purple-600' },
  perlu_followup: { label: 'Perlu Follow-up', color: 'text-yellow-700' },
  menunggu_sk: { label: 'Menunggu SK Sekretaris', color: 'text-indigo-600' },
  diputuskan: { label: 'Selesai', color: 'text-green-600' },
};

type InProcessItem = {
  id: string;
  child_name_proposed: string;
  status: string;
  target_education_level: string;
  target_school_name: string;
};

type OtherAnak = {
  id: string;
  name: string;
  school_name: string;
  education_level: string | null;
  lastPaymentDate: string | null;
  lastReportYear: string | null;
  hasCurrentYearReport: boolean;
  frequency: string;
  isOverdue: boolean;};

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_LABEL[status] ?? { label: status, color: 'text-gray-600' };
  return <span className={`text-xs font-semibold ${info.color}`}>{info.label}</span>;
}

export default function StatusSemuaAnakPage() {
  const [newChildren, setNewChildren] = useState<InProcessItem[]>([]);
  const [renewalChildren, setRenewalChildren] = useState<InProcessItem[]>([]);
  const [otherAnak, setOtherAnak] = useState<OtherAnak[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);

      const { data: newApps } = await supabase
        .from('applications')
        .select('id, child_name_proposed, status, target_education_level, target_school_name, anak_id')
        .eq('is_new_child', true)
        .not('status', 'in', '(diputuskan,ditolak_form_b)');
      setNewChildren(newApps ?? []);

      const { data: hApps } = await supabase
        .from('applications')
        .select('id, child_name_proposed, status, target_education_level, target_school_name, anak_id')
        .eq('application_type', 'H')
        .not('status', 'in', '(diputuskan,ditolak_form_b)');
      setRenewalChildren(hApps ?? []);

      const inProcessAnakIds = new Set(
        [...(newApps ?? []), ...(hApps ?? [])].map((a: any) => a.anak_id).filter(Boolean)
      );

      const { data: allAnak } = await supabase
        .from('anak_asak')
        .select('id, name, school_name, education_level')
        .eq('status', 'active')
        .order('name');

      const relevantAnak = (allAnak ?? []).filter((a) => !inProcessAnakIds.has(a.id));

      const result: OtherAnak[] = [];
      for (const anak of relevantAnak) {
        const { data: paidBatches } = await supabase
          .from('disbursement_requests')
          .select('disbursement_batches(status, approved_date)')
          .eq('anak_id', anak.id);
        const { data: packages } = await supabase
            .from('bantuan_packages')
            .select('payment_frequency')
            .eq('anak_id', anak.id)
            .limit(1);
const frequency = packages?.[0]?.payment_frequency ?? 'semesteran';
        const paidDates = (paidBatches ?? [])
          .map((p: any) => p.disbursement_batches)
          .filter((b: any) => b?.status === 'ditransfer')
          .map((b: any) => b.approved_date)
          .filter(Boolean)
          .sort()
          .reverse();

        const { data: reports } = await supabase
          .from('academic_reports')
          .select('school_year, semester')
          .eq('anak_id', anak.id)
          .order('school_year', { ascending: false })
          .limit(5);

        const hasCurrentYear = (reports ?? []).some((r) => r.school_year === CURRENT_SCHOOL_YEAR);
        const lastReport = reports?.[0];

const thresholdDays = frequency === 'bulanan' ? 60 : 210; // 2 bulan vs ~7 bulan
const daysSincePaid = paidDates[0]
  ? Math.floor((Date.now() - new Date(paidDates[0]).getTime()) / (1000 * 60 * 60 * 24))
  : null;
const isOverdue = daysSincePaid === null || daysSincePaid > thresholdDays;

result.push({
  id: anak.id,
  name: anak.name,
  school_name: anak.school_name,
  education_level: anak.education_level,
  lastPaymentDate: paidDates[0] ?? null,
  lastReportYear: lastReport ? `${lastReport.school_year} Sem ${lastReport.semester}` : null,
  hasCurrentYearReport: hasCurrentYear,
  frequency,
  isOverdue,
});
      }
      setOtherAnak(result);

      setLoading(false);
    }
    loadAll();
  }, []);

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-3xl mx-auto mt-8 p-4 space-y-8">
      <h2 className="text-2xl font-bold">Status Semua Anak ASAK</h2>

      <div>
        <h3 className="text-lg font-bold mb-3">🆕 Anak Baru — Dalam Proses ({newChildren.length})</h3>
        {newChildren.length === 0 && <p className="text-sm text-gray-500">Tidak ada.</p>}
        <div className="space-y-2">
          {newChildren.map((item) => (
            <div key={item.id} className="border rounded-lg p-3 flex justify-between items-center">
              <div>
                <p className="font-medium text-sm">{item.child_name_proposed}</p>
                <p className="text-xs text-gray-500">{item.target_education_level} — {item.target_school_name}</p>
              </div>
              <StatusBadge status={item.status} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold mb-3">🔄 Daftar Ulang — Dalam Proses ({renewalChildren.length})</h3>
        {renewalChildren.length === 0 && <p className="text-sm text-gray-500">Tidak ada.</p>}
        <div className="space-y-2">
          {renewalChildren.map((item) => (
            <div key={item.id} className="border rounded-lg p-3 flex justify-between items-center">
              <div>
                <p className="font-medium text-sm">{item.child_name_proposed}</p>
                <p className="text-xs text-gray-500">{item.target_education_level} — {item.target_school_name}</p>
              </div>
              <StatusBadge status={item.status} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold mb-3">✅ Anak Aktif Lainnya — Tidak Dalam Proses ({otherAnak.length})</h3>
        {otherAnak.length === 0 && <p className="text-sm text-gray-500">Tidak ada.</p>}
        <div className="space-y-2">
          {otherAnak.map((anak) => (
            <div key={anak.id} className="border rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-sm">{anak.name}</p>
                  <p className="text-xs text-gray-500">{anak.education_level} — {anak.school_name}</p>
                </div>
                <Link to={`/pic-pool`} className="text-xs text-blue-600">Kelola →</Link>
              </div>
              <div className="mt-2 flex gap-3 text-xs">
                <span className={anak.isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                💰 {anak.lastPaymentDate ? `Terakhir dibayar: ${anak.lastPaymentDate}` : 'Belum pernah dibayar'}
                {' '}({anak.frequency === 'bulanan' ? 'bulanan' : 'per semester'})
                {anak.isOverdue && ' ⚠️ Terlambat!'}
                </span>
                <span className={anak.hasCurrentYearReport ? 'text-green-600' : 'text-red-600 font-semibold'}>
                  📄 {anak.hasCurrentYearReport
                    ? `Rapor ${CURRENT_SCHOOL_YEAR} sudah ada`
                    : `Belum ada rapor ${CURRENT_SCHOOL_YEAR}${anak.lastReportYear ? ` (terakhir: ${anak.lastReportYear})` : ' (belum pernah)'}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}