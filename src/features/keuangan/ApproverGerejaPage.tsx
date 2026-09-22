import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Batch = {
  id: string;
  batch_code: string;
};

export default function ApproverGerejaPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('disbursement_batches')
      .select('id, batch_code')
      .eq('status', 'diteruskan_bendahara_gereja');
    setBatches(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

async function handleTransfer(batchId: string) {
  setProcessing(batchId);
  const { data: userData } = await supabase.auth.getUser();

  // Hitung total nominal batch ini
  const { data: items } = await supabase
    .from('disbursement_requests')
    .select('amount')
    .eq('batch_id', batchId);
  const total = (items ?? []).reduce((sum, i) => sum + Number(i.amount), 0);

  await supabase
    .from('disbursement_batches')
    .update({ status: 'ditransfer' })
    .eq('id', batchId);

  await supabase.from('disbursement_approvals').insert({
    batch_id: batchId,
    stage: 'ditransfer',
    actor_user_id: userData.user?.id,
  });

  await supabase.from('kas_ledger').insert({
    entry_date: new Date().toISOString().slice(0, 10),
    direction: 'keluar',
    category: 'pencairan_bantuan',
    amount: total,
    reference_type: 'disbursement_batches',
    reference_id: batchId,
    recorded_by_user_id: userData.user?.id,
  });

  setProcessing(null);
  loadData();
}

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Batch Menunggu Transfer</h2>

      {batches.length === 0 && <p className="text-gray-500">Tidak ada batch menunggu transfer.</p>}

      <div className="space-y-3">
        {batches.map((batch) => (
          <div key={batch.id} className="border rounded-lg p-4 flex justify-between items-center">
            <p className="font-semibold">{batch.batch_code}</p>
            <button
              onClick={() => handleTransfer(batch.id)}
              disabled={processing !== null}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              {processing === batch.id ? 'Memproses...' : 'Tandai Sudah Transfer'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}