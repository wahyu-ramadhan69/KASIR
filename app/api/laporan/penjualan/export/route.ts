import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

const prisma = new PrismaClient();

function getCustomerOrSalesName(penjualan: any): string {
  if (penjualan.customer) return penjualan.customer.nama;
  if (penjualan.karyawan) return penjualan.karyawan.nama;
  if (penjualan.namaSales) return penjualan.namaSales;
  return penjualan.namaCustomer || "-";
}

function getCustomerName(p: any): string {
  if (p.customer) return p.customer.nama;
  if (p.karyawan) return p.karyawan.nama;
  if (p.namaSales) return p.namaSales;
  return p.namaCustomer || "-";
}

function getCustomerType(p: any): string {
  if (p.customer) return "Customer";
  if (p.karyawan || p.namaSales) return "Sales";
  return "-";
}

function getDijualOleh(p: any): string {
  if (p.perjalananSalesId) return "Kanvas Luar Kota";
  if (p.karyawanId) return "Kanvas Dalam Kota";
  return "Toko";
}

function toNumber(value: any): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value || 0);
}

function formatDateRange(startDate?: string, endDate?: string): string {
  const months = [
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

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.getDate()} ${
      months[start.getMonth()]
    } ${start.getFullYear()} s/d ${end.getDate()} ${
      months[end.getMonth()]
    } ${end.getFullYear()}`;
  } else if (startDate) {
    const start = new Date(startDate);
    return `Sejak ${start.getDate()} ${
      months[start.getMonth()]
    } ${start.getFullYear()}`;
  } else if (endDate) {
    const end = new Date(endDate);
    return `Sampai ${end.getDate()} ${
      months[end.getMonth()]
    } ${end.getFullYear()}`;
  }
  return "Semua Periode";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "excel";
    const detail = searchParams.get("detail") !== "false"; // default true
    const period = searchParams.get("period") || "current";
    const year = searchParams.get("year");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");

    if (format !== "excel") {
      return NextResponse.json(
        { success: false, error: "Only excel format is supported" },
        { status: 400 }
      );
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Laporan Penjualan");

    if (period === "yearly" && year) {
      // YEARLY REPORT
      await generateYearlyReport(worksheet, parseInt(year));
    } else if (detail) {
      // DETAIL REPORT (with items breakdown)
      await generateDetailReport(worksheet, { startDate, endDate, search });
    } else {
      // SUMMARY REPORT (no items breakdown)
      await generateSummaryReport(worksheet, { startDate, endDate, search });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const dateRange = formatDateRange(
      startDate || undefined,
      endDate || undefined
    );
    const filename = `Laporan-Penjualan-${dateRange.replace(
      /\s/g,
      "-"
    )}-${Date.now()}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

async function generateSummaryReport(
  worksheet: ExcelJS.Worksheet,
  filters: {
    startDate?: string | null;
    endDate?: string | null;
    search?: string | null;
  }
) {
  const where: any = { statusTransaksi: "SELESAI" };

  if (filters.startDate || filters.endDate) {
    where.tanggalTransaksi = {};
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      where.tanggalTransaksi.gte = start;
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      where.tanggalTransaksi.lte = end;
    }
  }

  if (filters.search) {
    where.OR = [
      { kodePenjualan: { contains: filters.search, mode: "insensitive" } },
      { namaCustomer: { contains: filters.search, mode: "insensitive" } },
      { customer: { nama: { contains: filters.search, mode: "insensitive" } } },
      { karyawan: { nama: { contains: filters.search, mode: "insensitive" } } },
      { namaSales: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const penjualanList = await prisma.penjualanHeader.findMany({
    where,
    orderBy: { tanggalTransaksi: "desc" },
    include: {
      customer: true,
      karyawan: true,
      items: {
        include: {
          barang: {
            select: {
              jumlahPerKemasan: true,
            },
          },
        },
      },
    },
  });

  // Title
  worksheet.mergeCells("A1:M1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "LAPORAN PENJUALAN";
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2196F3" },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  // Periode
  worksheet.mergeCells("A2:M2");
  const periodeCell = worksheet.getCell("A2");
  periodeCell.value = `Periode: ${formatDateRange(
    filters.startDate || undefined,
    filters.endDate || undefined
  )}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  // Total transaksi
  worksheet.mergeCells("A3:M3");
  const totalCell = worksheet.getCell("A3");
  totalCell.value = `Total Transaksi: ${penjualanList.length}`;
  totalCell.font = { bold: true };
  totalCell.alignment = { horizontal: "center" };

  // Headers
  const headers = [
    "No",
    "Kode",
    "Status Penjualan",
    "Tanggal",
    "Customer",
    "Dus",
    "Tipe Penjualan",
    "Pcs",
    "Total Penjualan",
    "Modal",
    "Laba",
    "Margin %",
    "Status",
  ];
  const headerRow = worksheet.getRow(5);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF616161" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Column widths
  worksheet.getColumn(1).width = 5;
  worksheet.getColumn(2).width = 18;
  worksheet.getColumn(3).width = 18;
  worksheet.getColumn(4).width = 12;
  worksheet.getColumn(5).width = 20;
  worksheet.getColumn(6).width = 8;
  worksheet.getColumn(7).width = 14;
  worksheet.getColumn(8).width = 15;
  worksheet.getColumn(9).width = 15;
  worksheet.getColumn(10).width = 15;
  worksheet.getColumn(11).width = 10;
  worksheet.getColumn(12).width = 10;
  worksheet.getColumn(13).width = 12;

  // Data rows
  let currentRow = 6;
  let grandTotalPenjualan = 0;
  let grandTotalModal = 0;
  let grandTotalLaba = 0;
  let grandTotalDus = 0;
  let grandTotalPcs = 0;

  penjualanList.forEach((penjualan, index) => {
    const totalDus = penjualan.items.reduce(
      (sum, item) => sum + toNumber(item.jumlahDus),
      0
    );
    const totalPcs = penjualan.items.reduce((sum, item) => {
      const dus = toNumber(item.jumlahDus);
      const pcs = toNumber(item.jumlahPcs);
      const perKardus = toNumber(item.barang.jumlahPerKemasan);
      return sum + dus * perKardus + pcs;
    }, 0);

    const totalModal = penjualan.items.reduce((sum, item) => {
      const jumlahDus = toNumber(item.jumlahDus);
      const jumlahPcs = toNumber(item.jumlahPcs);
      const hargaBeli = toNumber(item.hargaBeli);
      const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);

      const modalDus = hargaBeli * jumlahDus;
      const modalPcs =
        jumlahPcs > 0
          ? Math.round((hargaBeli / jumlahPerKemasan) * jumlahPcs)
          : 0;
      return sum + modalDus + modalPcs;
    }, 0);

    const totalLaba = penjualan.items.reduce(
      (sum, item) => sum + toNumber(item.laba),
      0
    );
    const penjualanAmount = toNumber(penjualan.totalHarga);
    const margin =
      penjualanAmount > 0 ? (totalLaba / penjualanAmount) * 100 : 0;

    grandTotalPenjualan += penjualanAmount;
    grandTotalModal += totalModal;
    grandTotalLaba += totalLaba;
    grandTotalDus += totalDus;
    grandTotalPcs += totalPcs;

    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = penjualan.kodePenjualan;
    row.getCell(3).value = getDijualOleh(penjualan);
    row.getCell(4).value = new Date(
      penjualan.tanggalTransaksi
    ).toLocaleDateString("id-ID");
    row.getCell(5).value = getCustomerOrSalesName(penjualan);

    row.getCell(6).value = totalDus;
    row.getCell(7).value = getCustomerType(penjualan);
    row.getCell(8).value = totalPcs;
    row.getCell(9).value = penjualanAmount;
    row.getCell(10).value = totalModal;
    row.getCell(11).value = totalLaba;
    row.getCell(12).value = margin;
    row.getCell(13).value = penjualan.statusPembayaran;

    // Format
    row.getCell(9).numFmt = "#,##0";
    row.getCell(10).numFmt = "#,##0";
    row.getCell(11).numFmt = "#,##0";
    row.getCell(12).numFmt = "0.00";

    // Borders
    for (let i = 1; i <= 13; i++) {
      row.getCell(i).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }

    currentRow++;
  });

  // Grand total row
  const totalRow = worksheet.getRow(currentRow);
  totalRow.getCell(1).value = "TOTAL";
  totalRow.getCell(6).value = grandTotalDus;
  totalRow.getCell(8).value = grandTotalPcs;
  totalRow.getCell(9).value = grandTotalPenjualan;
  totalRow.getCell(10).value = grandTotalModal;
  totalRow.getCell(11).value = grandTotalLaba;
  totalRow.getCell(12).value =
    grandTotalPenjualan > 0 ? (grandTotalLaba / grandTotalPenjualan) * 100 : 0;

  totalRow.font = { bold: true };
  // Limit highlight to data columns only
  for (let i = 1; i <= 13; i++) {
    totalRow.getCell(i).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF59D" },
    };
  }

  totalRow.getCell(9).numFmt = "#,##0";
  totalRow.getCell(10).numFmt = "#,##0";
  totalRow.getCell(11).numFmt = "#,##0";
  totalRow.getCell(12).numFmt = "0.00";

  for (let i = 1; i <= 13; i++) {
    totalRow.getCell(i).border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  }
}

async function generateDetailReport(
  worksheet: ExcelJS.Worksheet,
  filters: {
    startDate?: string | null;
    endDate?: string | null;
    search?: string | null;
  }
) {
  const where: any = { statusTransaksi: "SELESAI" };

  if (filters.startDate || filters.endDate) {
    where.tanggalTransaksi = {};
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      where.tanggalTransaksi.gte = start;
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      where.tanggalTransaksi.lte = end;
    }
  }

  if (filters.search) {
    where.OR = [
      { kodePenjualan: { contains: filters.search, mode: "insensitive" } },
      { namaCustomer: { contains: filters.search, mode: "insensitive" } },
      { customer: { nama: { contains: filters.search, mode: "insensitive" } } },
      { karyawan: { nama: { contains: filters.search, mode: "insensitive" } } },
      { namaSales: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const penjualanList = await prisma.penjualanHeader.findMany({
    where,
    orderBy: { tanggalTransaksi: "desc" },
    include: {
      customer: true,
      karyawan: true,
      items: {
        include: {
          barang: {
            select: {
              id: true,
              namaBarang: true,
              ukuran: true,
              satuan: true,
              jumlahPerKemasan: true,
            },
          },
        },
      },
    },
  });

  // Title
  worksheet.mergeCells("A1:Q1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "LAPORAN PENJUALAN DETAIL";
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2196F3" },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  // Periode
  worksheet.mergeCells("A2:Q2");
  const periodeCell = worksheet.getCell("A2");
  periodeCell.value = `Periode: ${formatDateRange(
    filters.startDate || undefined,
    filters.endDate || undefined
  )}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  // Total transaksi
  worksheet.mergeCells("A3:Q3");
  const totalCell = worksheet.getCell("A3");
  totalCell.value = `Total Transaksi: ${penjualanList.length}`;
  totalCell.font = { bold: true };
  totalCell.alignment = { horizontal: "center" };

  // Column widths
  worksheet.getColumn(1).width = 5; // No
  worksheet.getColumn(2).width = 12; // Tanggal
  worksheet.getColumn(3).width = 18; // Kode Penjualan
  worksheet.getColumn(4).width = 18; // Dijual Oleh
  worksheet.getColumn(5).width = 28; // Penjualan
  worksheet.getColumn(6).width = 16; // Status Pembayaran
  worksheet.getColumn(7).width = 14; // Kode Barang
  worksheet.getColumn(8).width = 22; // Nama Barang
  worksheet.getColumn(9).width = 12; // Ukuran
  worksheet.getColumn(10).width = 12; // Qty
  worksheet.getColumn(11).width = 12; // Harga Jual
  worksheet.getColumn(12).width = 12; // Harga Beli
  worksheet.getColumn(13).width = 12; // Diskon
  worksheet.getColumn(14).width = 12; // Subtotal
  worksheet.getColumn(15).width = 12; // Modal
  worksheet.getColumn(16).width = 12; // Laba
  worksheet.getColumn(17).width = 10; // Margin %

  let currentRow = 5;
  let grandTotalPenjualan = 0;
  let grandTotalModal = 0;
  let grandTotalLaba = 0;

  penjualanList.forEach((penjualan, transIndex) => {
    // Item headers
    const itemHeaders = [
      "No",
      "Tanggal",
      "Kode Penjualan",
      "Status Penjualan",
      "Customer",
      "Status Pembayaran",
      "Kode",
      "Nama Barang",
      "Ukuran",
      "Qty",
      "Harga Jual",
      "Harga Beli",
      "Diskon",
      "Subtotal",
      "Modal",
      "Laba",
      "Margin %",
    ];
    const itemHeaderRow = worksheet.getRow(currentRow);
    itemHeaders.forEach((header, index) => {
      const cell = itemHeaderRow.getCell(index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
    currentRow++;

    // Items
    let subtotalPenjualan = 0;
    let subtotalModal = 0;
    let subtotalLaba = 0;

    penjualan.items.forEach((item, itemIndex) => {
      const jumlahDus = toNumber(item.jumlahDus);
      const jumlahPcs = toNumber(item.jumlahPcs);
      const hargaJual = toNumber(item.hargaJual);
      const hargaBeli = toNumber(item.hargaBeli);
      const diskonPerItem = toNumber(item.diskonPerItem);
      const laba = toNumber(item.laba);
      const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);

      const totalPcs = jumlahDus * jumlahPerKemasan + jumlahPcs;
      const penjualanDus = hargaJual * jumlahDus;
      const penjualanPcs =
        jumlahPcs > 0
          ? Math.round((hargaJual / jumlahPerKemasan) * jumlahPcs)
          : 0;
      const totalPenjualan = penjualanDus + penjualanPcs;
      const totalDiskon = diskonPerItem * jumlahDus;
      const subtotal = totalPenjualan - totalDiskon;

      const modalDus = hargaBeli * jumlahDus;
      const modalPcs =
        jumlahPcs > 0
          ? Math.round((hargaBeli / jumlahPerKemasan) * jumlahPcs)
          : 0;
      const totalModalItem = modalDus + modalPcs;

      const marginItem = subtotal > 0 ? (laba / subtotal) * 100 : 0;

      subtotalPenjualan += subtotal;
      subtotalModal += totalModalItem;
      subtotalLaba += laba;

      const row = worksheet.getRow(currentRow);
      row.getCell(1).value = itemIndex + 1;
      row.getCell(2).value = new Date(
        penjualan.tanggalTransaksi
      ).toLocaleDateString("id-ID");
      row.getCell(3).value = penjualan.kodePenjualan;
      row.getCell(4).value = getDijualOleh(penjualan);
      row.getCell(5).value = getCustomerOrSalesName(penjualan);
      row.getCell(6).value = penjualan.statusPembayaran;
      row.getCell(7).value = `BRG-${item.barang.id}`;
      row.getCell(8).value = item.barang.namaBarang;
      row.getCell(9).value = `${item.barang.ukuran} ${item.barang.satuan}`;
      row.getCell(10).value = `${jumlahDus} (${totalPcs})`;
      row.getCell(11).value = hargaJual;
      row.getCell(12).value = hargaBeli;
      row.getCell(13).value = totalDiskon;
      row.getCell(14).value = subtotal;
      row.getCell(15).value = totalModalItem;
      row.getCell(16).value = laba;
      row.getCell(17).value = marginItem;

      // Format
      row.getCell(11).numFmt = "#,##0";
      row.getCell(12).numFmt = "#,##0";
      row.getCell(13).numFmt = "#,##0";
      row.getCell(14).numFmt = "#,##0";
      row.getCell(15).numFmt = "#,##0";
      row.getCell(16).numFmt = "#,##0";
      row.getCell(17).numFmt = "0.00";

      // Color laba
      if (laba > 0) {
        row.getCell(16).font = { color: { argb: "FF388E3C" } };
      } else if (laba < 0) {
        row.getCell(16).font = { color: { argb: "FFD32F2F" } };
      }

      // Borders
      for (let i = 1; i <= 17; i++) {
        row.getCell(i).border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }

      currentRow++;
    });

    // Diskon nota if any
    const diskonNota = toNumber(penjualan.diskonNota);
    if (diskonNota > 0) {
      const diskonRow = worksheet.getRow(currentRow);
      worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
      diskonRow.getCell(1).value = "Diskon Nota:";
      diskonRow.getCell(1).alignment = { horizontal: "right" };
      diskonRow.getCell(14).value = -diskonNota;
      diskonRow.getCell(14).numFmt = "#,##0";
      diskonRow.getCell(14).font = { color: { argb: "FFD32F2F" } };
      subtotalPenjualan -= diskonNota;
      currentRow++;
    }

    // Subtotal per transaction
    const subtotalRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
    subtotalRow.getCell(1).value = "SUBTOTAL:";
    subtotalRow.getCell(1).font = { bold: true };
    subtotalRow.getCell(1).alignment = { horizontal: "right" };
    subtotalRow.getCell(14).value = subtotalPenjualan;
    subtotalRow.getCell(15).value = subtotalModal;
    subtotalRow.getCell(16).value = subtotalLaba;
    subtotalRow.getCell(17).value =
      subtotalPenjualan > 0 ? (subtotalLaba / subtotalPenjualan) * 100 : 0;

    subtotalRow.font = { bold: true };
    for (let i = 1; i <= 17; i++) {
      subtotalRow.getCell(i).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF9C4" },
      };
    }

    subtotalRow.getCell(14).numFmt = "#,##0";
    subtotalRow.getCell(15).numFmt = "#,##0";
    subtotalRow.getCell(16).numFmt = "#,##0";
    subtotalRow.getCell(17).numFmt = "0.00";

    grandTotalPenjualan += subtotalPenjualan;
    grandTotalModal += subtotalModal;
    grandTotalLaba += subtotalLaba;

    currentRow += 2; // Space between transactions
  });

  // Grand total
  const grandTotalRow = worksheet.getRow(currentRow);
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  grandTotalRow.getCell(1).value = "GRAND TOTAL:";
  grandTotalRow.getCell(1).font = {
    bold: true,
    size: 12,
    color: { argb: "FFFFFFFF" },
  };
  grandTotalRow.getCell(1).alignment = { horizontal: "right" };
  grandTotalRow.getCell(14).value = grandTotalPenjualan;
  grandTotalRow.getCell(15).value = grandTotalModal;
  grandTotalRow.getCell(16).value = grandTotalLaba;
  grandTotalRow.getCell(17).value =
    grandTotalPenjualan > 0 ? (grandTotalLaba / grandTotalPenjualan) * 100 : 0;

  grandTotalRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  for (let i = 1; i <= 17; i++) {
    grandTotalRow.getCell(i).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF388E3C" },
    };
  }

  grandTotalRow.getCell(14).numFmt = "#,##0";
  grandTotalRow.getCell(15).numFmt = "#,##0";
  grandTotalRow.getCell(16).numFmt = "#,##0";
  grandTotalRow.getCell(17).numFmt = "0.00";

  for (let i = 1; i <= 17; i++) {
    grandTotalRow.getCell(i).border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  }
}

async function generateYearlyReport(
  worksheet: ExcelJS.Worksheet,
  year: number
) {
  const months = [
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

  // Title
  worksheet.mergeCells("A1:H1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `LAPORAN PENJUALAN TAHUNAN ${year}`;
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2196F3" },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  // Headers
  const headers = [
    "Bulan",
    "Transaksi",
    "Dus",
    "Pcs",
    "Penjualan",
    "Modal",
    "Laba",
    "Margin %",
  ];
  const headerRow = worksheet.getRow(3);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF616161" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Column widths
  worksheet.getColumn(1).width = 15;
  worksheet.getColumn(2).width = 12;
  worksheet.getColumn(3).width = 10;
  worksheet.getColumn(4).width = 10;
  worksheet.getColumn(5).width = 18;
  worksheet.getColumn(6).width = 18;
  worksheet.getColumn(7).width = 18;
  worksheet.getColumn(8).width = 12;

  let currentRow = 4;
  let annualTotalTransaksi = 0;
  let annualTotalDus = 0;
  let annualTotalPcs = 0;
  let annualTotalPenjualan = 0;
  let annualTotalModal = 0;
  let annualTotalLaba = 0;

  // Data for each month
  for (let month = 0; month < 12; month++) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const penjualanList = await prisma.penjualanHeader.findMany({
      where: {
        statusTransaksi: "SELESAI",
        tanggalTransaksi: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: {
          include: {
            barang: {
              select: {
                jumlahPerKemasan: true,
              },
            },
          },
        },
        karyawan: true,
      },
    });

    let monthTotalPenjualan = 0;
    let monthTotalModal = 0;
    let monthTotalLaba = 0;
    let monthTotalDus = 0;
    let monthTotalPcs = 0;

    penjualanList.forEach((penjualan) => {
      monthTotalPenjualan += toNumber(penjualan.totalHarga);

      penjualan.items.forEach((item) => {
        const jumlahDus = toNumber(item.jumlahDus);
        const jumlahPcs = toNumber(item.jumlahPcs);
        const hargaBeli = toNumber(item.hargaBeli);
        const laba = toNumber(item.laba);
        const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);

        const modalDus = hargaBeli * jumlahDus;
        const modalPcs =
          jumlahPcs > 0
            ? Math.round((hargaBeli / jumlahPerKemasan) * jumlahPcs)
            : 0;
        monthTotalModal += modalDus + modalPcs;
        monthTotalLaba += laba;

        monthTotalDus += jumlahDus;
        monthTotalPcs += jumlahDus * jumlahPerKemasan + jumlahPcs;
      });
    });

    const margin =
      monthTotalPenjualan > 0
        ? (monthTotalLaba / monthTotalPenjualan) * 100
        : 0;

    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = months[month];
    row.getCell(2).value = penjualanList.length;
    row.getCell(3).value = monthTotalDus;
    row.getCell(4).value = monthTotalPcs;
    row.getCell(5).value = monthTotalPenjualan;
    row.getCell(6).value = monthTotalModal;
    row.getCell(7).value = monthTotalLaba;
    row.getCell(8).value = margin;

    // Format
    row.getCell(5).numFmt = "#,##0";
    row.getCell(6).numFmt = "#,##0";
    row.getCell(7).numFmt = "#,##0";
    row.getCell(8).numFmt = "0.00";

    // Borders
    for (let i = 1; i <= 8; i++) {
      row.getCell(i).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }

    annualTotalTransaksi += penjualanList.length;
    annualTotalDus += monthTotalDus;
    annualTotalPcs += monthTotalPcs;
    annualTotalPenjualan += monthTotalPenjualan;
    annualTotalModal += monthTotalModal;
    annualTotalLaba += monthTotalLaba;

    currentRow++;
  }

  // Annual total
  const totalRow = worksheet.getRow(currentRow);
  totalRow.getCell(1).value = "TOTAL TAHUNAN";
  totalRow.getCell(2).value = annualTotalTransaksi;
  totalRow.getCell(3).value = annualTotalDus;
  totalRow.getCell(4).value = annualTotalPcs;
  totalRow.getCell(5).value = annualTotalPenjualan;
  totalRow.getCell(6).value = annualTotalModal;
  totalRow.getCell(7).value = annualTotalLaba;
  totalRow.getCell(8).value =
    annualTotalPenjualan > 0
      ? (annualTotalLaba / annualTotalPenjualan) * 100
      : 0;

  totalRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  for (let i = 1; i <= 8; i++) {
    totalRow.getCell(i).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF388E3C" },
    };
  }

  totalRow.getCell(5).numFmt = "#,##0";
  totalRow.getCell(6).numFmt = "#,##0";
  totalRow.getCell(7).numFmt = "#,##0";
  totalRow.getCell(8).numFmt = "0.00";

  for (let i = 1; i <= 8; i++) {
    totalRow.getCell(i).border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  }
}
