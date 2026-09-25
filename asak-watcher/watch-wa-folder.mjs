// Folder Watcher untuk Ringkasan WA — jalankan sekali, biarkan berjalan di latar belakang.
// Setiap kali file .md baru muncul/berubah di folder yang diawasi, otomatis ter-upload ke Supabase.
//
// Cara pakai:
//   1. npm install @supabase/supabase-js chokidar
//   2. Set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY
//   3. (Opsional) Set WATCH_FOLDER — default: "./cowork-output" (folder ini akan dibuat otomatis kalau belum ada)
//   4. node watch-wa-folder.mjs
//   5. BIARKAN TERMINAL INI TETAP TERBUKA — script akan terus berjalan memantau folder.
//      Tutup dengan Ctrl+C kalau mau berhenti.
//
// Format nama file yang dikenali (fleksibel, tidak harus persis):
//   harus mengandung salah satu nama bulan (April, Mei, Juni, Juli, Agustus, September,
//   Oktober, November, Desember, Januari, Februari, Maret) dan angka tahun 4 digit (mis. 2026).
//   Contoh valid: "Ringkasan_WA_Oktober2026.md", "apa_saja_Oktober_2026_versi2.md"

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

  let content;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    console.error(`[GAGAL BACA] "${filename}":`, err.message);
    return;
  }

  const { error } = await supabase
    .from("wa_group_summaries")
    .upsert(
      {
        month_label: parsed.monthLabel,
        month_order: parsed.monthOrder,
        year: parsed.year,
        content,
      },
      { onConflict: "month_order,year" }
    );

  const timestamp = new Date().toLocaleTimeString("id-ID");
  if (error) {
    console.error(`[${timestamp}] GAGAL sync "${filename}" (${parsed.monthLabel}):`, error.message);
  } else {
    console.log(`[${timestamp}] ✓ Sync "${filename}" -> ${parsed.monthLabel} (${content.length} karakter)`);
  }
}

if (!fs.existsSync(watchFolder)) {
  fs.mkdirSync(watchFolder, { recursive: true });
  console.log(`Folder "${watchFolder}" belum ada, sudah dibuat otomatis.`);
}

console.log(`Memantau folder: ${path.resolve(watchFolder)}`);
console.log("Taruh file .md ringkasan bulanan (dari Cowork) di folder ini — akan otomatis ter-sync.");
console.log("Biarkan terminal ini tetap terbuka. Tekan Ctrl+C untuk berhenti.\n");

const watcher = chokidar.watch(watchFolder, {
  ignoreInitial: false, // file yang SUDAH ada di folder saat script mulai juga ikut di-sync
  persistent: true,
});

watcher.on("add", syncFile);
watcher.on("change", syncFile);
