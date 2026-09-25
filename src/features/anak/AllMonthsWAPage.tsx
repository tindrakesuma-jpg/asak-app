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

type Summary = { month_label: string; month_order: number; year: number; content: string };
type Tab = 'anak' | 'admin' | 'lampiran' | 'lainlain';

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
};

function MarkdownBlock({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {text}
    </ReactMarkdown>
  );
}

export default function AllMonthsWAPage() {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('anak');
  const [selectedChild, setSelectedChild] = useState('');

  useEffect(() => {
    supabase
      .from('wa_group_summaries')
      .select('month_label, month_order, year, content')
      .order('year', { ascending: false })
      .order('month_order', { ascending: false })
      .then(({ data }) => {
        setSummaries(data ?? []);
        setLoading(false);
      });
  }, []);

  // ---- Tab 1: daftar semua nama anak unik (union dari semua bulan) ----
  const allChildNames = useMemo(() => {
    const names = new Set<string>();
    summaries.forEach((s) => parseChildren(s.content).forEach((c) => names.add(c.name)));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [summaries]);

  const matchingEntries = useMemo(() => {
    if (!selectedChild) return [];
    const result: { month: string; body: string }[] = [];
    summaries.forEach((s) => {
      parseChildren(s.content).forEach((c) => {
        if (namesLikelyMatch(c.name, selectedChild)) {
          result.push({ month: s.month_label, body: `**${c.name}**\n\n${c.body}` });
        }
      });
    });
    return result;
  }, [selectedChild, summaries]);

  // ---- Tab 2: semua topik admin, urut bulan ----
  const allAdminTopics = useMemo(() => {
    return summaries.map((s) => ({ month: s.month_label, topics: parseAdminTopics(s.content) }));
  }, [summaries]);

  // ---- Tab 3: semua lampiran, urut bulan ----
  const allAttachments = useMemo(() => {
    return summaries.map((s) => ({ month: s.month_label, table: parseAttachments(s.content) }));
  }, [summaries]);

  // ---- Tab 4: catatan metodologi / lain-lain tiap bulan ----
  const allCatatan = useMemo(() => {
    return summaries
      .map((s) => ({ month: s.month_label, text: parseCatatanLain(s.content) }))
      .filter((c) => c.text);
  }, [summaries]);

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-3xl mx-auto mt-8 p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">💬</span>
        <h2 className="text-xl font-bold">Ringkasan WA — Semua Bulan</h2>
      </div>

      <div className="flex gap-1 mb-6 border-b overflow-x-auto">
        {[
          { key: 'anak', label: 'Cari Anak' },
          { key: 'admin', label: 'Topik Administratif' },
          { key: 'lampiran', label: 'Ringkasan Lampiran' },
          { key: 'lainlain', label: 'Catatan & Lain-lain' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as Tab)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 ${
              tab === t.key ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'anak' && (
        <div>
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

          {selectedChild && matchingEntries.length === 0 && (
            <p className="text-sm text-gray-500">Tidak ditemukan catatan.</p>
          )}

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

      {tab === 'admin' && (
        <div className="space-y-6">
          {allAdminTopics.map((m, i) =>
            m.topics.length === 0 ? null : (
              <div key={i}>
                <h3 className="font-bold text-blue-900 mb-2">{m.month}</h3>
                <ol className="list-decimal pl-5 space-y-1.5 text-sm text-gray-700 bg-white border rounded-lg p-4">
                  {m.topics.map((t, j) => (
                    <li key={j}>{t.text}</li>
                  ))}
                </ol>
              </div>
            )
          )}
        </div>
      )}

      {tab === 'lampiran' && (
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
                          <th key={j} className="border border-gray-200 px-3 py-2 text-left font-semibold whitespace-nowrap">
                            {h}
                          </th>
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

      {tab === 'lainlain' && (
        <div className="space-y-6">
          <p className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            💡 Ini menampilkan "Catatan Metodologi" tiap bulan — tempat hal-hal yang tidak masuk 3 kategori lain biasanya dicatat. Kalau ada pola yang sering muncul di sini, pertimbangkan jadi kategori resmi baru.
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
  );
}
