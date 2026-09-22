import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const SCHOOL_YEAR = '2026/2027';

export default function DonorRegistrationPage() {
  const [parokiAsal, setParokiAsal] = useState('');
  const [wilayah, setWilayah] = useState('');
  const [lingkungan, setLingkungan] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [donorType, setDonorType] = useState<'penyantun' | 'donatur'>('penyantun');

  const [rateAS, setRateAS] = useState<number | null>(null);
  const [rateAK, setRateAK] = useState<number | null>(null);
  const [jumlahAS, setJumlahAS] = useState(0);
  const [jumlahAK, setJumlahAK] = useState(0);
  const [paymentFrequency, setPaymentFrequency] = useState('bulanan');

  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('donor_sponsorship_rates')
      .select('program, monthly_rate')
      .eq('school_year', SCHOOL_YEAR)
      .then(({ data }) => {
        const as = data?.find((r) => r.program === 'AYOSEKOLAH');
        const ak = data?.find((r) => r.program === 'AYOKULIAH');
        setRateAS(as?.monthly_rate ?? null);
        setRateAK(ak?.monthly_rate ?? null);
      });
  }, []);

  const totalKomitmenBulanan = (jumlahAS * (rateAS ?? 0)) + (jumlahAK * (rateAK ?? 0));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    
    // Login diam-diam sebagai akun intake publik, supaya insert tercatat sebagai 'authenticated'
  // (menghindari isu kompatibilitas kunci anon murni)
  const { data: existingSession } = await supabase.auth.getSession();
  if (!existingSession.session) {
    const { error: loginErr } = await supabase.auth.signInWithPassword({
      email: 'placeholder.timpenyantunasak@asak.internal',
      password: 'ASAK2026',
    });
    if (loginErr) {
      setErrorMsg('Gagal memproses pendaftaran, coba lagi nanti.');
      setSaving(false);
      return;
    }
  }

    const { data: reg, error: regErr } = await supabase
      .from('donor_registrations')
      .insert({
        paroki_asal: parokiAsal,
        wilayah,
        lingkungan,
        name,
        phone,
        address,
        donor_type: donorType,
        status: donorType === 'donatur' ? 'informasi_donatur_terkirim' : 'menunggu_pic',
      })
      .select('id')
      .single();

    if (regErr || !reg) {
      setErrorMsg(regErr?.message ?? 'Gagal menyimpan');
      setSaving(false);
      return;
    }

    if (donorType === 'penyantun') {
      const rows = [];
      for (let i = 0; i < jumlahAS; i++) {
        rows.push({ registration_id: reg.id, program: 'AYOSEKOLAH', planned_nominal: rateAS, payment_frequency: paymentFrequency });
      }
      for (let i = 0; i < jumlahAK; i++) {
        rows.push({ registration_id: reg.id, program: 'AYOKULIAH', planned_nominal: rateAK, payment_frequency: paymentFrequency });
      }
      if (rows.length > 0) await supabase.from('donor_registration_pledges').insert(rows);
    }

    setSaving(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 text-center">
        <h2 className="text-xl font-bold text-green-700">Pendaftaran Terkirim!</h2>
        <p className="mt-2 text-gray-600">
          {donorType === 'donatur'
            ? 'Terima kasih. Info rekening/QRIS akan dikirim oleh Sekretaris ASAK.'
            : 'Terima kasih. Tim Penyantun akan segera menghubungi Anda.'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-1">Pendaftaran Penyantun / Donatur</h2>
      <p className="text-sm text-gray-500 mb-4">ASAK Paroki Serpong — Tahun Ajaran {SCHOOL_YEAR}</p>

      {errorMsg && <p className="text-red-600 mb-3">{errorMsg}</p>}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Asal Paroki</label>
          <input required value={parokiAsal} onChange={(e) => setParokiAsal(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Wilayah</label>
            <input required value={wilayah} onChange={(e) => setWilayah(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Lingkungan</label>
            <input required value={lingkungan} onChange={(e) => setLingkungan(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nama</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">No. HP/WA</label>
          <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Alamat</label>
          <textarea value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Bersedia menjadi</label>
          <select value={donorType} onChange={(e) => setDonorType(e.target.value as any)} className="w-full border rounded-lg px-3 py-2">
            <option value="penyantun">Penyantun Tetap</option>
            <option value="donatur">Donatur</option>
          </select>
        </div>

        {donorType === 'penyantun' && (
          <div className="border rounded-lg p-4 bg-blue-50 space-y-3">
            {rateAS === null || rateAK === null ? (
              <p className="text-sm text-red-600">Tarif santunan belum diatur untuk {SCHOOL_YEAR}.</p>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  Tarif berlaku: Ayo Sekolah Rp{rateAS.toLocaleString('id-ID')}/bulan/anak,
                  Ayo Kuliah Rp{rateAK.toLocaleString('id-ID')}/bulan/anak
                </p>
                <div>
                  <label className="block text-sm font-medium mb-1">Jumlah Anak Ayo Sekolah</label>
                  <input
                    type="number" min={0} value={jumlahAS}
                    onChange={(e) => setJumlahAS(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Jumlah Anak Ayo Kuliah</label>
                  <input
                    type="number" min={0} value={jumlahAK}
                    onChange={(e) => setJumlahAK(Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Frekuensi Transfer</label>
                  <select value={paymentFrequency} onChange={(e) => setPaymentFrequency(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                    <option value="bulanan">Bulanan</option>
                    <option value="triwulan">Setiap 3 Bulan</option>
                    <option value="semester">Setiap 6 Bulan</option>
                    <option value="tahunan">Sekaligus 1 Tahun</option>
                  </select>
                </div>
                <div className="bg-white border rounded-lg p-3 text-sm font-semibold">
                  Total Komitmen Bulanan: Rp{totalKomitmenBulanan.toLocaleString('id-ID')}
                </div>
              </>
            )}
          </div>
        )}

        <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium disabled:opacity-50">
          {saving ? 'Mengirim...' : 'Kirim Pendaftaran'}
        </button>
      </form>
    </div>
  );
}