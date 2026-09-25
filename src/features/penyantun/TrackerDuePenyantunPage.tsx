import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

type DueRow = {
  id: string;
  no: number | null;
  nama_penyantun: string;
  no_va: string | null;
  no_hp: string | null;
  pic: string;
  frekuensi: string | null;
  komitmen_per_bulan: number | null;
  mulai: string | null;
  wajib_sd_kini: number | null;
  total_bayar: number | null;
  tertanggung_sd: string | null;
  kurang: number | null;
  status: string | null;
  catatan_wa: string | null;
};

type BelumKomitmenRow = {
  id: string;
  nama: string;
  pic: string | null;
  status: string | null;
  catatan_wa: string | null;
};

type Tab = 'ringkasan' | 'belum_komitmen';

function statusColor(status: string | null) {
  if (!status) return 'bg-gray-50 border-gray-200';
  if (status.includes('❌')) return 'bg-red-50 border-red-300';
  if (status.includes('⏳')) return 'bg-yellow-50 border-yellow-300';
  if (status.includes('✅')) return 'bg-green-50 border-green-300';
  return 'bg-gray-50 border-gray-200';
}

function formatRupiah(n: number | null) {
  if (n === null || n === undefined) return '-';
  return `Rp${n.toLocaleString('id-ID')}`;
}

export default function TrackerDuePenyantunPage() {
  const [dueRows, setDueRows] = useState<DueRow[]>([]);
  const [belumKomitmenRows, setBelumKomitmenRows] = useState<BelumKomitmenRow[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('ringkasan');
  const [expandedPIC, setExpandedPIC] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: due } = await supabase
        .from('penyantun_due_tracker')
        .select('id, no, nama_penyantun, no_va, no_hp, pic, frekuensi, komitmen_per_bulan, mulai, wajib_sd_kini, total_bayar, tertanggung_sd, kurang, status, catatan_wa, synced_at')
        .order('pic')
        .order('no');
      const { data: belum } = await supabase
        .from('penyantun_belum_komitmen')
        .select('id, nama, pic, status, catatan_wa')
        .order('pic')
        .order('nama');

      setDueRows(due ?? []);
      setBelumKomitmenRows(belum ?? []);
      if (due && due.length > 0) {
        setLastSync(new Date((due[0] as any).synced_at).toLocaleString('id-ID'));
      }
      setLoading(false);
    }
    load();
  }, []);

  const ringkasanPerPIC = useMemo(() => {
    const map = new Map<string, { count: number; totalKurang: number; sudahLunas: number }>();
    dueRows.forEach((r) => {
      const entry = map.get(r.pic) ?? { count: 0, totalKurang: 0, sudahLunas: 0 };
      entry.count += 1;
      entry.totalKurang += r.kurang ?? 0;
      if (r.status?.includes('✅')) entry.sudahLunas += 1;
      map.set(r.pic, entry);
    });
    return Array.from(map.entries()).map(([pic, v]) => ({ pic, ...v }));
  }, [dueRows]);

  const totalKurangKeseluruhan = ringkasanPerPIC.reduce((s, p) => s + p.totalKurang, 0);

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-4xl mx-auto mt-8 p-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold">📋 Tracker Due Penyantun</h2>
      </div>
      {lastSync && <p className="text-xs text-gray-400 mb-4">Terakhir diperbarui: {lastSync}</p>}

      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-center">
        <p className="text-sm text-gray-600">Total Kekurangan Keseluruhan</p>
        <p className="text-2xl font-bold text-red-700">{formatRupiah(totalKurangKeseluruhan)}</p>
      </div>

      <div className="flex gap-1 mb-6 border-b">
        <button
          onClick={() => setTab('ringkasan')}
          className={`px-3 py-2 text-sm border-b-2 ${tab === 'ringkasan' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-gray-500'}`}
        >
          Per PIC
        </button>
        <button
          onClick={() => setTab('belum_komitmen')}
          className={`px-3 py-2 text-sm border-b-2 ${tab === 'belum_komitmen' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-gray-500'}`}
        >
          Belum Komitmen ({belumKomitmenRows.length})
        </button>
      </div>

      {tab === 'ringkasan' && (
        <div className="space-y-3">
          {ringkasanPerPIC.map((p) => (
            <div key={p.pic} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedPIC(expandedPIC === p.pic ? null : p.pic)}
                className="w-full text-left p-4 hover:bg-gray-50 flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold">PIC: {p.pic}</p>
                  <p className="text-xs text-gray-500">
                    {p.count} penyantun — {p.sudahLunas} lunas — kurang total {formatRupiah(p.totalKurang)}
                  </p>
                </div>
                <span className="text-gray-400">{expandedPIC === p.pic ? '▲' : '▼'}</span>
              </button>

              {expandedPIC === p.pic && (
                <div className="border-t p-3 space-y-2 bg-gray-50">
                  {dueRows
                    .filter((r) => r.pic === p.pic)
                    .map((r) => (
                      <div key={r.id} className={`border rounded-lg p-3 text-sm ${statusColor(r.status)}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{r.nama_penyantun}</p>
                            <p className="text-xs text-gray-500">
                              {r.frekuensi} — Rp{r.komitmen_per_bulan?.toLocaleString('id-ID')}/bln — mulai {r.mulai}
                            </p>
                          </div>
                          <span className="text-xs font-semibold whitespace-nowrap ml-2">{r.status}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                          <p>Wajib s.d. kini: {formatRupiah(r.wajib_sd_kini)}</p>
                          <p>Total bayar: {formatRupiah(r.total_bayar)}</p>
                          <p>Tertanggung s.d.: {r.tertanggung_sd || '-'}</p>
                          <p className="font-semibold text-red-700">Kurang: {formatRupiah(r.kurang)}</p>
                        </div>
                        {r.catatan_wa && <p className="text-xs text-gray-500 mt-2 italic">"{r.catatan_wa}"</p>}
                        {r.no_va && <p className="text-xs text-gray-400 mt-1">VA: {r.no_va} {r.no_hp && `— HP: ${r.no_hp}`}</p>}
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'belum_komitmen' && (
        <div className="space-y-2">
          {belumKomitmenRows.map((r) => (
            <div key={r.id} className={`border rounded-lg p-3 text-sm ${statusColor(r.status)}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{r.nama}</p>
                  <p className="text-xs text-gray-500">PIC: {r.pic || '-'}</p>
                </div>
                <span className="text-xs font-semibold whitespace-nowrap ml-2">{r.status}</span>
              </div>
              {r.catatan_wa && <p className="text-xs text-gray-500 mt-1 italic">"{r.catatan_wa}"</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
