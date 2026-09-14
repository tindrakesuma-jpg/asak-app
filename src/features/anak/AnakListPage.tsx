import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Anak = {
  id: string;
  name: string;
  school_name: string;
  education_level: string | null;
  class_semester: string | null;
  status: string;
};

export default function AnakListPage() {
  const [anakList, setAnakList] = useState<Anak[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // form state
  const [name, setName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [educationLevel, setEducationLevel] = useState('SD');
  const [classSemester, setClassSemester] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    const { data, error } = await supabase
      .from('anak_asak')
      .select('id, name, school_name, education_level, class_semester, status')
      .order('name');

    if (error) setErrorMsg(error.message);
    else setAnakList(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !schoolName) return;

    setSaving(true);
    const { error } = await supabase.from('anak_asak').insert({
      name,
      school_name: schoolName,
      education_level: educationLevel,
      class_semester: classSemester || null,
      status: 'active',
    });
    setSaving(false);

    if (error) {
      alert('Gagal menyimpan: ' + error.message);
      return;
    }

    // reset form & reload list
    setName('');
    setSchoolName('');
    setClassSemester('');
    loadData();
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h2>Daftar Anak ASAK</h2>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 8, marginBottom: 32, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
        <h3 style={{ margin: 0 }}>Tambah Anak Baru</h3>
        <input
          placeholder="Nama anak"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ padding: 8 }}
        />
        <input
          placeholder="Nama sekolah"
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          required
          style={{ padding: 8 }}
        />
        <select value={educationLevel} onChange={(e) => setEducationLevel(e.target.value)} style={{ padding: 8 }}>
          <option value="TK">TK</option>
          <option value="SD">SD</option>
          <option value="SMP">SMP</option>
          <option value="SMA">SMA</option>
          <option value="SMK">SMK</option>
          <option value="PT">PT (Kuliah)</option>
        </select>
        <input
          placeholder="Kelas/Semester (mis. 'Kelas 3')"
          value={classSemester}
          onChange={(e) => setClassSemester(e.target.value)}
          style={{ padding: 8 }}
        />
        <button type="submit" disabled={saving} style={{ padding: 10 }}>
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </form>

      {loading && <p>Memuat...</p>}
      {errorMsg && <p style={{ color: 'red' }}>Error: {errorMsg}</p>}
      {!loading && anakList.length === 0 && <p style={{ color: '#666' }}>Belum ada data anak.</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
            <th style={{ padding: 8 }}>Nama</th>
            <th style={{ padding: 8 }}>Sekolah</th>
            <th style={{ padding: 8 }}>Jenjang</th>
            <th style={{ padding: 8 }}>Kelas</th>
            <th style={{ padding: 8 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {anakList.map((anak) => (
            <tr key={anak.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>{anak.name}</td>
              <td style={{ padding: 8 }}>{anak.school_name}</td>
              <td style={{ padding: 8 }}>{anak.education_level ?? '-'}</td>
              <td style={{ padding: 8 }}>{anak.class_semester ?? '-'}</td>
              <td style={{ padding: 8 }}>{anak.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}