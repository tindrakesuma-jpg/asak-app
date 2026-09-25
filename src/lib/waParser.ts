// Utilitas parsing ringkasan WA — mengekstrak bagian per-anak, topik admin, lampiran,
// dan catatan lain-lain dari teks markdown satu bulan. Dipakai untuk fitur "All Months".
//
// Mendukung banyak sub-bagian bernomor dalam satu bulan (A1, A2, A3, ... / B1, B2, ... / C1, C2, ...)
// -- hasil dari Cowork yang bekerja per-interval tanggal dalam bulan yang sama. Semua sub-bagian
// dengan huruf yang sama (A/B/C) otomatis digabung jadi satu daftar per bulan.

export type ChildEntry = {
  name: string;
  body: string;
};

export type AdminTopic = {
  text: string;
};

export type AttachmentRow = {
  cells: string[];
};

function extractAllSections(content: string, letter: 'A' | 'B' | 'C'): string[] {
  const headingPattern = new RegExp(`^##\\s*${letter}\\d*\\.[^\\n]*$`, 'gim');
  const matches = [...content.matchAll(headingPattern)];
  if (matches.length === 0) return [];

  const allH2 = [...content.matchAll(/^##\s+\S[^\n]*$/gim)];

  return matches.map((m) => {
    const startIdx = (m.index ?? 0) + m[0].length;
    const nextH2 = allH2.find((h2) => (h2.index ?? 0) > (m.index ?? 0));
    const endIdx = nextH2 ? (nextH2.index ?? content.length) : content.length;
    return content.slice(startIdx, endIdx).trim();
  });
}

export function parseChildren(content: string): ChildEntry[] {
  const sections = extractAllSections(content, 'A');
  const entries: ChildEntry[] = [];

  sections.forEach((section) => {
    const parts = section.split(/\n###\s+/).slice(1);
    parts.forEach((part) => {
      const firstNewline = part.indexOf('\n');
      const rawName = (firstNewline === -1 ? part : part.slice(0, firstNewline)).trim();
      const name = rawName.replace(/^\d+[a-z]?\.\s*/i, '').trim(); // buang "19b. " di depan nama
      const body = firstNewline === -1 ? '' : part.slice(firstNewline + 1).trim();
      if (name) entries.push({ name, body });
    });
  });

  return entries;
}

export function parseAdminTopics(content: string): AdminTopic[] {
  const sections = extractAllSections(content, 'B');
  const topics: AdminTopic[] = [];

  sections.forEach((section) => {
    const lines = section.split('\n').filter((l) => /^\d+\.\s/.test(l.trim()));
    lines.forEach((l) => topics.push({ text: l.trim().replace(/^\d+\.\s*/, '') }));
  });

  return topics;
}

export function parseAttachments(content: string): { headers: string[]; rows: AttachmentRow[] } {
  const sections = extractAllSections(content, 'C');
  let headers: string[] = [];
  const rows: AttachmentRow[] = [];

  sections.forEach((section) => {
    const lines = section.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'));
    if (lines.length < 2) return;

    if (headers.length === 0) {
      headers = lines[0].split('|').map((c) => c.trim()).filter(Boolean);
    }

    const dataLines = lines.slice(2);
    dataLines.forEach((line) => {
      rows.push({
        cells: line.split('|').map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1),
      });
    });
  });

  return { headers, rows };
}

export function parseCatatanLain(content: string): string | null {
  const match = content.match(/##\s*Catatan Metodologi[^\n]*\n/i);
  if (!match || match.index === undefined) return null;
  return content.slice(match.index + match[0].length).trim();
}

export function namesLikelyMatch(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\([^)]*\)/g, '')
      .split(/[\s/]+/)
      .filter((w) => w.length > 2);

  const wordsA = new Set(normalize(a));
  const wordsB = normalize(b);
  return wordsB.some((w) => wordsA.has(w));
}