import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Loan = {
  id: string;
  lender_type: string;
  lender_name: string;
  amount: number;
  loan_date: string;
  status: string;
  loan_repayments: { amount: number }[];
};

export default function PinjamanPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  const [lenderType, setLenderType] = useState<'gereja' | 'pihak_ketiga'>('gereja');
  const [lenderName, setLenderName] = useState('');
  const [amount, setAmount] = useState(0);
  const [purpose, setPurpose] = useState('');
  const [saving, setSaving] = useState(false);

  const [repayAmount, setRepayAmount] = useState<Record<string, number>>({});

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('loans')
      .select('id, lender_type, lender_name, amount, loan_date, status, loan_repayments(amount)')
      .order('loan_date', { ascending: false });
    setLoans((data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddLoan(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();

    const { data: loan, error } = await supabase
      .from('loans')
      .insert({
        lender_type: lenderType,
        lender_name: lenderName,
        amount,
        loan_date: new Date().toISOString().slice(0, 10),
        purpose,
        status: 'aktif',
      })
      .select('id')
      .single();

    if (error || !loan) {
      alert('Gagal: ' + error?.message);
      setSaving(false);
      return;
    }

    await supabase.from('kas_ledger').insert({
      entry_date: new Date().toISOString().slice(0, 10),
      direction: 'masuk',
      category: 'pinjaman_diterima',
      amount,
      reference_type: 'loans',
      reference_id: loan.id,
      recorded_by_user_id: userData.user?.id,
    });

    setSaving(false);
    setLenderName('');
    setAmount(0);
    setPurpose('');
    loadData();
  }

  async function handleRepay(loan: Loan) {
    const amt = repayAmount[loan.id];
    if (!amt || amt <= 0) return;

    const { data: userData } = await supabase.auth.getUser();

    await supabase.from('loan_repayments').insert({
      loan_id: loan.id,
      repayment_date: new Date().toISOString().slice(0, 10),
      amount: amt,
    });

    await supabase.from('kas_ledger').insert({
      entry_date: new Date().toISOString().slice(0, 10),
      direction: 'keluar',
      category: 'pinjaman_dibayar',
      amount: amt,
      reference_type: 'loans',
      reference_id: loan.id,
      recorded_by_user_id: userData.user?.id,
    });

    const totalRepaid = loan.loan_repayments.reduce((s, r) => s + Number(r.amount), 0) + amt;
    if (totalRepaid >= loan.amount) {
      await supabase.from('loans').update({ status: 'lunas' }).eq('id', loan.id);
    }

    setRepayAmount({ ...repayAmount, [loan.id]: 0 });
    loadData();
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4 space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-4">Catat Pinjaman Baru</h2>
        <form onSubmit={handleAddLoan} className="space-y-3 border rounded-lg p-4">
          <select value={lenderType} onChange={(e) => setLenderType(e.target.value as any)} className="w-full border rounded-lg px-3 py-2">
            <option value="gereja">Gereja</option>
            <option value="pihak_ketiga">Pihak Ketiga</option>
          </select>
          <input required placeholder="Nama Pemberi Pinjaman" value={lenderName} onChange={(e) => setLenderName(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          <input required type="number" placeholder="Nominal" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2" />
          <input placeholder="Tujuan (mis. Talangan bayar SPP)" value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
          <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white rounded-lg py-2 font-medium disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Catat Pinjaman'}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Pinjaman Aktif</h2>
        <div className="space-y-3">
          {loans.filter((l) => l.status === 'aktif').map((loan) => {
            const repaid = loan.loan_repayments.reduce((s, r) => s + Number(r.amount), 0);
            const sisa = loan.amount - repaid;
            return (
              <div key={loan.id} className="border rounded-lg p-4">
                <p className="font-semibold">{loan.lender_name} ({loan.lender_type})</p>
                <p className="text-sm text-gray-600">
                  Pokok: Rp{loan.amount.toLocaleString('id-ID')} — Terbayar: Rp{repaid.toLocaleString('id-ID')} — Sisa: <strong>Rp{sisa.toLocaleString('id-ID')}</strong>
                </p>
                <div className="flex gap-2 mt-2">
                  <input
                    type="number"
                    placeholder="Nominal cicilan"
                    value={repayAmount[loan.id] || ''}
                    onChange={(e) => setRepayAmount({ ...repayAmount, [loan.id]: Number(e.target.value) })}
                    className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                  />
                  <button onClick={() => handleRepay(loan)} className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm">
                    Bayar Cicilan
                  </button>
                </div>
              </div>
            );
          })}
          {loans.filter((l) => l.status === 'aktif').length === 0 && <p className="text-gray-500">Tidak ada pinjaman aktif.</p>}
        </div>
      </div>
    </div>
  );
}