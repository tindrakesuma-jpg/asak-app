// Folder Watcher untuk Ringkasan WA ASAK — v2: MENGGABUNG (append), bukan menimpa.
// Setiap file baru untuk bulan yang SAMA akan ditambahkan ke konten yang sudah ada,
// bukan menggantikannya. Kalau bulan itu belum ada datanya, langsung dipakai sebagai isi awal.
//
// Cara pakai: sama seperti versi sebelumnya (npm install @supabase/supabase-js chokidar,
// set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, node watch-wa-folder.mjs)

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

// Simpan hash file yang SUDAH pernah disinkron, supaya tidak dobel-append kalau
// file yang sama disimpan ulang tanpa perubahan berarti (mis. auto-save editor).
const syncedFileHashes = new Map(); // filePath -> content string terakhir yang disinkron

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

  // Kalau isi file ini PERSIS SAMA seperti terakhir kali disinkron, lewati (hindari dobel-append)
  const lastSynced = syncedFileHashes.get(filePath);
  if (lastSynced === newContent) {
    return; // tidak ada perubahan berarti, diam saja
  }

  // Ambil konten bulan ini yang SUDAH ADA di database (kalau ada)
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

  let finalContent;
  if (existingRow && existingRow.content && existingRow.content.trim() !== "") {
    // GABUNGKAN: konten lama + pemisah + konten baru
    finalContent = `${existingRow.content.trim()}\n\n---\n\n${newContent.trim()}`;
  } else {
    // Belum ada data bulan ini sama sekali, pakai langsung
    finalContent = newContent;
  }

  const { error } = await supabase
    .from("wa_group_summaries")
    .upsert(
      {
        month_label: parsed.monthLabel,
        month_order: parsed.monthOrder,
        year: parsed.year,
        content: finalContent,
      },
      { onConflict: "month_order,year" }
    );

  const timestamp = new Date().toLocaleTimeString("id-ID");
  if (error) {
    console.error(`[${timestamp}] GAGAL sync "${filename}" (${parsed.monthLabel}):`, error.message);
  } else {
    syncedFileHashes.set(filePath, newContent);
    console.log(
      `[${timestamp}] ✓ Sync "${filename}" -> ${parsed.monthLabel} ` +
      `(DIGABUNG ke data lama, total sekarang ${finalContent.length} karakter)`
    );
  }
}

if (!fs.existsSync(watchFolder)) {
  fs.mkdirSync(watchFolder, { recursive: true });
  console.log(`Folder "${watchFolder}" belum ada, sudah dibuat otomatis.`);
}

console.log(`Memantau folder: ${path.resolve(watchFolder)}`);
console.log("File baru untuk bulan yang sama akan DIGABUNG ke data yang sudah ada (bukan ditimpa).");
console.log("Biarkan terminal ini tetap terbuka. Tekan Ctrl+C untuk berhenti.\n");

const watcher = chokidar.watch(watchFolder, {
  ignoreInitial: false,
  persistent: true,
});

watcher.on("add", syncFile);
watcher.on("change", syncFile);
