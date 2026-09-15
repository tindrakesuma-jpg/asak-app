import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Batch = {
  id: string;
  batch_code: string;
  status: string;
  prepared_date: string;
};

export default function ApprovalBatchPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('disbursement_batches')
      .select('id, batch_code, status, prepared_date')
      .eq('status', 'draft');
    setBatches(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleApprove(batchId: string) {
    setApproving(batchId);
    const { data: userData } = await supabase.auth.getUser();

    await supabase
      .from('disbursement_batches')
      .update({
        status: 'disetujui_ketua_asak',
        approved_by_user_id: userData.user?.id,
        approved_date: new Date().toISOString().slice(0, 10),
      })
      .eq('id', batchId);

    await supabase.from('disbursement_approvals').insert({
      batch_id: batchId,
      stage: 'disetujui_ketua_asak',
      actor_user_id: userData.user?.id,
    });

    setApproving(null);
    loadData();
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Approval Batch Pencairan</h2>

      {batches.length === 0 && <p className="text-gray-500">Tidak ada batch menunggu approval.</p>}

      <div className="space-y-3">
        {batches.map((batch) => (
          <div key={batch.id} className="border rounded-lg p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">{batch.batch_code}</p>
              <p className="text-sm text-gray-500">Dibuat: {batch.prepared_date}</p>
            </div>
            <button
              onClick={() => handleApprove(batch.id)}
              disabled={approving !== null}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              {approving === batch.id ? 'Menyetujui...' : 'Setujui'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}