import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '../../lib/supabase';
import {
  parseChildren,
  parseAdminTopics,
  parseAttachments,
  parseCatatanLain,
  namesLikelyMatch,
} from '../../lib/waParser';

type Summary = { id: string; month_label: string; month_order: number; year: number; content: string };
type AllMonthsTab = 'anak' | 'admin' | 'lampiran' | 'lainlain';

const markdownComponents = {
  h1: ({ children }: any) => <h1 className="text-xl font-bold mt-1 mb-3 text-gray-900">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-lg font-bold mt-4 mb-2 text-blue-900">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-base font-bold mt-3 mb-1 text-blue-800">{children}</h3>,
  p: ({ children }: any) => <p className="mb-2 leading-relaxed text-gray-700 text-sm">{children}</p>,
  ul: ({ children }: any) => <ul className="list-disc pl-5 mb-2 space-y-1 text-sm text-gray-700">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-2 space-y-1 text-sm text-gray-700">{children}</ol>,
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }: any) => <strong className="font-semibold text-gray-900">{children}</strong>,
  em: ({ children }: any) => <em className="italic text-gray-600">{children}</em>,
  hr: () => <hr className="my-4 border-gray-200" />,
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-blue-200 pl-3 italic text-gray-500 my-2 text-sm">{children}</blockquote>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-4 border rounded-lg">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-blue-50">{children}</thead>,
  th: ({ children }: any) => (
    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">{children}</th>
  ),
  td: ({ children }: any) => <td className="border border-gray-200 px-3 py-2 align-top text-gray-700">{children}</td>,
  tr: ({ children }: any) => <tr className="even:bg-gray-50">{children}</tr>,
};

function MarkdownBlock({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {text}
    </ReactMarkdown>
  );
}

const ALL_MONTHS_VALUE = '__ALL__';

export default function RingkasanWAPage() {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);

  // Level 1: bulan mana / "Semua Bulan"
  const [scope, setScope] = useState<string>(''); // '' = belum di-set, diisi setelah data dimuat

  // untuk mode satu-bulan
  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [saving, setSaving] = useState(false);

  // untuk mode Semua Bulan
  const [allTab, setAllTab] = useState<AllMonthsTab>('anak');
  const [selectedChild, setSelectedChild] = useState('');

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('wa_group_summaries')
      .select('id, month_label, month_order, year, content')
      .order('year', { ascending: false })
      .order('month_order', { ascending: false });
    const list = data ?? [];
    setSummaries(list);
    if (list.length > 0) setScope((prev) => prev || list[0].id); // default: bulan terbaru (index 0 karena sudah descending)
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setEditing(false);
  }, [scope]);

  const isAllMonths = scope === ALL_MONTHS_VALUE;
  const currentMonth = useMemo(() => summaries.find((s) => s.id === scope), [scope, summaries]);

  // ---- Data turunan untuk mode "Semua Bulan" ----
  const allChildNames = useMemo(() => {
    if (!isAllMonths) return [];
    const names = new Set<string>();
    summaries.forEach((s) => parseChildren(s.content).forEach((c) => names.add(c.name)));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [isAllMonths, summaries]);

  const matchingEntries = useMemo(() => {
    if (!isAllMonths || !selectedChild) return [];
    const result: { month: string; body: string }[] = [];
    summaries.forEach((s) => {
      parseChildren(s.content).forEach((c) => {
        if (namesLikelyMatch(c.name, selectedChild)) {
          result.push({ month: s.month_label, body: `**${c.name}**\n\n${c.body}` });
        }
      });
    });
    return result;
  }, [isAllMonths, selectedChild, summaries]);

  const allAdminTopics = useMemo(() => {
    if (!isAllMonths) return [];
    return summaries.map((s) => ({ month: s.month_label, topics: parseAdminTopics(s.content) }));
  }, [isAllMonths, summaries]);

  const allAttachments = useMemo(() => {
    if (!isAllMonths) return [];
    return summaries.map((s) => ({ month: s.month_label, table: parseAttachments(s.content) }));
  }, [isAllMonths, summaries]);

  const allCatatan = useMemo(() => {
    if (!isAllMonths) return [];
    return summaries
      .map((s) => ({ month: s.month_label, text: parseCatatanLain(s.content) }))
      .filter((c) => c.text);
  }, [isAllMonths, summaries]);

  function startEdit() {
    if (!currentMonth) return;
    setDraftContent(currentMonth.content);
    setEditing(true);
  }

  async function handleSave() {
    if (!currentMonth) return;
    setSaving(true);
    const { error } = await supabase
      .from('wa_group_summaries')
      .update({ content: draftContent, updated_at: new Date().toISOString() })
      .eq('id', currentMonth.id);
    setSaving(false);
    if (error) {
      alert('Gagal simpan: ' + error.message);
      return;
    }
    setEditing(false);
    loadData();
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;
  if (summaries.length === 0) return <p className="text-center mt-16">Belum ada ringkasan.</p>;

  return (
    <div className="max-w-3xl mx-auto mt-8 p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">💬</span>
        <h2 className="text-xl font-bold">Ringkasan Diskusi WhatsApp Group</h2>
      </div>

      {/* LEVEL 1: pilih Semua Bulan atau bulan spesifik */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Tampilkan</label>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 bg-white"
        >
          <option value={ALL_MONTHS_VALUE}>📚 Semua Bulan (gabungan)</option>
          {summaries.map((s) => (
            <option key={s.id} value={s.id}>{s.month_label}</option>
          ))}
        </select>
      </div>

      {/* MODE: SATU BULAN */}
      {!isAllMonths && currentMonth && (
        <div>
          <div className="flex justify-end mb-2">
            {!editing && (
              <button onClick={startEdit} className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg">
                ✏️ Edit Bulan Ini
              </button>
            )}
          </div>

          {editing ? (
            <div>
              <p className="text-xs text-gray-500 mb-2">
                Ubah teks markdown-nya langsung. Format tetap harus rapi ("### N. Nama" per anak) supaya
                fitur "Cari Anak" di Semua Bulan tetap berfungsi.
              </p>
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                className="w-full border rounded-lg p-3 font-mono text-xs"
                rows={30}
              />
              <div className="flex gap-2 mt-3">
                <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
                <button onClick={() => setEditing(false)} className="bg-gray-100 px-4 py-2 rounded-lg text-sm">
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg p-5 bg-white">
              <MarkdownBlock text={currentMonth.content} />
            </div>
          )}
        </div>
      )}

      {/* MODE: SEMUA BULAN */}
      {isAllMonths && (
        <div>
          <div className="flex gap-1 mb-6 border-b overflow-x-auto">
            {[
              { key: 'anak', label: 'Cari Anak' },
              { key: 'admin', label: 'Topik Administratif' },
              { key: 'lampiran', label: 'Ringkasan Lampiran' },
              { key: 'lainlain', label: 'Catatan & Lain-lain' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setAllTab(t.key as AllMonthsTab)}
                className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 ${
                  allTab === t.key ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-gray-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* LEVEL 2: kalau tab "Cari Anak", tanya nama anak yang mana */}
          {allTab === 'anak' && (
            <div>
              <label className="block text-sm font-medium mb-1">Pilih Nama Anak</label>
              <select
                value={selectedChild}
                onChange={(e) => setSelectedChild(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 bg-white mb-4"
              >
                <option value="">— Pilih nama anak —</option>
                {allChildNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>

              {!selectedChild && <p className="text-sm text-gray-500">Pilih nama untuk melihat semua catatan lintas bulan.</p>}
              {selectedChild && matchingEntries.length === 0 && <p className="text-sm text-gray-500">Tidak ditemukan catatan.</p>}

              <div className="space-y-4">
                {matchingEntries.map((entry, i) => (
                  <div key={i} className="border rounded-lg p-4 bg-white">
                    <p className="text-xs font-semibold text-blue-600 mb-2">📅 {entry.month}</p>
                    <MarkdownBlock text={entry.body} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {allTab === 'admin' && (
            <div className="space-y-6">
              {allAdminTopics.map((m, i) =>
                m.topics.length === 0 ? null : (
                  <div key={i}>
                    <h3 className="font-bold text-blue-900 mb-2">{m.month}</h3>
                    <ol className="list-decimal pl-5 space-y-1.5 text-sm text-gray-700 bg-white border rounded-lg p-4">
                      {m.topics.map((t, j) => <li key={j}>{t.text}</li>)}
                    </ol>
                  </div>
                )
              )}
            </div>
          )}

          {allTab === 'lampiran' && (
            <div className="space-y-6">
              {allAttachments.map((m, i) =>
                m.table.rows.length === 0 ? null : (
                  <div key={i}>
                    <h3 className="font-bold text-blue-900 mb-2">{m.month}</h3>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-xs border-collapse">
                        <thead className="bg-blue-50">
                          <tr>
                            {m.table.headers.map((h, j) => (
                              <th key={j} className="border border-gray-200 px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {m.table.rows.map((row, j) => (
                            <tr key={j} className="even:bg-gray-50">
                              {row.cells.map((cell, k) => (
                                <td key={k} className="border border-gray-200 px-3 py-2 align-top">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {allTab === 'lainlain' && (
            <div className="space-y-6">
              <p className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                💡 "Catatan Metodologi" tiap bulan — tempat hal yang tidak masuk 3 kategori lain biasanya dicatat.
              </p>
              {allCatatan.map((c, i) => (
                <div key={i} className="border rounded-lg p-4 bg-white">
                  <p className="text-xs font-semibold text-blue-600 mb-2">📅 {c.month}</p>
                  <MarkdownBlock text={c.text ?? ''} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
