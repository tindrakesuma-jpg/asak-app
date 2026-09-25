// Baca file Tracker_Due_Penyantun.xlsx setiap Jumat pukul 10:00 pagi, otomatis.
// Juga langsung membaca SEKALI saat script pertama dijalankan (supaya tidak perlu
// menunggu Jumat untuk uji coba pertama).
//
// Cara pakai:
//   1. npm install @supabase/supabase-js xlsx node-cron
//   2. Set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY
//   3. node read-tracker-penyantun.mjs
//   4. Biarkan terminal ini tetap terbuka (atau pasang lewat .bat seperti watcher WA)

import { createClient } from "@supabase/supabase-js";
import pkg from "xlsx";
const { readFile, utils, SSF } = pkg;
import cron from "node-cron";
import fs from "fs";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const filePath =
  process.env.TRACKER_FILE_PATH ||
  "C:\\Users\\Indera Kesuma\\asak-app\\asak-watcher\\asak-penyantun\\tracker\\Tracker_Due_Penyantun.xlsx";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi sebagai environment variable.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parseNumber(val) {
  if (val === undefined || val === null || val === "" || val === "-") return null;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/[^\d.-]/g, ""));
  return isNaN(num) ? null : num;
}

function parseExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  // Excel serial date number
  if (typeof val === "number") {
    const date = SSF.parse_date_code(val);
    if (date) return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
  }
  // Sudah dalam format string "2026-09-18"
  return String(val);
}

function readDuePerPIC(sheet) {
  const rows = utils.sheet_to_json(sheet, { header: 1, raw: true });
  // rows[0] = judul, rows[1] = subjudul/sumber, rows[2] = catatan warna, rows[3] = header kolom
  const headerRowIdx = rows.findIndex((r) => r[0] === "No" && r[1] === "Nama Penyantun");
  if (headerRowIdx === -1) return [];

  const dataRows = rows.slice(headerRowIdx + 1);
  let currentPIC = null;
  const result = [];

  for (const row of dataRows) {
    if (!row || row.length === 0) continue;
    const col0 = row[0];
    const col1 = row[1];

    // Baris header PIC: "PIC: Ayunda  —  7 penyantun" ada di kolom 1 (index 0), kolom lain kosong
    if (typeof col0 === "string" && col0.startsWith("PIC:")) {
      const match = col0.match(/PIC:\s*(.+?)\s*—/);
      currentPIC = match ? match[1].trim() : col0.replace("PIC:", "").trim();
      continue;
    }

    if (!col1 || !currentPIC) continue; // baris kosong atau belum ketemu PIC pertama

    result.push({
      no: parseNumber(row[0]),
      nama_penyantun: String(row[1] ?? "").trim(),
      donor_external_id: row[2] ? String(row[2]) : null,
      no_va: row[3] ? String(row[3]) : null,
      no_hp: row[4] ? String(row[4]) : null,
      pic: currentPIC,
      frekuensi: row[5] ? String(row[5]) : null,
      komitmen_per_bulan: parseNumber(row[6]),
      mulai: row[7] ? String(row[7]) : null,
      wajib_sd_kini: parseNumber(row[8]),
      bayar_histori: parseNumber(row[9]),
      transfer_wa_baru: parseNumber(row[10]),
      total_bayar: parseNumber(row[11]),
      tertanggung_sd: row[12] ? String(row[12]) : null,
      kurang: parseNumber(row[13]),
      status: row[14] ? String(row[14]) : null,
      catatan_wa: row[15] ? String(row[15]) : null,
    });
  }
  return result;
}

function readBelumKomitmen(sheet) {
  const rows = utils.sheet_to_json(sheet, { header: 1, raw: true });
  const headerRowIdx = rows.findIndex((r) => r[0] === "No" && r[1] === "Nama");
  if (headerRowIdx === -1) return [];

  return rows
    .slice(headerRowIdx + 1)
    .filter((row) => row && row[1])
    .map((row) => ({
      no: parseNumber(row[0]),
      nama: String(row[1] ?? "").trim(),
      donor_external_id: row[2] ? String(row[2]) : null,
      no_va: row[3] ? String(row[3]) : null,
      pic: row[4] ? String(row[4]) : null,
      transfer_wa_baru: parseNumber(row[5]),
      status: row[6] ? String(row[6]) : null,
      catatan_wa: row[7] ? String(row[7]) : null,
    }));
}

function readLogTransferWA(sheet) {
  const rows = utils.sheet_to_json(sheet, { header: 1, raw: true });
  const headerRowIdx = rows.findIndex((r) => r[0] === "Tanggal" && r[1] === "Jam");
  if (headerRowIdx === -1) return [];

  return rows
    .slice(headerRowIdx + 1)
    .filter((row) => row && row[0] && row[0] !== "TOTAL")
    .map((row) => ({
      tanggal: parseExcelDate(row[0]),
      jam: row[1] ? String(row[1]) : null,
      nominal: parseNumber(row[2]),
      jalur: row[3] ? String(row[3]) : null,
      kode_3_digit: row[4] ? String(row[4]) : null,
      no_ref: row[5] ? String(row[5]) : null,
      nama: row[6] ? String(row[6]) : null,
      pic: row[7] ? String(row[7]) : null,
      periode_catatan: row[8] ? String(row[8]) : null,
      setelah_histori: row[9] ? String(row[9]) : null,
      sumber: row[10] ? String(row[10]) : null,
    }));
}

async function readAndSync() {
  const timestamp = new Date().toLocaleString("id-ID");
  console.log(`\n[${timestamp}] Membaca ${filePath} ...`);

  if (!fs.existsSync(filePath)) {
    console.error(`[GAGAL] File tidak ditemukan di path: ${filePath}`);
    return;
  }

  let workbook;
  try {
    workbook = readFile(filePath);
  } catch (err) {
    console.error(`[GAGAL BACA FILE]`, err.message);
    return;
  }

  const duePerPICData = readDuePerPIC(workbook.Sheets["Due per PIC"]);
  const belumKomitmenData = readBelumKomitmen(workbook.Sheets["Belum Komitmen SY2627"]);
  const logTransferData = readLogTransferWA(workbook.Sheets["Log Transfer WA"]);

  console.log(`  - Due per PIC: ${duePerPICData.length} baris`);
  console.log(`  - Belum Komitmen: ${belumKomitmenData.length} baris`);
  console.log(`  - Log Transfer WA: ${logTransferData.length} baris`);

  // Full refresh: hapus data lama, masukkan data baru (dalam transaksi sederhana berurutan)
  await supabase.from("penyantun_due_tracker").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("penyantun_belum_komitmen").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("penyantun_log_transfer_wa").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  if (duePerPICData.length > 0) {
    const { error } = await supabase.from("penyantun_due_tracker").insert(duePerPICData);
    if (error) console.error("  [GAGAL insert Due per PIC]", error.message);
  }
  if (belumKomitmenData.length > 0) {
    const { error } = await supabase.from("penyantun_belum_komitmen").insert(belumKomitmenData);
    if (error) console.error("  [GAGAL insert Belum Komitmen]", error.message);
  }
  if (logTransferData.length > 0) {
    const { error } = await supabase.from("penyantun_log_transfer_wa").insert(logTransferData);
    if (error) console.error("  [GAGAL insert Log Transfer]", error.message);
  }

  console.log(`[${timestamp}] ✓ Selesai sinkronisasi.`);
}

// Jalankan sekali saat script pertama kali dimulai (supaya tidak perlu tunggu Jumat untuk tes)
console.log("Menjalankan pembacaan awal...");
readAndSync();

// Jadwalkan tiap Jumat pukul 10:00 pagi (waktu lokal komputer ini)
cron.schedule("0 10 * * 5", () => {
  console.log("\n=== Jadwal Jumat 10:00 terpicu ===");
  readAndSync();
});

console.log("\nTerjadwal: setiap Jumat pukul 10:00 pagi.");
console.log("Biarkan terminal ini tetap terbuka. Tekan Ctrl+C untuk berhenti.");
