import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type WaitingSK = {
  id: string;
  child_name_proposed: string;
  school_year: string;
  anak_id: string;
  decision_reason: string | null;
};

export default function TerbitkanSKPage() {
  const [items, setItems] = useState<WaitingSK[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('applications')
      .select('id, child_name_proposed, school_year, anak_id, decision_reason')
      .eq('status', 'menunggu_sk');
    setItems((data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleIssue(item: WaitingSK) {
    setIssuing(item.id);
    const { data: userData } = await supabase.auth.getUser();

    let paket: any = {};
    try {
      paket = JSON.parse(item.decision_reason ?? '{}');
    } catch {
      paket = {};
    }

    // Perlu agenda_item_id — cari dari meeting_agenda_items terkait
    const { data: agendaItem } = await supabase
      .from('meeting_agenda_items')
      .select('id')
      .eq('application_id', item.id)
      .eq('decision', 'diterima')
      .order('decided_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!agendaItem) {
      alert('Tidak ditemukan data rapat untuk pengajuan ini.');
      setIssuing(null);
      return;
    }

    const skNumber = `SK-ASAK-${item.school_year.replace('/', '-')}-${Date.now().toString().slice(-6)}`;

    const { data: sk, error: skErr } = await supabase
      .from('sk_letters')
      .insert({
        agenda_item_id: agendaItem.id,
        anak_id: item.anak_id,
        sk_number: skNumber,
        school_year: item.school_year,
        issued_by_user_id: userData.user?.id,
        issued_date: new Date().toISOString().slice(0, 10),
      })
      .select('id')
      .single();

    if (skErr || !sk) {
      alert('Gagal menerbitkan SK: ' + skErr?.message);
      setIssuing(null);
      return;
    }

    const packages = [];
    if (paket.uangPangkal > 0)
      packages.push({ sk_id: sk.id, anak_id: item.anak_id, school_year: item.school_year, component_type: 'uang_pangkal', nominal: paket.uangPangkal });
    if (paket.sppBulanan > 0)
      packages.push({ sk_id: sk.id, anak_id: item.anak_id, school_year: item.school_year, component_type: 'spp_bulanan', nominal: paket.sppBulanan });
    if (paket.tunjangan > 0)
      packages.push({ sk_id: sk.id, anak_id: item.anak_id, school_year: item.school_year, component_type: 'tunjangan_semester', nominal: paket.tunjangan });

    if (packages.length > 0) await supabase.from('bantuan_packages').insert(packages);

    await supabase.from('applications').update({ status: 'diputuskan' }).eq('id', item.id);

    setIssuing(null);
    loadData();
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-1">Terbitkan Surat Keputusan</h2>
      <p className="text-sm text-gray-500 mb-4">Anak sudah lengkap Form A, menunggu SK resmi dari Sekretaris.</p>

      {items.length === 0 && <p className="text-gray-500">Tidak ada yang menunggu SK.</p>}

      <div className="space-y-3">
        {items.map((item) => {
          let paket: any = {};
          try { paket = JSON.parse(item.decision_reason ?? '{}'); } catch {}
          return (
            <div key={item.id} className="border rounded-lg p-4">
              <p className="font-semibold">{item.child_name_proposed}</p>
              <p className="text-sm text-gray-600">Tahun Ajaran: {item.school_year}</p>
              <div className="text-sm text-gray-500 mt-1">
                {paket.uangPangkal > 0 && <p>Uang Pangkal: Rp{Number(paket.uangPangkal).toLocaleString('id-ID')}</p>}
                {paket.sppBulanan > 0 && <p>SPP/bulan: Rp{Number(paket.sppBulanan).toLocaleString('id-ID')}</p>}
                {paket.tunjangan > 0 && <p>Tunjangan/semester: Rp{Number(paket.tunjangan).toLocaleString('id-ID')}</p>}
              </div>
              <button
                onClick={() => handleIssue(item)}
                disabled={issuing !== null}
                className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
              >
                {issuing === item.id ? 'Menerbitkan...' : 'Terbitkan SK'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}