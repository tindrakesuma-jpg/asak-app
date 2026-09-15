import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const SCHOOL_YEAR = '2026/2027';

type Pledge = {
  id: string;
  program: string;
  planned_nominal: number;
  payment_frequency: string;
  registration_id: string;
  donor_registrations: { name: string; donor_id: string } | null;
};

type Anak = {
  id: string;
  name: string;
  education_level: string | null;
  school_name: string;
};

function programFromLevel(level: string | null) {
  return level === 'PT' ? 'AYOKULIAH' : 'AYOSEKOLAH';
}

export default function PairingPage() {
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [availableAnak, setAvailableAnak] = useState<Anak[]>([]);
  const [selectedAnak, setSelectedAnak] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);

    const { data: pledgeData } = await supabase
      .from('donor_registration_pledges')
      .select('id, program, planned_nominal, payment_frequency, registration_id, donor_registrations(name, donor_id)')
      .is('matched_pairing_id', null);

    const { data: pairedAnakRows } = await supabase
      .from('pairings')
      .select('anak_id')
      .eq('status_pairing', 'sudah_pairing');
    const pairedIds = new Set((pairedAnakRows ?? []).map((p) => p.anak_id));

    const { data: anakData } = await supabase
      .from('anak_asak')
      .select('id, name, education_level, school_name')
      .eq('status', 'active');

    setPledges(((pledgeData ?? []) as any).filter((p: Pledge) => p.donor_registrations?.donor_id));
    setAvailableAnak((anakData ?? []).filter((a) => !pairedIds.has(a.id)));
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleMatch(pledge: Pledge) {
    const anakId = selectedAnak[pledge.id];
    if (!anakId || !pledge.donor_registrations?.donor_id) return;

    setMatching(pledge.id);

    const { data: rate } = await supabase
      .from('donor_sponsorship_rates')
      .select('id')
      .eq('school_year', SCHOOL_YEAR)
      .eq('program', pledge.program)
      .maybeSingle();

    const { data: pairing, error: pairingErr } = await supabase
      .from('pairings')
      .insert({
        donor_id: pledge.donor_registrations.donor_id,
        anak_id: anakId,
        status_pairing: 'sudah_pairing',
        start_date: new Date().toISOString().slice(0, 10),
      })
      .select('id')
      .single();

    if (pairingErr || !pairing) {
      alert('Gagal membuat pairing: ' + pairingErr?.message);
      setMatching(null);
      return;
    }

    const { error: commitErr } = await supabase.from('sponsorship_commitments').insert({
      pairing_id: pairing.id,
      rate_id: rate?.id ?? null,
      school_year: SCHOOL_YEAR,
      nominal: pledge.planned_nominal,
      payment_frequency: pledge.payment_frequency,
      status: 'aktif',
      auto_renew: true,
      start_date: new Date().toISOString().slice(0, 10),
    });

    if (commitErr) {
      alert('Gagal membuat komitmen: ' + commitErr.message);
      setMatching(null);
      return;
    }

    await supabase
      .from('donor_registration_pledges')
      .update({ matched_pairing_id: pairing.id })
      .eq('id', pledge.id);

    setMatching(null);
    loadData();
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Pencocokan Pairing — Pledge Belum Terpasangkan</h2>

      {pledges.length === 0 && <p className="text-gray-500">Tidak ada pledge yang menunggu.</p>}

      <div className="space-y-4">
        {pledges.map((pledge) => {
          const options = availableAnak.filter((a) => programFromLevel(a.education_level) === pledge.program);
          return (
            <div key={pledge.id} className="border rounded-lg p-4">
              <p className="font-semibold">{pledge.donor_registrations?.name}</p>
              <p className="text-sm text-gray-600 mb-2">
                {pledge.program} — Rp{pledge.planned_nominal.toLocaleString('id-ID')}/{pledge.payment_frequency}
              </p>

              {options.length === 0 ? (
                <p className="text-sm text-orange-600">Belum ada anak tersedia di program ini.</p>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={selectedAnak[pledge.id] ?? ''}
                    onChange={(e) => setSelectedAnak({ ...selectedAnak, [pledge.id]: e.target.value })}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Pilih anak...</option>
                    {options.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} — {a.school_name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleMatch(pledge)}
                    disabled={!selectedAnak[pledge.id] || matching !== null}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap"
                  >
                    {matching === pledge.id ? 'Memasangkan...' : 'Pasangkan'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}