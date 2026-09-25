// Folder Watcher untuk Ringkasan WA ASAK — v4: GABUNG + KELOMPOKKAN ULANG per huruf.
// Setiap file baru untuk bulan yang sama digabung ke data lama, LALU seluruh section
// dikelompokkan ulang: semua "A..." berurutan dulu (A, A2, A3, A4...), baru semua
// "B..." berurutan (B, B2, B3, B4...), baru semua "C..." berurutan (C, C2, C3, C4...).
// Label angka (A2, A3, dst) TETAP DIPERTAHANKAN APA ADANYA -- cuma posisinya dipindah,
// TIDAK dinomori ulang dan TIDAK digabung jadi satu heading.
//
// KETERBATASAN: anak yang sama disebut lagi di minggu berikutnya tetap muncul sebagai
// entri terpisah di section A yang berbeda (mis. muncul lagi di "A3") -- bukan digabung
// jadi satu cerita. Untuk itu perlu review manual berkala.

import { createClient } from "@supabase/supabase-js";
import chokidar from "chokidar";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const watchFolder = process.env.WATCH_FOLDER || "./cowork-output";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi sebagai environment variable.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MONTH_MAP = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
};

const syncedFileHashes = new Map();

function parseMonthYearFromFilename(filename) {
  const lower = filename.toLowerCase();
  const yearMatch = lower.match(/(20\d{2})/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1], 10);
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    if (lower.includes(name)) {
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      return { monthOrder: num, year, monthLabel: `${label} ${year}` };
    }
  }
  return null;
}

// ---- Kelompokkan ulang: ambil tiap blok "## X..." UTUH (heading + isi), kelompokkan per huruf ----

function splitIntoBlocks(content) {
  // Ambil semua heading level-2 beserta posisinya
  const headingMatches = [...content.matchAll(/^##\s+\S[^\n]*$/gim)];
  const blocks = [];

  for (let i = 0; i < headingMatches.length; i++) {
    const m = headingMatches[i];
    const start = m.index;
    const end = i + 1 < headingMatches.length ? headingMatches[i + 1].index : content.length;
    const fullBlock = content.slice(start, end).trim();
    const headingText = m[0];

    let letter = null;
    const letterMatch = headingText.match(/^##\s*([ABC])\d*\./i);
    if (letterMatch) letter = letterMatch[1].toUpperCase();

    blocks.push({ letter, text: fullBlock }); // letter = null berarti bukan A/B/C (mis. Catatan Metodologi)
  }

  return blocks;
}

function regroupSections(content, monthLabel) {
  const blocks = splitIntoBlocks(content);

  const aBlocks = blocks.filter((b) => b.letter === 'A').map((b) => b.text);
  const bBlocks = blocks.filter((b) => b.letter === 'B').map((b) => b.text);
  const cBlocks = blocks.filter((b) => b.letter === 'C').map((b) => b.text);
  const otherBlocks = blocks.filter((b) => b.letter === null).map((b) => b.text);

  const out = [`# Ringkasan WhatsApp — Team Anak Asak 2025-2028 — ${monthLabel}`, ''];

  aBlocks.forEach((b, i) => {
    out.push(b, '');
    if (i < aBlocks.length - 1) out.push('---', '');
  });

  if (aBlocks.length > 0 && bBlocks.length > 0) out.push('---', '');
  bBlocks.forEach((b, i) => {
    out.push(b, '');
    if (i < bBlocks.length - 1) out.push('---', '');
  });

  if (bBlocks.length > 0 && cBlocks.length > 0) out.push('---', '');
  cBlocks.forEach((b, i) => {
    out.push(b, '');
    if (i < cBlocks.length - 1) out.push('---', '');
  });

  if ((aBlocks.length > 0 || bBlocks.length > 0 || cBlocks.length > 0) && otherBlocks.length > 0) {
    out.push('---', '');
  }
  otherBlocks.forEach((b) => out.push(b, ''));

  return out.join('\n').trim();
}

async function syncFile(filePath) {
  const filename = path.basename(filePath);
  if (!filename.toLowerCase().endsWith(".md")) return;

  const parsed = parseMonthYearFromFilename(filename);
  if (!parsed) {
    console.warn(`[LEWATI] "${filename}" — nama bulan/tahun tidak terdeteksi di nama file.`);
    return;
  }

  let newContent;
  try {
    newContent = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    console.error(`[GAGAL BACA] "${filename}":`, err.message);
    return;
  }

  const lastSynced = syncedFileHashes.get(filePath);
  if (lastSynced === newContent) return;

  const { data: existingRow, error: fetchErr } = await supabase
    .from("wa_group_summaries")
    .select("content")
    .eq("month_order", parsed.monthOrder)
    .eq("year", parsed.year)
    .maybeSingle();

  if (fetchErr) {
    console.error(`[GAGAL CEK DATA LAMA] "${filename}":`, fetchErr.message);
    return;
  }

  const rawMerged = existingRow && existingRow.content && existingRow.content.trim() !== ""
    ? `${existingRow.content.trim()}\n\n---\n\n${newContent.trim()}`
    : newContent;

  const regrouped = regroupSections(rawMerged, parsed.monthLabel);

  const { error } = await supabase
    .from("wa_group_summaries")
    .upsert(
      { month_label: parsed.monthLabel, month_order: parsed.monthOrder, year: parsed.year, content: regrouped },
      { onConflict: "month_order,year" }
    );

  const timestamp = new Date().toLocaleTimeString("id-ID");
  if (error) {
    console.error(`[${timestamp}] GAGAL sync "${filename}" (${parsed.monthLabel}):`, error.message);
  } else {
    syncedFileHashes.set(filePath, newContent);
    console.log(
      `[${timestamp}] ✓ Sync "${filename}" -> ${parsed.monthLabel} ` +
      `(digabung + dikelompokkan ulang per huruf A/B/C, total ${regrouped.length} karakter)`
    );
  }
}

if (!fs.existsSync(watchFolder)) {
  fs.mkdirSync(watchFolder, { recursive: true });
  console.log(`Folder "${watchFolder}" belum ada, sudah dibuat otomatis.`);
}

console.log(`Memantau folder: ${path.resolve(watchFolder)}`);
console.log("File baru untuk bulan yang sama akan DIGABUNG, lalu section dikelompokkan ulang: semua A dulu, baru semua B, baru semua C.");
console.log("Label angka (A2, A3, dst) tetap dipertahankan, cuma posisinya dipindah -- tidak dinomori ulang.");
console.log("Biarkan terminal ini tetap terbuka. Tekan Ctrl+C untuk berhenti.\n");

const watcher = chokidar.watch(watchFolder, { ignoreInitial: false, persistent: true });
watcher.on("add", syncFile);
watcher.on("change", syncFile);
