import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type TimeOption = { id: string; option_datetime: string };
type MeetingRow = {
  id: string;
  agenda_summary: string | null;
  status: string;
  scheduled_date: string | null;
  meeting_time_options: TimeOption[];
};

export default function PresensiRapatPage() {
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [myRsvps, setMyRsvps] = useState<Record<string, boolean>>({});
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [roleName, setRoleName] = useState('');
  const [finalizing, setFinalizing] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();

    const { data: profile } = await supabase
      .from('users')
      .select('roles(name)')
      .eq('id', userData.user?.id)
      .single();
    setRoleName((profile as any)?.roles?.name ?? '');

    const { data: meetingData } = await supabase
      .from('meetings')
      .select('id, agenda_summary, status, scheduled_date, meeting_time_options(id, option_datetime)')
      .in('status', ['polling_waktu', 'dijadwalkan'])
      .order('id', { ascending: false });
    setMeetings((meetingData ?? []) as any);

    const { data: rsvpData } = await supabase
      .from('meeting_rsvps')
      .select('time_option_id, can_attend')
      .eq('user_id', userData.user?.id);
    setMyRsvps(Object.fromEntries((rsvpData ?? []).map((r) => [r.time_option_id, r.can_attend])));

    const { data: allRsvps } = await supabase.from('meeting_rsvps').select('time_option_id, can_attend');
    const counts: Record<string, number> = {};
    (allRsvps ?? []).forEach((r) => {
      if (r.can_attend) counts[r.time_option_id] = (counts[r.time_option_id] || 0) + 1;
    });
    setVoteCounts(counts);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleRsvp(optionId: string, canAttend: boolean) {
    const { data: userData } = await supabase.auth.getUser();
    await supabase
      .from('meeting_rsvps')
      .upsert(
        { time_option_id: optionId, user_id: userData.user?.id, can_attend: canAttend, responded_at: new Date().toISOString() },
        { onConflict: 'time_option_id,user_id' }
      );
    loadData();
  }

  async function handleFinalize(meetingId: string, option: TimeOption) {
    setFinalizing(meetingId);
    const { data: userData } = await supabase.auth.getUser();

    await supabase
      .from('meetings')
      .update({ status: 'dijadwalkan', scheduled_date: option.option_datetime })
      .eq('id', meetingId);

    const { data: thread } = await supabase
      .from('message_threads')
      .insert({ thread_type: 'public', subject: 'Jadwal Rapat Ditetapkan', created_by_user_id: userData.user?.id })
      .select('id')
      .single();

    if (thread) {
      await supabase.from('messages').insert({
        thread_id: thread.id,
        sender_user_id: userData.user?.id,
        body: `Jadwal rapat sudah ditetapkan: ${new Date(option.option_datetime).toLocaleString('id-ID')}.`,
      });
    }

    setFinalizing(null);
    loadData();
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Presensi Rapat</h2>

      {meetings.length === 0 && <p className="text-gray-500">Tidak ada rapat aktif.</p>}

      <div className="space-y-4">
        {meetings.map((m) => (
          <div key={m.id} className="border rounded-lg p-4">
            <p className="font-semibold">{m.agenda_summary}</p>

            {m.status === 'dijadwalkan' && m.scheduled_date && (
              <div className="bg-green-50 border border-green-300 rounded-lg p-3 mt-2 text-sm font-semibold text-green-800">
                ✓ Ditetapkan: {new Date(m.scheduled_date).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}
              </div>
            )}

            {m.status === 'polling_waktu' && (
              <div className="space-y-2 mt-3">
                {m.meeting_time_options.map((opt) => {
                  const myAnswer = myRsvps[opt.id];
                  return (
                    <div key={opt.id} className="border rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm">{new Date(opt.option_datetime).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        <p className="text-xs text-gray-500">{voteCounts[opt.id] || 0} orang bisa hadir</p>
                      </div>
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => handleRsvp(opt.id, true)}
                          className={`px-3 py-1 rounded-lg text-xs ${myAnswer === true ? 'bg-green-600 text-white' : 'bg-gray-100'}`}
                        >
                          Ya, bisa
                        </button>
                        <button
                          onClick={() => handleRsvp(opt.id, false)}
                          className={`px-3 py-1 rounded-lg text-xs ${myAnswer === false ? 'bg-red-600 text-white' : 'bg-gray-100'}`}
                        >
                          Tidak bisa
                        </button>
                        {roleName === 'KetuaASAK' && (
                          <button
                            onClick={() => handleFinalize(m.id, opt)}
                            disabled={finalizing !== null}
                            className="px-3 py-1 rounded-lg text-xs bg-blue-600 text-white whitespace-nowrap"
                          >
                            Pilih Ini
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}