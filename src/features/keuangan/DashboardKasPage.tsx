import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Entry = {
  id: string;
  entry_date: string;
  direction: string;
  category: string;
  amount: number;
};

export default function DashboardKasPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('kas_ledger')
      .select('id, entry_date, direction, category, amount')
      .order('entry_date', { ascending: false })
      .then(({ data }) => {
        setEntries(data ?? []);
        setLoading(false);
      });
  }, []);

  const totalMasuk = entries.filter((e) => e.direction === 'masuk').reduce((s, e) => s + Number(e.amount), 0);
  const totalKeluar = entries.filter((e) => e.direction === 'keluar').reduce((s, e) => s + Number(e.amount), 0);
  const saldo = totalMasuk - totalKeluar;

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Dashboard Kas</h2>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-600">Masuk</p>
          <p className="font-bold text-green-700">Rp{totalMasuk.toLocaleString('id-ID')}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-600">Keluar</p>
          <p className="font-bold text-red-700">Rp{totalKeluar.toLocaleString('id-ID')}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-600">Saldo</p>
          <p className="font-bold text-blue-700">Rp{saldo.toLocaleString('id-ID')}</p>
        </div>
      </div>

      <h3 className="font-semibold mb-2 text-sm">Riwayat Transaksi</h3>
      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.id} className="border rounded-lg p-3 flex justify-between items-center text-sm">
            <div>
              <p className="font-medium">{e.category}</p>
              <p className="text-gray-500 text-xs">{e.entry_date}</p>
            </div>
            <p className={e.direction === 'masuk' ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
              {e.direction === 'masuk' ? '+' : '-'}Rp{Number(e.amount).toLocaleString('id-ID')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}