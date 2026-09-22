import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Commitment = {
  id: string;
  nominal: number;
  payment_frequency: string;
  pairings: { donors: { name: string } | null; anak_asak: { name: string } | null } | null;
};

type LastRealization = { commitment_id: string; period_start: string };

export default function CatatRealisasiPage() {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [lastByCommitment, setLastByCommitment] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('sponsorship_commitments')
      .select('id, nominal, payment_frequency, pairings(donors(name), anak_asak(name))')
      .eq('status', 'aktif');
    setCommitments((data ?? []) as any);

    const { data: realizations } = await supabase
      .from('sponsorship_realizations')
      .select('commitment_id, period_start')
      .order('period_start', { ascending: false });

    const lastMap: Record<string, string> = {};
    (realizations ?? []).forEach((r: LastRealization) => {
      if (!lastMap[r.commitment_id]) lastMap[r.commitment_id] = r.period_start;
    });
    setLastByCommitment(lastMap);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCatat(commitment: Commitment) {
    const today = new Date().toISOString().slice(0, 10);
    if (lastByCommitment[commitment.id] === today) {
      const confirmDouble = confirm('Sudah dicatat hari ini untuk komitmen ini. Catat lagi (dobel)?');
      if (!confirmDouble) return;
    }

    setSaving(commitment.id);
    const { data: userData } = await supabase.auth.getUser();

    const { data: existing } = await supabase
      .from('sponsorship_realizations')
      .select('period_index')
      .eq('commitment_id', commitment.id)
      .order('period_index', { ascending: false })
      .limit(1);
    const nextIndex = (existing?.[0]?.period_index ?? 0) + 1;

    await supabase.from('sponsorship_realizations').insert({
      commitment_id: commitment.id,
      period_index: nextIndex,
      period_start: today,
      period_end: today,
      nominal_in: commitment.nominal,
      payment_status: 'lunas',
    });

    await supabase.from('kas_ledger').insert({
      entry_date: today,
      direction: 'masuk',
      category: 'santunan_penyantun',
      amount: commitment.nominal,
      reference_type: 'sponsorship_commitments',
      reference_id: commitment.id,
      recorded_by_user_id: userData.user?.id,
    });

    setSaving(null);
    loadData(); // refresh supaya "terakhir dicatat" ter-update
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Catat Realisasi Santunan Masuk</h2>

      {commitments.length === 0 && <p className="text-gray-500">Belum ada komitmen aktif.</p>}

      <div className="space-y-3">
        {commitments.map((c) => {
          const lastDate = lastByCommitment[c.id];
          const today = new Date().toISOString().slice(0, 10);
          const alreadyToday = lastDate === today;
          return (
            <div key={c.id} className="border rounded-lg p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold">{c.pairings?.donors?.name} → {c.pairings?.anak_asak?.name}</p>
                <p className="text-sm text-gray-600">Rp{c.nominal.toLocaleString('id-ID')} / {c.payment_frequency}</p>
                <p className="text-xs text-gray-400">
                  {lastDate ? `Terakhir dicatat: ${lastDate}` : 'Belum pernah dicatat'}
                </p>
              </div>
              <button
                onClick={() => handleCatat(c)}
                disabled={saving !== null}
                className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
                  alreadyToday ? 'bg-gray-200 text-gray-600' : 'bg-green-600 text-white'
                }`}
              >
                {saving === c.id ? 'Mencatat...' : alreadyToday ? 'Sudah Hari Ini' : 'Catat Masuk'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}