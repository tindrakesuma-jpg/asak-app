import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function BuatJadwalRapatPage() {
  const navigate = useNavigate();
  const [agenda, setAgenda] = useState('Rapat Keputusan Penerimaan Anak ASAK');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [saving, setSaving] = useState(false);

  function updateOption(i: number, value: string) {
    setOptions(options.map((o, idx) => (idx === i ? value : o)));
  }
  function addOption() {
    setOptions([...options, '']);
  }
  function removeOption(i: number) {
    setOptions(options.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    const validOptions = options.filter((o) => o.trim() !== '');
    if (validOptions.length === 0) {
      alert('Isi minimal 1 opsi waktu.');
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();

    const { data: meeting, error: meetingErr } = await supabase
      .from('meetings')
      .insert({
        meeting_type: 'komite_penerimaan',
        mode: 'berkala',
        requested_by_user_id: userData.user?.id,
        agenda_summary: agenda,
        status: 'polling_waktu',
      })
      .select('id')
      .single();

    if (meetingErr || !meeting) {
      alert('Gagal membuat rapat: ' + meetingErr?.message);
      setSaving(false);
      return;
    }

    await supabase.from('meeting_time_options').insert(
      validOptions.map((o) => ({ meeting_id: meeting.id, option_datetime: new Date(o).toISOString() }))
    );

    // Broadcast pengumuman lewat sistem pesan (thread publik)
    const { data: thread } = await supabase
      .from('message_threads')
      .insert({ thread_type: 'public', subject: `Presensi: ${agenda}`, created_by_user_id: userData.user?.id })
      .select('id')
      .single();

    if (thread) {
      await supabase.from('messages').insert({
        thread_id: thread.id,
        sender_user_id: userData.user?.id,
        body: `Rapat baru diusulkan: "${agenda}". Ada ${validOptions.length} opsi waktu. Silakan isi presensi ketersediaan Anda di menu "Presensi Rapat".`,
      });
    }

    setSaving(false);
    navigate('/presensi-rapat');
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Usulkan Jadwal Rapat</h2>

      <label className="block text-sm font-medium mb-1">Agenda</label>
      <input
        value={agenda}
        onChange={(e) => setAgenda(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 mb-4"
      />

      <label className="block text-sm font-medium mb-2">Opsi Waktu (Tim Inti akan memilih mana yang bisa)</label>
      {options.map((o, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <input
            type="datetime-local"
            value={o}
            onChange={(e) => updateOption(i, e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2"
          />
          {options.length > 1 && (
            <button onClick={() => removeOption(i)} className="text-red-600 px-2">✕</button>
          )}
        </div>
      ))}
      <button onClick={addOption} className="text-sm text-blue-600 mb-4">+ Tambah opsi waktu</button>

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium disabled:opacity-50"
      >
        {saving ? 'Mengirim...' : 'Kirim & Umumkan ke Tim'}
      </button>
    </div>
  );
}