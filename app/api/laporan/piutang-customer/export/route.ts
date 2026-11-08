// =====================================================
// PATH: app/api/laporan/piutang-customer/export/route.ts
// Export Excel laporan piutang customer
//   detail=false -> Sheet "Piutang Customer" + "Rekap per Customer"
//   detail=true  -> + Sheet "Riwayat Pembayaran"
// =====================================================
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { getAuthData } from "@/app/AuthGuard";
import {
  buildPiutangWhere,
  getSisaHariJatuhTempo,
  getSisaPiutang,
  getStatusJatuhTempoLabel,
  PiutangFilters,
  readPiutangFilters,
  toNumber,
} from "../filter";

const prisma = new PrismaClient();

// ─── Styling (seragam dengan laporan penjualan) ──────────────────────────────
const TITLE_FILL = "FF2196F3";
const HEADER_FILL = "FF616161";
const TOTAL_FILL = "FFFFF59D";
const OVERDUE_FILL = "FFFFEBEE";

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function formatTanggalPanjang(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function formatDateRange(startDate?: string | null, endDate?: string | null) {
  if (startDate && endDate)
    return `${formatTanggalPanjang(startDate)} s/d ${formatTanggalPanjang(endDate)}`;
  if (startDate) return `Sejak ${formatTanggalPanjang(startDate)}`;
  if (endDate) return `Sampai ${formatTanggalPanjang(endDate)}`;
  return "Semua Periode";
}

function formatTanggal(date: Date | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getStatusLabel(status?: string | null) {
  if (status === "LUNAS") return "Lunas";
  if (status === "all") return "Semua Status";
  return "Belum Lunas (Hutang)";
}

function getJatuhTempoFilterLabel(value?: string | null) {
  if (value === "overdue") return "Sudah Lewat Jatuh Tempo";
  if (value === "7hari") return "Jatuh Tempo ≤ 7 Hari";
  return "Semua";
}

function formatMetode(metode?: string | null) {
  if (!metode) return "-";
  return metode === "CASH_TRANSFER" ? "CASH + TRANSFER" : metode;
}

function writeSheetHeader(
  worksheet: ExcelJS.Worksheet,
  title: string,
  lastCol: string,
  filters: PiutangFilters,
  infoLine: string,
) {
  worksheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = worksheet.getCell("A1");
  titleCell.value = title;
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: TITLE_FILL },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  worksheet.mergeCells(`A2:${lastCol}2`);
  const periodeCell = worksheet.getCell("A2");
  periodeCell.value =
    `Periode Transaksi: ${formatDateRange(filters.startDate, filters.endDate)}` +
    ` | Status: ${getStatusLabel(filters.statusPembayaran)}` +
    ` | Jatuh Tempo: ${getJatuhTempoFilterLabel(filters.jatuhTempo)}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  worksheet.mergeCells(`A3:${lastCol}3`);
  const infoCell = worksheet.getCell("A3");
  infoCell.value = infoLine;
  infoCell.font = { bold: true };
  infoCell.alignment = { horizontal: "center" };
}

function writeTableHeader(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  headers: { label: string; width: number }[],
) {
  const headerRow = worksheet.getRow(rowNumber);
  headers.forEach((h, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = h.label;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = thinBorder;
    worksheet.getColumn(index + 1).width = h.width;
  });
  headerRow.height = 22;
  worksheet.views = [{ state: "frozen", ySplit: rowNumber }];
}

function styleTotalRow(row: ExcelJS.Row, colCount: number) {
  row.font = { bold: true };
  for (let i = 1; i <= colCount; i++) {
    const cell = row.getCell(i);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: TOTAL_FILL },
    };
    cell.border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  }
}

type PiutangRow = Awaited<ReturnType<typeof fetchPiutang>>[number];

async function fetchPiutang(filters: PiutangFilters) {
  return prisma.penjualanHeader.findMany({
    where: buildPiutangWhere(filters),
    orderBy: [{ tanggalJatuhTempo: "asc" }, { tanggalTransaksi: "asc" }],
    include: {
      customer: {
        select: {
          id: true,
          nama: true,
          namaToko: true,
          noHp: true,
          alamat: true,
          limit_piutang: true,
        },
      },
      pembayaran: {
        orderBy: { tanggalBayar: "asc" },
        select: {
          kodePembayaran: true,
          tanggalBayar: true,
          nominal: true,
          totalCash: true,
          totalTransfer: true,
          metode: true,
          catatan: true,
        },
      },
    },
  });
}

function getNamaCustomer(p: PiutangRow) {
  return p.customer?.nama || p.namaCustomer || "-";
}

function getSisa(p: PiutangRow) {
  return p.statusPembayaran === "HUTANG" ? getSisaPiutang(p) : 0;
}

function getDibayar(p: PiutangRow) {
  // Untuk nota LUNAS, jumlahDibayar bisa > total (kembalian)
  return Math.max(0, toNumber(p.totalHarga) - getSisa(p));
}

// ─── Sheet 1: daftar nota piutang ────────────────────────────────────────────
function generatePiutangSheet(
  workbook: ExcelJS.Workbook,
  data: PiutangRow[],
  filters: PiutangFilters,
) {
  const ws = workbook.addWorksheet("Piutang Customer");
  const headers = [
    { label: "No", width: 5 },
    { label: "Kode Penjualan", width: 20 },
    { label: "Tanggal Transaksi", width: 14 },
    { label: "Jatuh Tempo", width: 14 },
    { label: "Status Jatuh Tempo", width: 20 },
    { label: "Customer", width: 22 },
    { label: "Nama Toko", width: 22 },
    { label: "No HP", width: 15 },
    { label: "Metode Pembayaran", width: 18 },
    { label: "Total Penjualan", width: 16 },
    { label: "Sudah Dibayar", width: 16 },
    { label: "Sisa Piutang", width: 16 },
    { label: "Jml Cicilan", width: 11 },
    { label: "Status", width: 10 },
  ];
  const lastCol = "N";

  writeSheetHeader(
    ws,
    "LAPORAN PIUTANG CUSTOMER",
    lastCol,
    filters,
    `Total Nota: ${data.length}`,
  );
  writeTableHeader(ws, 5, headers);

  let rowNum = 6;
  let grandTotal = 0;
  let grandDibayar = 0;
  let grandSisa = 0;

  data.forEach((p, index) => {
    const total = toNumber(p.totalHarga);
    const sisa = getSisa(p);
    const dibayar = getDibayar(p);
    grandTotal += total;
    grandDibayar += dibayar;
    grandSisa += sisa;

    const row = ws.getRow(rowNum);
    row.values = [
      index + 1,
      p.kodePenjualan,
      formatTanggal(p.tanggalTransaksi),
      formatTanggal(p.tanggalJatuhTempo),
      getStatusJatuhTempoLabel(p.tanggalJatuhTempo, p.statusPembayaran),
      getNamaCustomer(p),
      p.customer?.namaToko || "-",
      p.customer?.noHp || "-",
      formatMetode(p.metodePembayaran),
      total,
      dibayar,
      sisa,
      p.pembayaran.length,
      p.statusPembayaran,
    ];

    [10, 11, 12].forEach((c) => (row.getCell(c).numFmt = "#,##0"));
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(13).alignment = { horizontal: "center" };
    row.getCell(14).alignment = { horizontal: "center" };

    const hari = getSisaHariJatuhTempo(p.tanggalJatuhTempo);
    const isOverdue = p.statusPembayaran === "HUTANG" && hari !== null && hari < 0;

    for (let i = 1; i <= headers.length; i++) {
      const cell = row.getCell(i);
      cell.border = thinBorder;
      if (isOverdue) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: OVERDUE_FILL },
        };
      }
    }
    if (isOverdue) {
      row.getCell(5).font = { bold: true, color: { argb: "FFC62828" } };
    }

    rowNum++;
  });

  const totalRow = ws.getRow(rowNum);
  totalRow.getCell(1).value = "TOTAL";
  ws.mergeCells(`A${rowNum}:I${rowNum}`);
  totalRow.getCell(10).value = grandTotal;
  totalRow.getCell(11).value = grandDibayar;
  totalRow.getCell(12).value = grandSisa;
  [10, 11, 12].forEach((c) => (totalRow.getCell(c).numFmt = "#,##0"));
  styleTotalRow(totalRow, headers.length);
}

// ─── Sheet 2: rekap per customer ─────────────────────────────────────────────
function generateRekapCustomerSheet(
  workbook: ExcelJS.Workbook,
  data: PiutangRow[],
  filters: PiutangFilters,
) {
  const ws = workbook.addWorksheet("Rekap per Customer");

  type Rekap = {
    nama: string;
    namaToko: string;
    noHp: string;
    limit: number | null;
    jumlahNota: number;
    total: number;
    dibayar: number;
    sisa: number;
    notaTerlambat: number;
    jatuhTempoTerdekat: Date | null;
  };

  const map = new Map<string, Rekap>();
  for (const p of data) {
    const key = p.customerId
      ? `c-${p.customerId}`
      : `n-${(p.namaCustomer || "-").toLowerCase()}`;
    const r =
      map.get(key) ||
      ({
        nama: getNamaCustomer(p),
        namaToko: p.customer?.namaToko || "-",
        noHp: p.customer?.noHp || "-",
        limit: p.customer ? toNumber(p.customer.limit_piutang) : null,
        jumlahNota: 0,
        total: 0,
        dibayar: 0,
        sisa: 0,
        notaTerlambat: 0,
        jatuhTempoTerdekat: null,
      } as Rekap);

    r.jumlahNota++;
    r.total += toNumber(p.totalHarga);
    r.dibayar += getDibayar(p);
    const sisa = getSisa(p);
    r.sisa += sisa;

    if (p.statusPembayaran === "HUTANG" && p.tanggalJatuhTempo) {
      const hari = getSisaHariJatuhTempo(p.tanggalJatuhTempo);
      if (hari !== null && hari < 0) r.notaTerlambat++;
      if (
        sisa > 0 &&
        (!r.jatuhTempoTerdekat || p.tanggalJatuhTempo < r.jatuhTempoTerdekat)
      ) {
        r.jatuhTempoTerdekat = p.tanggalJatuhTempo;
      }
    }
    map.set(key, r);
  }

  const rekap = Array.from(map.values()).sort((a, b) => b.sisa - a.sisa);

  const headers = [
    { label: "No", width: 5 },
    { label: "Customer", width: 24 },
    { label: "Nama Toko", width: 24 },
    { label: "No HP", width: 15 },
    { label: "Jumlah Nota", width: 12 },
    { label: "Total Penjualan", width: 16 },
    { label: "Sudah Dibayar", width: 16 },
    { label: "Sisa Piutang", width: 16 },
    { label: "Limit Piutang", width: 16 },
    { label: "Nota Terlambat", width: 14 },
    { label: "Jatuh Tempo Terdekat", width: 20 },
  ];

  writeSheetHeader(
    ws,
    "REKAP PIUTANG PER CUSTOMER",
    "K",
    filters,
    `Total Customer: ${rekap.length}`,
  );
  writeTableHeader(ws, 5, headers);

  let rowNum = 6;
  const grand = { nota: 0, total: 0, dibayar: 0, sisa: 0, terlambat: 0 };

  rekap.forEach((r, index) => {
    grand.nota += r.jumlahNota;
    grand.total += r.total;
    grand.dibayar += r.dibayar;
    grand.sisa += r.sisa;
    grand.terlambat += r.notaTerlambat;

    const row = ws.getRow(rowNum);
    row.values = [
      index + 1,
      r.nama,
      r.namaToko,
      r.noHp,
      r.jumlahNota,
      r.total,
      r.dibayar,
      r.sisa,
      r.limit ?? "-",
      r.notaTerlambat,
      formatTanggal(r.jatuhTempoTerdekat),
    ];
    [6, 7, 8, 9].forEach((c) => (row.getCell(c).numFmt = "#,##0"));
    [1, 5, 10].forEach(
      (c) => (row.getCell(c).alignment = { horizontal: "center" }),
    );

    for (let i = 1; i <= headers.length; i++) row.getCell(i).border = thinBorder;

    // Tandai customer yang sisa piutangnya melebihi limit
    if (r.limit && r.limit > 0 && r.sisa > r.limit) {
      row.getCell(8).font = { bold: true, color: { argb: "FFC62828" } };
    }
    if (r.notaTerlambat > 0) {
      row.getCell(10).font = { bold: true, color: { argb: "FFC62828" } };
    }

    rowNum++;
  });

  const totalRow = ws.getRow(rowNum);
  totalRow.getCell(1).value = "TOTAL";
  ws.mergeCells(`A${rowNum}:D${rowNum}`);
  totalRow.getCell(5).value = grand.nota;
  totalRow.getCell(6).value = grand.total;
  totalRow.getCell(7).value = grand.dibayar;
  totalRow.getCell(8).value = grand.sisa;
  totalRow.getCell(10).value = grand.terlambat;
  [6, 7, 8].forEach((c) => (totalRow.getCell(c).numFmt = "#,##0"));
  styleTotalRow(totalRow, headers.length);
}

// ─── Sheet 3: riwayat pembayaran / cicilan ───────────────────────────────────
function generateRiwayatPembayaranSheet(
  workbook: ExcelJS.Workbook,
  data: PiutangRow[],
  filters: PiutangFilters,
) {
  const ws = workbook.addWorksheet("Riwayat Pembayaran");
  const headers = [
    { label: "No", width: 5 },
    { label: "Kode Penjualan", width: 20 },
    { label: "Customer", width: 22 },
    { label: "Nama Toko", width: 22 },
    { label: "Kode Pembayaran", width: 20 },
    { label: "Tanggal Bayar", width: 14 },
    { label: "Metode", width: 16 },
    { label: "Cash", width: 14 },
    { label: "Transfer", width: 14 },
    { label: "Nominal", width: 16 },
    { label: "Catatan", width: 28 },
  ];

  const totalPembayaran = data.reduce((s, p) => s + p.pembayaran.length, 0);
  writeSheetHeader(
    ws,
    "RIWAYAT PEMBAYARAN PIUTANG CUSTOMER",
    "K",
    filters,
    `Total Pembayaran: ${totalPembayaran}`,
  );
  writeTableHeader(ws, 5, headers);

  let rowNum = 6;
  let no = 1;
  let grandCash = 0;
  let grandTransfer = 0;
  let grandNominal = 0;

  for (const p of data) {
    for (const b of p.pembayaran) {
      const cash = toNumber(b.totalCash);
      const transfer = toNumber(b.totalTransfer);
      const nominal = toNumber(b.nominal);
      grandCash += cash;
      grandTransfer += transfer;
      grandNominal += nominal;

      const row = ws.getRow(rowNum);
      row.values = [
        no++,
        p.kodePenjualan,
        getNamaCustomer(p),
        p.customer?.namaToko || "-",
        b.kodePembayaran,
        formatTanggal(b.tanggalBayar),
        formatMetode(b.metode),
        cash,
        transfer,
        nominal,
        b.catatan || "-",
      ];
      [8, 9, 10].forEach((c) => (row.getCell(c).numFmt = "#,##0"));
      row.getCell(1).alignment = { horizontal: "center" };
      for (let i = 1; i <= headers.length; i++)
        row.getCell(i).border = thinBorder;
      rowNum++;
    }
  }

  if (totalPembayaran === 0) {
    ws.mergeCells(`A${rowNum}:K${rowNum}`);
    const cell = ws.getCell(`A${rowNum}`);
    cell.value = "Belum ada pembayaran untuk data ini";
    cell.alignment = { horizontal: "center" };
    cell.font = { italic: true, color: { argb: "FF757575" } };
    rowNum++;
  }

  const totalRow = ws.getRow(rowNum);
  totalRow.getCell(1).value = "TOTAL";
  ws.mergeCells(`A${rowNum}:G${rowNum}`);
  totalRow.getCell(8).value = grandCash;
  totalRow.getCell(9).value = grandTransfer;
  totalRow.getCell(10).value = grandNominal;
  [8, 9, 10].forEach((c) => (totalRow.getCell(c).numFmt = "#,##0"));
  styleTotalRow(totalRow, headers.length);
}

export async function GET(request: NextRequest) {
  try {
    const authData = await getAuthData();
    if (!authData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (authData.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "excel";
    const detail = searchParams.get("detail") !== "false";

    if (format !== "excel") {
      return NextResponse.json(
        { success: false, error: "Only excel format is supported" },
        { status: 400 },
      );
    }

    const filters = readPiutangFilters(searchParams);
    const data = await fetchPiutang(filters);

    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    generatePiutangSheet(workbook, data, filters);
    generateRekapCustomerSheet(workbook, data, filters);
    if (detail) {
      generateRiwayatPembayaranSheet(workbook, data, filters);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Laporan-Piutang-Customer-${detail ? "Detail" : "Summary"}-${Date.now()}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error export laporan piutang customer:", error);
    return NextResponse.json(
      { success: false, error: "Gagal membuat laporan piutang customer" },
      { status: 500 },
    );
  }
}
