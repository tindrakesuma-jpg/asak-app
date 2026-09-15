import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Anak = {
  id: string;
  name: string;
  school_name: string;
  education_level: string | null;
};

export default function PicPoolPage() {
  const [poolAnak, setPoolAnak] = useState<Anak[]>([]);
  const [myAnak, setMyAnak] = useState<Anak[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const myUserId = userData.user?.id;

    // Anak yang sedang punya PIC aktif (end_date null) -> daftar id-nya
    const { data: activeAssignments } = await supabase
      .from('pic_assignments')
      .select('anak_id, pic_user_id')
      .is('end_date', null);

    const assignedAnakIds = new Set((activeAssignments ?? []).map((a) => a.anak_id));
    const myAnakIds = new Set(
      (activeAssignments ?? []).filter((a) => a.pic_user_id === myUserId).map((a) => a.anak_id)
    );

    const { data: allAnak } = await supabase
      .from('anak_asak')
      .select('id, name, school_name, education_level')
      .eq('status', 'active')
      .order('name');

    const pool = (allAnak ?? []).filter((a) => !assignedAnakIds.has(a.id));
    const mine = (allAnak ?? []).filter((a) => myAnakIds.has(a.id));

    setPoolAnak(pool);
    setMyAnak(mine);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleClaim(anakId: string) {
    setClaiming(anakId);
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from('pic_assignments').insert({
      anak_id: anakId,
      pic_user_id: userData.user?.id,
      assignment_method: 'self_assign_pool',
      start_date: new Date().toISOString().slice(0, 10),
    });

    setClaiming(null);
    if (error) {
      alert('Gagal: ' + error.message);
      return;
    }
    loadData();
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4 space-y-8">
      <div>
        <h2 className="text-xl font-bold mb-4">Anak Dampingan Saya</h2>
        {myAnak.length === 0 && <p className="text-gray-500">Belum ada anak dampingan.</p>}
        <div className="space-y-2">
          {myAnak.map((anak) => (
            <div key={anak.id} className="border rounded-lg p-3 bg-green-50">
              <p className="font-semibold">{anak.name}</p>
              <p className="text-sm text-gray-600">{anak.education_level} — {anak.school_name}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Pool — Belum Ada PIC</h2>
        {poolAnak.length === 0 && <p className="text-gray-500">Semua anak sudah punya PIC.</p>}
        <div className="space-y-2">
          {poolAnak.map((anak) => (
            <div key={anak.id} className="border rounded-lg p-3 flex justify-between items-center">
              <div>
                <p className="font-semibold">{anak.name}</p>
                <p className="text-sm text-gray-600">{anak.education_level} — {anak.school_name}</p>
              </div>
              <button
                onClick={() => handleClaim(anak.id)}
                disabled={claiming !== null}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap"
              >
                {claiming === anak.id ? 'Mengambil...' : 'Jadi PIC'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}