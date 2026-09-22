import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type PendingFormA = {
  id: string;
  child_name_proposed: string;
  target_school_name: string;
  target_education_level: string;
  form_a_link_sent: boolean;
  form_a_link_sent_at: string | null;
  submitted_by_name: string;
  submitted_by_phone: string;
};

type CancelResult = {
  childName: string;
  message: string;
  waLink: string;
};

export default function MenungguFormAPage() {
  const [items, setItems] = useState<PendingFormA[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [cancelResult, setCancelResult] = useState<CancelResult | null>(null);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('applications')
      .select('id, child_name_proposed, target_school_name, target_education_level, form_a_link_sent, form_a_link_sent_at, submitted_by_name, submitted_by_phone')
      .eq('status', 'menunggu_form_a')
      .order('id');
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function buildLink(id: string) {
    return `${window.location.origin}/form-a/${id}`;
  }

  async function handleCopy(id: string) {
    await navigator.clipboard.writeText(buildLink(id));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function toggleSent(item: PendingFormA) {
    const newValue = !item.form_a_link_sent;
    await supabase
      .from('applications')
      .update({
        form_a_link_sent: newValue,
        form_a_link_sent_at: newValue ? new Date().toISOString() : null,
      })
      .eq('id', item.id);
    loadData();
  }

  async function handleCancel(item: PendingFormA) {
    const reason = prompt(`Batalkan pengajuan ${item.child_name_proposed}? Alasan (wajib diisi):`);
    if (!reason) return;

    const { data: userData } = await supabase.auth.getUser();

    await supabase
      .from('applications')
      .update({
        status: 'ditolak_form_b',
        form_b_review_notes: reason,
        form_b_reviewed_by_user_id: userData.user?.id,
        form_b_reviewed_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    const message = `Halo ${item.submitted_by_name}, pengajuan ASAK atas nama *${item.child_name_proposed}* yang Anda ajukan telah *dibatalkan* oleh Tim Anak ASAK.\n\nAlasan: ${reason}\n\nSilakan hubungi Tim Anak ASAK bila ada pertanyaan.`;

    await supabase.from('reminder_logs').insert({
      type: 'form_b_dibatalkan',
      related_entity_type: 'applications',
      related_entity_id: item.id,
      draft_message: message,
      status: 'dibuat',
    });

    const phoneDigits = item.submitted_by_phone.replace(/\D/g, '');
    const waPhone = phoneDigits.startsWith('0') ? '62' + phoneDigits.slice(1) : phoneDigits;
    const waLink = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;

    setCancelResult({ childName: item.child_name_proposed, message, waLink });
    loadData();
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-1">Menunggu Form A</h2>
      <p className="text-sm text-gray-500 mb-4">
        Anak sudah diterima Rapat Komite, menunggu Orang Tua melengkapi Form A. Link tetap berlaku sampai Form A terisi.
      </p>

      {cancelResult && (
        <div className="bg-orange-50 border border-orange-300 rounded-lg p-4 mb-4">
          <p className="text-sm font-semibold mb-2">
            Pengajuan {cancelResult.childName} dibatalkan. Kirim pemberitahuan ke Ketua Lingkungan:
          </p>
          <div className="bg-white border rounded-lg p-2 text-xs whitespace-pre-wrap mb-2">{cancelResult.message}</div>
          <div className="flex gap-2">
            
              href={cancelResult.waLink}
              target="_blank"
              rel="noreferrer"
              className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs"
            <a>
              Buka WhatsApp →
            </a>
            <button onClick={() => setCancelResult(null)} className="text-xs text-gray-500 underline">
              Tutup
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && <p className="text-gray-500">Tidak ada yang menunggu Form A.</p>}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{item.child_name_proposed}</p>
                <p className="text-sm text-gray-600">{item.target_education_level} — {item.target_school_name}</p>
                <p className="text-xs text-gray-400">Diajukan: {item.submitted_by_name} ({item.submitted_by_phone})</p>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap">
                <input type="checkbox" checked={item.form_a_link_sent} onChange={() => toggleSent(item)} />
                Sudah dikirim
              </label>
            </div>

            {item.form_a_link_sent_at && (
              <p className="text-xs text-gray-400 mt-1">
                Dikirim: {new Date(item.form_a_link_sent_at).toLocaleString('id-ID')}
              </p>
            )}

            <div className="bg-gray-50 border rounded-lg p-2 mt-2 text-xs break-all">{buildLink(item.id)}</div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => handleCopy(item.id)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs">
                {copiedId === item.id ? '✓ Tersalin!' : 'Salin Link'}
              </button>
              <button onClick={() => handleCancel(item)} className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs">
                Batalkan
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}