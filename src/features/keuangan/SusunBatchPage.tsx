import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Item = {
  id: string;
  amount: number;
  fee_type: string;
  anak_asak: { name: string } | null;
};

export default function SusunBatchPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('disbursement_requests')
      .select('id, amount, fee_type, anak_asak(name)')
      .eq('item_status', 'menunggu_dipilih');
    setItems((data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const total = items.filter((i) => selected.has(i.id)).reduce((sum, i) => sum + i.amount, 0);

  async function handleCreateBatch() {
    if (selected.size === 0) return;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();

    const batchCode = `Batch-${Date.now().toString().slice(-6)}`;
    const { data: batch, error: batchErr } = await supabase
      .from('disbursement_batches')
      .insert({
        batch_code: batchCode,
        school_year: '2026/2027',
        status: 'draft',
        prepared_by_user_id: userData.user?.id,
      })
      .select('id')
      .single();

    if (batchErr || !batch) {
      alert('Gagal buat batch: ' + batchErr?.message);
      setSaving(false);
      return;
    }

    await supabase
      .from('disbursement_requests')
      .update({ batch_id: batch.id, item_status: 'masuk_batch' })
      .in('id', Array.from(selected));

    setSaving(false);
    setSelected(new Set());
    loadData();
    alert(`Batch ${batchCode} dibuat dengan ${selected.size} item, siap diajukan ke Ketua ASAK.`);
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Susun Batch Pencairan</h2>

      {items.length === 0 && <p className="text-gray-500">Antrian kosong.</p>}

      <div className="space-y-2 mb-4">
        {items.map((item) => (
          <label key={item.id} className="flex items-center gap-3 border rounded-lg p-3 cursor-pointer">
            <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
            <div className="flex-1">
              <p className="font-medium text-sm">{item.anak_asak?.name}</p>
              <p className="text-xs text-gray-500">{item.fee_type}</p>
            </div>
            <p className="text-sm font-semibold">Rp{item.amount.toLocaleString('id-ID')}</p>
          </label>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="bg-gray-50 border rounded-lg p-4 mb-4">
          <p className="text-sm">Dipilih: {selected.size} item — Total: <strong>Rp{total.toLocaleString('id-ID')}</strong></p>
        </div>
      )}

      <button
        onClick={handleCreateBatch}
        disabled={selected.size === 0 || saving}
        className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium disabled:opacity-50"
      >
        {saving ? 'Membuat...' : 'Buat Batch dari Item Terpilih'}
      </button>
    </div>
  );
}