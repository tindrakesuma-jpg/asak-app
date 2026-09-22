import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Donor = {
  id: string;
  donor_code: string;
  name: string;
};

type PairedAnak = {
  id: string;
  status_pairing: string;
  anak_asak: {
    name: string;
    school_name: string;
    education_level: string | null;
    class_semester: string | null;
  } | null;
  sponsorship_commitments: {
    nominal: number;
    payment_frequency: string;
    status: string;
  }[];
};

const STORAGE_KEY = 'asak_verified_donor_id';

export default function DashboardPenyantunPage() {
  const [donorId, setDonorId] = useState<string | null>(() => sessionStorage.getItem(STORAGE_KEY));
  const [donor, setDonor] = useState<Donor | null>(null);
  const [paired, setPaired] = useState<PairedAnak[]>([]);
  const [loading, setLoading] = useState(false);

  const [inputCode, setInputCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function loadDashboard(id: string) {
    setLoading(true);
    const { data: donorData } = await supabase
      .from('donors')
      .select('id, donor_code, name')
      .eq('id', id)
      .single();
    setDonor(donorData);

    const { data: pairingData } = await supabase
      .from('pairings')
      .select(`
        id, status_pairing,
        anak_asak (name, school_name, education_level, class_semester),
        sponsorship_commitments (nominal, payment_frequency, status)
      `)
      .eq('donor_id', id)
      .eq('status_pairing', 'sudah_pairing');

    setPaired((pairingData ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    if (donorId) loadDashboard(donorId);
  }, [donorId]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setVerifyError(null);

    const { data, error } = await supabase
      .from('donors')
      .select('id')
      .or(`donor_code.eq.${inputCode},phone.eq.${inputCode}`)
      .maybeSingle();

    setVerifying(false);
    if (error || !data) {
      setVerifyError('Kode Donor / No. HP tidak ditemukan. Coba lagi atau hubungi Tim Penyantun.');
      return;
    }

    sessionStorage.setItem(STORAGE_KEY, data.id);
    setDonorId(data.id);
  }

  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEY);
    setDonorId(null);
    setDonor(null);
    setPaired([]);
    setInputCode('');
  }

  if (!donorId) {
    return (
      <div className="max-w-sm mx-auto mt-16 p-6">
        <h2 className="text-xl font-bold mb-1 text-center">Verifikasi Identitas</h2>
        <p className="text-sm text-gray-500 mb-4 text-center">
          Masukkan Kode Donor atau No. HP yang terdaftar untuk melihat anak dampingan Anda.
        </p>
        {verifyError && <p className="text-red-600 text-sm mb-3">{verifyError}</p>}
        <form onSubmit={handleVerify} className="space-y-3">
          <input
            required
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            placeholder="Kode Donor atau No. HP"
            className="w-full border rounded-lg px-3 py-2"
          />
          <button type="submit" disabled={verifying} className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium disabled:opacity-50">
            {verifying ? 'Memeriksa...' : 'Masuk'}
          </button>
        </form>
      </div>
    );
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-md mx-auto mt-8 p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">{donor?.name}</h2>
          <p className="text-sm text-gray-500">Kode: {donor?.donor_code}</p>
        </div>
        <button onClick={handleLogout} className="text-sm text-gray-500 underline">Ganti Akun</button>
      </div>

      <h3 className="font-semibold mb-3">Anak Dampingan Saya</h3>
      {paired.length === 0 && <p className="text-gray-500">Belum ada anak yang dipasangkan.</p>}

      <div className="space-y-3">
        {paired.map((p) => {
          const commitment = p.sponsorship_commitments?.[0];
          return (
            <div key={p.id} className="border rounded-lg p-4">
              <p className="font-semibold">{p.anak_asak?.name}</p>
              <p className="text-sm text-gray-600">
                {p.anak_asak?.education_level} {p.anak_asak?.class_semester} — {p.anak_asak?.school_name}
              </p>
              {commitment && (
                <div className="mt-2 pt-2 border-t text-sm">
                  <p>Komitmen: Rp{commitment.nominal.toLocaleString('id-ID')} / {commitment.payment_frequency}</p>
                  <p className="text-gray-500">Status: {commitment.status}</p>
                </div>
              )}
{paired.map((p) => (
  <AnakDampinganCard key={p.id} pairing={p} donorId={donorId!} />
))}
            </div>
          );
        })}
      </div>
    </div>
  );
  function AnakDampinganCard({ pairing, donorId }: { pairing: PairedAnak; donorId: string }) {
  const [reports, setReports] = useState<any[]>([]);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('academic_reports')
      .select('id, report_type, school_year, semester, file_url, report_comments(comment_text)')
      .eq('status', 'dipublikasikan')
      .then(({ data }) => setReports(data ?? []));
  }, []);

  const commitment = pairing.sponsorship_commitments?.[0];

  async function sendComment(reportId: string) {
    const text = commentText[reportId];
    if (!text) return;
    setSending(reportId);
    await supabase.from('report_comments').insert({
      report_id: reportId,
      donor_id: donorId,
      comment_text: text,
    });
    setSending(null);
    setCommentText({ ...commentText, [reportId]: '' });
    alert('Komentar terkirim, akan diteruskan Tim ASAK.');
  }

  return (
    <div className="border rounded-lg p-4">
      <p className="font-semibold">{pairing.anak_asak?.name}</p>
      <p className="text-sm text-gray-600">
        {pairing.anak_asak?.education_level} {pairing.anak_asak?.class_semester} — {pairing.anak_asak?.school_name}
      </p>
      {commitment && (
        <div className="mt-2 pt-2 border-t text-sm">
          <p>Komitmen: Rp{commitment.nominal.toLocaleString('id-ID')} / {commitment.payment_frequency}</p>
        </div>
      )}

      <div className="mt-3 pt-3 border-t">
        <p className="text-sm font-semibold mb-2">Laporan Akademik</p>
        {reports.length === 0 && <p className="text-xs text-gray-400">Belum ada laporan dipublikasikan.</p>}
        {reports.map((r) => (
          <div key={r.id} className="bg-gray-50 rounded-lg p-2 mb-2 text-sm">
            <a href={r.file_url} target="_blank" rel="noreferrer" className="text-blue-600">
              {r.report_type} — {r.school_year} Sem {r.semester}
            </a>
            <div className="flex gap-2 mt-1">
              <input
                value={commentText[r.id] || ''}
                onChange={(e) => setCommentText({ ...commentText, [r.id]: e.target.value })}
                placeholder="Tulis komentar/apresiasi..."
                className="flex-1 border rounded px-2 py-1 text-xs"
              />
              <button onClick={() => sendComment(r.id)} disabled={sending !== null} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">
                Kirim
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
}