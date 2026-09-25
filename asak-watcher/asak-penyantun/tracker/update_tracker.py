"""
Tracker Due Penyantun ASAK Paroki Santa Monika.
Cara pakai:  python update_tracker.py  [YYYY-MM]   (default: bulan hari ini)
- Membaca file "Histori Transfer sd *.xlsx" TERBARU di folder induk.
- Menambah transfer dari log_transfer_wa.csv yang terjadi SETELAH tanggal file Histori.
- Menulis Tracker_Due_Penyantun.xlsx (per PIC, tanda ✅ hijau bila sudah transfer).
"""
import csv, glob, os, re, sys, datetime as dt
from collections import defaultdict
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

HERE = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.dirname(HERE)
FREQ = {'bulanan': 1, 'dua bulanan': 2, 'triwulanan': 3, 'semesteran': 6, 'tahunan': 12}
SY_END = (2027, 6)
BLN = 'Jan Feb Mar Apr Mei Jun Jul Agu Sep Okt Nov Des'.split()

def mi(y, m): return y * 12 + m - 1
def lbl(k): return f"{BLN[k % 12]} {k // 12}"

def latest_histori():
    files = glob.glob(os.path.join(PARENT, 'Histori Transfer sd *.xlsx'))
    def key(f):
        m = re.search(r'sd (\d{2})(\d{2})(\d{2})', f)
        return (m.group(3), m.group(2), m.group(1)) if m else ('', '', '')
    return max(files, key=key)

def load_histori(path):
    ws = openpyxl.load_workbook(path, data_only=True).active
    asof = ws.cell(1, 45).value
    rows = []
    for r in ws.iter_rows(min_row=4, values_only=True):
        if not isinstance(r[1], int):
            continue
        start = r[12] if isinstance(r[12], dt.datetime) and r[12].year > 2000 else None
        rows.append(dict(no=r[1], nama=r[2], id=r[4], va=r[5], hp=r[6], komit=r[7] or 0,
                         freq=(r[8] or '') if r[8] != 0 else '', ak=r[9] or 0, as_=r[10] or 0,
                         pic=r[11], start=start, paid=r[39] or 0))
    return rows, asof

def load_csv(name):
    p = os.path.join(HERE, name)
    if not os.path.exists(p):
        return []
    with open(p, newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))

def main():
    now = dt.date.today()
    if len(sys.argv) > 1:
        y, m = map(int, sys.argv[1].split('-')); now = dt.date(y, m, 1)
    cur = mi(now.year, now.month)
    hpath = latest_histori()
    rows, asof = load_histori(hpath)
    asof_d = asof.date() if isinstance(asof, dt.datetime) else dt.date(2000, 1, 1)
    log = load_csv('log_transfer_wa.csv')
    swa = {int(s['no_penyantun']): s for s in load_csv('status_wa.csv') if s['no_penyantun']}
    wa = defaultdict(list)
    for e in log:
        d = dt.date.fromisoformat(e['tanggal'])
        e['baru'] = d > asof_d or (d == asof_d)   # transfer setelah/di hari file Histori
        if e['no_penyantun'] and e['baru']:
            wa[int(e['no_penyantun'])].append(e)

    GREEN = PatternFill('solid', fgColor='C6EFCE'); AMBER = PatternFill('solid', fgColor='FFEB9C')
    RED = PatternFill('solid', fgColor='FFC7CE'); HEAD = PatternFill('solid', fgColor='1F4E78')
    PICF = PatternFill('solid', fgColor='D9E1F2'); GREY = PatternFill('solid', fgColor='EDEDED')
    thin = Side(style='thin', color='BFBFBF'); B = Border(left=thin, right=thin, top=thin, bottom=thin)
    wb = openpyxl.Workbook()

    # ---------- Sheet 1: Due per PIC ----------
    ws = wb.active; ws.title = 'Due per PIC'
    ws['A1'] = f'Tracker Due Penyantun ASAK SY2627 — posisi s.d. {BLN[now.month-1]} {now.year}'
    ws['A1'].font = Font(bold=True, size=14)
    ws['A2'] = (f'Sumber: {os.path.basename(hpath)} (data s.d. {asof:%d/%m/%Y %H:%M}) + transfer dari WA setelahnya. '
                f'Diperbarui {dt.datetime.now():%d/%m/%Y %H:%M}.')
    ws['A3'] = ('✅ hijau = sudah transfer setelah file Histori (cek WA)  |  Kuning = kurang hanya bulan berjalan  |  '
                'Merah = tunggakan bulan lalu / belum bayar')
    hdr = ['No', 'Nama Penyantun', 'ID', 'No. VA', 'No. HP', 'Frekuensi', 'Komitmen/bln', 'Mulai',
           'Wajib s.d. kini', 'Bayar (Histori)', 'Transfer WA baru', 'Total bayar', 'Tertanggung s.d.',
           'Kurang (Rp)', 'Status', 'Catatan WA']
    r0 = 5
    for c, h in enumerate(hdr, 1):
        x = ws.cell(r0, c, h); x.font = Font(bold=True, color='FFFFFF'); x.fill = HEAD
        x.alignment = Alignment(wrap_text=True, vertical='center', horizontal='center'); x.border = B
    r = r0 + 1
    summary = defaultdict(lambda: [0, 0, 0, 0])  # due count, kurang, ✅ count, kurang setelah WA
    act = [x for x in rows if x['komit'] > 0]
    for pic in sorted({x['pic'] for x in act}):
        group = []
        for x in [a for a in act if a['pic'] == pic]:
            f = FREQ.get(str(x['freq']).lower(), 1)
            st = x['start']; s = mi(st.year, st.month) if st else mi(2026, 7)
            end = mi(*SY_END)
            if cur < s:
                req_m = 0
            else:
                inst = (cur - s) // f + 1
                req_m = min(inst * f, end - s + 1)
            req = req_m * x['komit']
            wa_amt = sum(int(e['nominal']) for e in wa.get(x['no'], []))
            tot = x['paid'] + wa_amt
            paid_m = int(tot // x['komit'] + 1e-9)
            cover = s + paid_m - 1
            kurang = max(0, req - tot)
            # kurang dihitung per bulan penuh (abaikan receh kode 3 digit)
            kurang = max(0, (req_m - paid_m)) * x['komit']
            before = max(0, (req_m - int(x['paid'] // x['komit'] + 1e-9))) * x['komit']
            if before == 0 and not wa_amt:
                continue  # tidak due & tidak ada transfer baru
            inst_start = s + ((cur - s) // f) * f if cur >= s else s
            only_cur = kurang > 0 and inst_start == cur and cover >= inst_start - 1  # hanya cicilan yg jatuh tempo bulan ini
            group.append((x, f, s, req, wa_amt, tot, cover, kurang, before, only_cur))
        if not group:
            continue
        ws.cell(r, 1, f'PIC: {pic}  —  {len(group)} penyantun').font = Font(bold=True, size=12)
        for c in range(1, len(hdr) + 1): ws.cell(r, c).fill = PICF
        r += 1
        for (x, f, s, req, wa_amt, tot, cover, kurang, before, only_cur) in sorted(group, key=lambda g: (-g[7], g[0]['nama'])):
            notes = '; '.join(f"{e['tanggal'][8:10]}/{e['tanggal'][5:7]} Rp{int(e['nominal']):,} ({e['periode_catatan']})"
                              for e in wa.get(x['no'], []))
            if x['no'] in swa: notes = (notes + '; ' if notes else '') + swa[x['no']]['status_wa']
            if kurang == 0:
                status, fill = '✅ Sudah transfer — lunas s.d. kini', GREEN
            elif wa_amt:
                status, fill = f'✅ Transfer masuk, masih kurang', GREEN
            elif only_cur:
                status, fill = '⏳ Due bulan berjalan', AMBER
            else:
                status, fill = '❌ Tunggakan', RED
            vals = [x['no'], x['nama'], x['id'], str(x['va']), str(x['hp']), x['freq'], x['komit'],
                    lbl(s), req, x['paid'], wa_amt or None, tot, lbl(cover) if tot else '-', kurang, status, notes]
            for c, v in enumerate(vals, 1):
                cell = ws.cell(r, c, v); cell.border = B
                cell.alignment = Alignment(vertical='top', wrap_text=(c in (2, 16)))
                if c in (7, 9, 10, 11, 12, 14): cell.number_format = '#,##0'
            for c in (1, 2, 15): ws.cell(r, c).fill = fill
            if fill is GREEN:
                ws.cell(r, 15).font = Font(bold=True, color='006100')
            sm = summary[pic]; sm[0] += 1; sm[1] += before; sm[3] += kurang
            if wa_amt: sm[2] += 1
            r += 1
        r += 1
    widths = [5, 30, 11, 13, 14, 12, 12, 10, 13, 13, 13, 13, 13, 12, 30, 60]
    for i, w in enumerate(widths, 1): ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = ws.cell(r0 + 1, 3)

    # ---------- Sheet 2: Ringkasan ----------
    s2 = wb.create_sheet('Ringkasan PIC', 0)
    s2['A1'] = f'Ringkasan Due per PIC — s.d. {BLN[now.month-1]} {now.year}'; s2['A1'].font = Font(bold=True, size=14)
    s2['A2'] = f'Histori: {os.path.basename(hpath)} | WA log: {len([e for e in log if e["baru"]])} transfer setelah Histori'
    h2 = ['PIC', 'Penyantun due (Histori)', 'Kurang menurut Histori (Rp)', '✅ Transfer baru dari WA', 'Sisa kurang setelah WA (Rp)']
    for c, h in enumerate(h2, 1):
        x = s2.cell(4, c, h); x.font = Font(bold=True, color='FFFFFF'); x.fill = HEAD; x.border = B
        x.alignment = Alignment(wrap_text=True, horizontal='center')
    rr = 5; T = [0, 0, 0, 0]
    for pic in sorted(summary):
        v = summary[pic]
        for c, val in enumerate([pic] + v, 1):
            x = s2.cell(rr, c, val); x.border = B
            if c in (3, 5): x.number_format = '#,##0'
        for i in range(4): T[i] += v[i]
        rr += 1
    for c, val in enumerate(['TOTAL'] + T, 1):
        x = s2.cell(rr, c, val); x.font = Font(bold=True); x.border = B
        if c in (3, 5): x.number_format = '#,##0'
    for i, w in enumerate([12, 16, 20, 16, 20], 1): s2.column_dimensions[get_column_letter(i)].width = w

    # ---------- Sheet 3: Belum komitmen SY2627 ----------
    s3 = wb.create_sheet('Belum Komitmen SY2627')
    s3['A1'] = 'Penyantun SY2526 yang belum tercatat komitmen SY2627 (komitmen 0 di Histori)'; s3['A1'].font = Font(bold=True, size=13)
    h3 = ['No', 'Nama', 'ID', 'No. VA', 'PIC', 'Transfer WA baru (Rp)', 'Status', 'Catatan WA']
    for c, h in enumerate(h3, 1):
        x = s3.cell(3, c, h); x.font = Font(bold=True, color='FFFFFF'); x.fill = HEAD; x.border = B
    rr = 4
    for x in sorted([a for a in rows if not a['komit']], key=lambda a: (a['pic'] or '', a['no'])):
        amt = sum(int(e['nominal']) for e in wa.get(x['no'], []))
        notes = '; '.join(f"{e['tanggal'][8:10]}/{e['tanggal'][5:7]} Rp{int(e['nominal']):,} ({e['periode_catatan']})" for e in wa.get(x['no'], []))
        if x['no'] in swa: notes = (notes + '; ' if notes else '') + swa[x['no']]['status_wa']
        if x['paid'] and not amt: notes = (notes + '; ' if notes else '') + f"Sudah ada bayar Rp{x['paid']:,} di Histori tanpa komitmen"
        if amt or x['paid']: st, fill = '✅ Sudah transfer — isi komitmen di V.3', GREEN
        elif x['no'] in swa and 'tidak lanjut' in swa[x['no']]['status_wa'].lower(): st, fill = '✖ Tidak lanjut', GREY
        elif x['no'] in swa: st, fill = '⏳ Sedang dihubungi', AMBER
        else: st, fill = '❓ Belum ada kabar', RED
        for c, v in enumerate([x['no'], x['nama'], x['id'], str(x['va']), x['pic'], amt or None, st, notes], 1):
            cell = s3.cell(rr, c, v); cell.border = B; cell.alignment = Alignment(vertical='top', wrap_text=(c == 8))
            if c == 6: cell.number_format = '#,##0'
        for c in (1, 2, 7): s3.cell(rr, c).fill = fill
        rr += 1
    for i, w in enumerate([5, 32, 11, 13, 10, 16, 36, 60], 1): s3.column_dimensions[get_column_letter(i)].width = w

    # ---------- Sheet 4: Log transfer WA ----------
    s4 = wb.create_sheet('Log Transfer WA')
    s4['A1'] = 'Log transfer dari WA "Pasukan Penyantun ASAK 25-28" (sumber: log_transfer_wa.csv)'; s4['A1'].font = Font(bold=True, size=13)
    h4 = ['Tanggal', 'Jam', 'Nominal', 'Jalur', 'Kode 3 digit', 'No.', 'Nama (WA/VA)', 'PIC', 'Periode/Catatan', 'Setelah Histori?', 'Sumber']
    for c, h in enumerate(h4, 1):
        x = s4.cell(3, c, h); x.font = Font(bold=True, color='FFFFFF'); x.fill = HEAD; x.border = B
    pics = {x['no']: x['pic'] for x in rows}
    for i, e in enumerate(log, 4):
        no = int(e['no_penyantun']) if e['no_penyantun'] else None
        vals = [e['tanggal'], e['jam'], int(e['nominal']), e['jalur'], e['kode3'], no, e['nama_wa'],
                pics.get(no, '—'), e['periode_catatan'], 'Ya' if e['baru'] else 'Sudah di Histori', e['sumber']]
        for c, v in enumerate(vals, 1):
            cell = s4.cell(i, c, v); cell.border = B; cell.alignment = Alignment(vertical='top', wrap_text=(c == 9))
            if c == 3: cell.number_format = '#,##0'
        if not no: s4.cell(i, 7).fill = AMBER
    s4.cell(len(log) + 5, 2, 'TOTAL'); s4.cell(len(log) + 5, 3, sum(int(e['nominal']) for e in log)).number_format = '#,##0'
    for i, w in enumerate([11, 7, 13, 24, 10, 6, 34, 9, 55, 15, 30], 1): s4.column_dimensions[get_column_letter(i)].width = w

    out = os.path.join(HERE, 'Tracker_Due_Penyantun.xlsx')
    wb.save(out)
    print('OK', out, '| histori:', os.path.basename(hpath), '| asof', asof)
    for pic in sorted(summary): print(pic, summary[pic])

if __name__ == '__main__':
    main()
