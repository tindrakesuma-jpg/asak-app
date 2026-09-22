import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Batch = {
  id: string;
  batch_code: string;
  approved_date: string;
};

export default function BendaharaGerejaPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('disbursement_batches')
      .select('id, batch_code, approved_date')
      .eq('status', 'disetujui_ketua_asak');
    setBatches(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleForward(batchId: string) {
    setProcessing(batchId);
    const { data: userData } = await supabase.auth.getUser();

    await supabase
      .from('disbursement_batches')
      .update({ status: 'diteruskan_bendahara_gereja' })
      .eq('id', batchId);

    await supabase.from('disbursement_approvals').insert({
      batch_id: batchId,
      stage: 'diteruskan_bendahara_gereja',
      actor_user_id: userData.user?.id,
    });

    setProcessing(null);
    loadData();
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Batch Diterima dari Ketua ASAK</h2>

      {batches.length === 0 && <p className="text-gray-500">Tidak ada batch menunggu.</p>}

      <div className="space-y-3">
        {batches.map((batch) => (
          <div key={batch.id} className="border rounded-lg p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold">{batch.batch_code}</p>
              <p className="text-sm text-gray-500">Disetujui Ketua ASAK: {batch.approved_date}</p>
            </div>
            <button
              onClick={() => handleForward(batch.id)}
              disabled={processing !== null}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              {processing === batch.id ? 'Memproses...' : 'Ajukan ke Approver'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}