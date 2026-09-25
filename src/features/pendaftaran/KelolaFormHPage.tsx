import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Anak = { id: string; name: string; school_name: string; class_semester: string | null; family_id: string };
type PendingH = { id: string; anak_id: string; child_name_proposed: string; form_a_link_sent: boolean };

const SCHOOL_YEAR = '2027/2028';

export default function KelolaFormHPage() {
  const [activeAnak, setActiveAnak] = useState<Anak[]>([]);
  const [pending, setPending] = useState<PendingH[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);

    // Link yang masih menunggu diisi Ortu (untuk bagian atas halaman)
    const { data: pendingH } = await supabase
      .from('applications')
      .select('id, anak_id, child_name_proposed, form_a_link_sent')
      .eq('application_type', 'H')
      .eq('school_year', SCHOOL_YEAR)
      .eq('status', 'menunggu_form_h');
    setPending((pendingH ?? []) as any);

    // SEMUA pengajuan Form H tahun ini, apa pun statusnya — untuk kecualikan dari "Buat Baru"
    const { data: allHThisYear } = await supabase
      .from('applications')
      .select('anak_id')
      .eq('application_type', 'H')
      .eq('school_year', SCHOOL_YEAR);
    const excludedAnakIds = new Set((allHThisYear ?? []).map((p) => p.anak_id));

    const { data: anak } = await supabase
      .from('anak_asak')
      .select('id, name, school_name, class_semester, family_id')
      .eq('status', 'active')
      .order('name');
    setActiveAnak((anak ?? []).filter((a) => !excludedAnakIds.has(a.id)));

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreate(anak: Anak) {
    setCreating(anak.id);
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from('applications').insert({
      application_type: 'H',
      school_year: SCHOOL_YEAR,
      anak_id: anak.id,
      family_id: anak.family_id,
      child_name_proposed: anak.name,
      is_new_child: false,
      is_tingkat_baru: false,
      target_school_name: anak.school_name,
      previous_class_semester: anak.class_semester,
      submitted_by_user_id: userData.user?.id,
      submitted_by_name: 'Orang Tua (lanjutan)',
      submitted_by_phone: '-',
      status: 'menunggu_form_h',
    });

    setCreating(null);
    if (error) {
      alert('Gagal membuat Form H: ' + error.message);
      return;
    }
    loadData();
  }

  function buildLink(id: string) {
    return `${window.location.origin}/form-h/${id}`;
  }

  async function handleCopy(id: string) {
    await navigator.clipboard.writeText(buildLink(id));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function toggleSent(item: PendingH) {
    await supabase
      .from('applications')
      .update({ form_a_link_sent: !item.form_a_link_sent })
      .eq('id', item.id);
    loadData();
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4 space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-1">Link Form H Menunggu Diisi</h2>
        <div className="space-y-3 mt-3">
          {pending.length === 0 && <p className="text-gray-500 text-sm">Belum ada.</p>}
          {pending.map((item) => (
            <div key={item.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <p className="font-semibold">{item.child_name_proposed}</p>
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                  <input type="checkbox" checked={item.form_a_link_sent} onChange={() => toggleSent(item)} />
                  Sudah dikirim
                </label>
              </div>
              <div className="bg-gray-50 border rounded-lg p-2 mt-2 text-xs break-all">{buildLink(item.id)}</div>
              <button onClick={() => handleCopy(item.id)} className="mt-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs">
                {copiedId === item.id ? '✓ Tersalin!' : 'Salin Link'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-1">Buat Form H Baru</h2>
        <p className="text-sm text-gray-500 mb-3">Anak aktif yang belum punya Form H tahun ini ({SCHOOL_YEAR}).</p>
        <div className="space-y-2">
          {activeAnak.map((anak) => (
            <div key={anak.id} className="border rounded-lg p-3 flex justify-between items-center">
              <div>
                <p className="font-medium text-sm">{anak.name}</p>
                <p className="text-xs text-gray-500">{anak.class_semester} — {anak.school_name}</p>
              </div>
              <button
                onClick={() => handleCreate(anak)}
                disabled={creating !== null}
                className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs whitespace-nowrap"
              >
                {creating === anak.id ? 'Membuat...' : 'Buat Form H'}
              </button>
            </div>
          ))}
          {activeAnak.length === 0 && <p className="text-gray-500 text-sm">Semua anak aktif sudah punya Form H.</p>}
        </div>
      </div>
    </div>
  );
}