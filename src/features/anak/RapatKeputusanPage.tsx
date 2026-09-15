import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type ReadyItem = {
  id: string;
  child_name_proposed: string;
  target_education_level: string;
  target_school_name: string;
};

export default function RapatKeputusanPage() {
  const [items, setItems] = useState<ReadyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('applications')
      .select('id, child_name_proposed, target_education_level, target_school_name')
      .eq('status', 'survey_selesai')
      .order('id')
      .then(({ data }) => {
        setItems(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Rapat Komite — Siap Diputuskan</h2>

      {loading && <p>Memuat...</p>}
      {!loading && items.length === 0 && <p className="text-gray-500">Tidak ada yang siap diputuskan.</p>}

      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.id}
            to={`/keputusan/${item.id}`}
            className="block border rounded-lg p-4 hover:bg-gray-50"
          >
            <p className="font-semibold">{item.child_name_proposed}</p>
            <p className="text-sm text-gray-600">{item.target_education_level} — {item.target_school_name}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}