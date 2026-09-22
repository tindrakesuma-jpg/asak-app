import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type AppRow = { id: string; child_name_proposed: string; status: string };
type DonorRegRow = { id: string; name: string; status: string };
type LoanRow = { id: string; lender_name: string; amount: number; loan_repayments: { amount: number }[] };
type BatchRow = { id: string; batch_code: string; status: string };

const STAGE_LABEL: Record<string, string> = {
  menunggu_tinjau_form_b: 'Menunggu Tinjau Form B',
  ditolak_form_b: 'Ditolak (Form B)',
  menunggu_form_a: 'Menunggu Form A',
  masuk_antrian: 'Masuk Antrian Survey',
  sedang_disurvey: 'Sedang Disurvey',
  survey_selesai: 'Siap Rapat Keputusan',
  diputuskan: 'Sudah Diputuskan',
};

const BATCH_LABEL: Record<string, string> = {
  draft: 'Draft (Bendahara ASAK)',
  disetujui_ketua_asak: 'Disetujui Ketua ASAK',
  diteruskan_bendahara_gereja: 'Di Bendahara Gereja',
  diajukan_approver: 'Diajukan ke Approver',
  ditransfer: 'Sudah Transfer',
  direkonsiliasi: 'Direkonsiliasi',
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-4 bg-white">
      <h3 className="font-bold text-lg mb-3">{title}</h3>
      {children}
    </div>
  );
}

export default function KetuaDashboardPage() {
  const [applications, setApplications] = useState<AppRow[]>([]);
  const [donorRegs, setDonorRegs] = useState<DonorRegRow[]>([]);
  const [pledgeUnmatched, setPledgeUnmatched] = useState(0);
  const [pairingCount, setPairingCount] = useState(0);
  const [kasMasuk, setKasMasuk] = useState(0);
  const [kasKeluar, setKasKeluar] = useState(0);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      const { data: apps } = await supabase
        .from('applications')
        .select('id, child_name_proposed, status')
        .not('status', 'in', '(diputuskan,ditolak_form_b)');
      setApplications(apps ?? []);

      const { data: regs } = await supabase
        .from('donor_registrations')
        .select('id, name, status')
        .not('status', 'in', '(formalisasi_selesai,informasi_donatur_terkirim)');
      setDonorRegs(regs ?? []);

      const { count: pledgeCount } = await supabase
        .from('donor_registration_pledges')
        .select('id', { count: 'exact', head: true })
        .is('matched_pairing_id', null);
      setPledgeUnmatched(pledgeCount ?? 0);

      const { count: pairCount } = await supabase
        .from('pairings')
        .select('id', { count: 'exact', head: true })
        .eq('status_pairing', 'sudah_pairing');
      setPairingCount(pairCount ?? 0);

      const { data: kas } = await supabase.from('kas_ledger').select('direction, amount');
      setKasMasuk((kas ?? []).filter((k) => k.direction === 'masuk').reduce((s, k) => s + Number(k.amount), 0));
      setKasKeluar((kas ?? []).filter((k) => k.direction === 'keluar').reduce((s, k) => s + Number(k.amount), 0));

      const { data: loanData } = await supabase
        .from('loans')
        .select('id, lender_name, amount, loan_repayments(amount)')
        .eq('status', 'aktif');
      setLoans((loanData ?? []) as any);

      const { data: batchData } = await supabase
        .from('disbursement_batches')
        .select('id, batch_code, status')
        .not('status', 'in', '(direkonsiliasi)');
      setBatches(batchData ?? []);

      setLoading(false);
    }
    loadAll();
  }, []);

  if (loading) return <p className="text-center mt-16">Memuat dashboard...</p>;

  const saldo = kasMasuk - kasKeluar;
  const applicationsByStage = applications.reduce<Record<string, AppRow[]>>((acc, a) => {
    (acc[a.status] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto mt-8 p-4 space-y-6">
      <h2 className="text-2xl font-bold">Dashboard Ketua ASAK — Ringkasan Menyeluruh</h2>

      {/* SECTION 1: Pendaftaran Baru */}
      <SectionCard title="📋 Pendaftaran Baru & Menunggu">
        {(applicationsByStage['menunggu_tinjau_form_b']?.length ?? 0) === 0 &&
        (applicationsByStage['menunggu_form_a']?.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-500">Tidak ada pendaftaran baru menunggu.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {applicationsByStage['menunggu_tinjau_form_b']?.map((a) => (
              <div key={a.id} className="flex justify-between border-b pb-1">
                <span>{a.child_name_proposed}</span>
                <span className="text-orange-600">Menunggu Tinjau Form B</span>
              </div>
            ))}
            {applicationsByStage['menunggu_form_a']?.map((a) => (
              <div key={a.id} className="flex justify-between border-b pb-1">
                <span>{a.child_name_proposed}</span>
                <span className="text-orange-600">Menunggu Form A dari Ortu</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* SECTION 2: Proses Tim Anak */}
      <SectionCard title="👦 Proses Tim Anak Berjalan">
        {['masuk_antrian', 'sedang_disurvey', 'survey_selesai'].every(
          (s) => (applicationsByStage[s]?.length ?? 0) === 0
        ) ? (
          <p className="text-sm text-gray-500">Tidak ada proses berjalan.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {['masuk_antrian', 'sedang_disurvey', 'survey_selesai'].map((stage) =>
              applicationsByStage[stage]?.map((a) => (
                <div key={a.id} className="flex justify-between border-b pb-1">
                  <span>{a.child_name_proposed}</span>
                  {stage === 'survey_selesai' ? (
                    <Link to={`/keputusan/${a.id}`} className="text-blue-600">
                      {STAGE_LABEL[stage]} →
                    </Link>
                  ) : (
                    <span className="text-gray-600">{STAGE_LABEL[stage]}</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </SectionCard>

      {/* SECTION 3: Proses Tim Penyantun */}
      <SectionCard title="🤝 Proses Tim Penyantun">
        <div className="grid grid-cols-3 gap-3 mb-3 text-center text-sm">
          <div className="bg-blue-50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Pendaftaran Baru</p>
            <p className="font-bold text-lg">{donorRegs.length}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Pledge Belum Terpasang</p>
            <p className="font-bold text-lg">{pledgeUnmatched}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Pairing Aktif</p>
            <p className="font-bold text-lg">{pairingCount}</p>
          </div>
        </div>
        {donorRegs.length > 0 && (
          <div className="space-y-1 text-sm">
            {donorRegs.map((r) => (
              <div key={r.id} className="flex justify-between border-b pb-1">
                <span>{r.name}</span>
                <span className="text-gray-600">{r.status}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* SECTION 4: Keuangan */}
      <SectionCard title="💰 Keuangan, Cash Flow & Pinjaman">
        <div className="grid grid-cols-3 gap-3 mb-4 text-center text-sm">
          <div className="bg-green-50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Masuk</p>
            <p className="font-bold">Rp{kasMasuk.toLocaleString('id-ID')}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Keluar</p>
            <p className="font-bold">Rp{kasKeluar.toLocaleString('id-ID')}</p>
          </div>
          <div className={`rounded-lg p-2 ${saldo < 0 ? 'bg-red-100' : 'bg-blue-50'}`}>
            <p className="text-xs text-gray-500">Saldo</p>
            <p className={`font-bold ${saldo < 0 ? 'text-red-700' : ''}`}>Rp{saldo.toLocaleString('id-ID')}</p>
          </div>
        </div>

        <p className="text-sm font-semibold mb-2">Status Batch Pencairan</p>
        {batches.length === 0 && <p className="text-sm text-gray-500 mb-3">Tidak ada batch berjalan.</p>}
        <div className="space-y-1 text-sm mb-4">
          {batches.map((b) => (
            <div key={b.id} className="flex justify-between border-b pb-1">
              <span>{b.batch_code}</span>
              <span className="text-gray-600">{BATCH_LABEL[b.status] ?? b.status}</span>
            </div>
          ))}
        </div>

        <p className="text-sm font-semibold mb-2">Pinjaman Aktif</p>
        {loans.length === 0 && <p className="text-sm text-gray-500">Tidak ada pinjaman aktif.</p>}
        <div className="space-y-1 text-sm">
          {loans.map((l) => {
            const repaid = l.loan_repayments.reduce((s, r) => s + Number(r.amount), 0);
            return (
              <div key={l.id} className="flex justify-between border-b pb-1">
                <span>{l.lender_name}</span>
                <span className="text-gray-600">
                  Sisa: Rp{(l.amount - repaid).toLocaleString('id-ID')}
                </span>
              </div>
            );
          })}
        </div>
        <Link to="/pinjaman" className="text-blue-600 text-sm inline-block mt-2">Kelola Pinjaman →</Link>
      </SectionCard>
    </div>
  );
}