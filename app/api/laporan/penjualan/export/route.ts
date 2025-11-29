import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

const prisma = new PrismaClient();

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
    ];
  }

  const penjualanList = await prisma.penjualanHeader.findMany({
    where,
    orderBy: { tanggalTransaksi: "desc" },
    include: {
      customer: true,
      items: {
        include: {
          barang: {
            select: {
              jumlahPerkardus: true,
            },
          },
        },
      },
    },
  });

  // Title
  worksheet.mergeCells("A1:K1");
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
  worksheet.mergeCells("A2:K2");
  const periodeCell = worksheet.getCell("A2");
  periodeCell.value = `Periode: ${formatDateRange(
    filters.startDate || undefined,
    filters.endDate || undefined
  )}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  // Total transaksi
  worksheet.mergeCells("A3:K3");
  const totalCell = worksheet.getCell("A3");
  totalCell.value = `Total Transaksi: ${penjualanList.length}`;
  totalCell.font = { bold: true };
  totalCell.alignment = { horizontal: "center" };

  // Headers
  const headers = [
    "No",
    "Kode",
    "Tanggal",
    "Customer",
    "Dus",
    "Pcs",
    "Penjualan",
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
  worksheet.getColumn(3).width = 12;
  worksheet.getColumn(4).width = 20;
  worksheet.getColumn(5).width = 8;
  worksheet.getColumn(6).width = 8;
  worksheet.getColumn(7).width = 15;
  worksheet.getColumn(8).width = 15;
  worksheet.getColumn(9).width = 15;
  worksheet.getColumn(10).width = 10;
  worksheet.getColumn(11).width = 10;

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
      const perKardus = toNumber(item.barang.jumlahPerkardus);
      return sum + dus * perKardus + pcs;
    }, 0);

    const totalModal = penjualan.items.reduce((sum, item) => {
      const jumlahDus = toNumber(item.jumlahDus);
      const jumlahPcs = toNumber(item.jumlahPcs);
      const hargaBeli = toNumber(item.hargaBeli);
      const jumlahPerkardus = toNumber(item.barang.jumlahPerkardus);

      const modalDus = hargaBeli * jumlahDus;
      const modalPcs =
        jumlahPcs > 0
          ? Math.round((hargaBeli / jumlahPerkardus) * jumlahPcs)
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
    row.getCell(3).value = new Date(
      penjualan.tanggalTransaksi
    ).toLocaleDateString("id-ID");
    row.getCell(4).value =
      penjualan.customer?.nama || penjualan.namaCustomer || "-";
    row.getCell(5).value = totalDus;
    row.getCell(6).value = totalPcs;
    row.getCell(7).value = penjualanAmount;
    row.getCell(8).value = totalModal;
    row.getCell(9).value = totalLaba;
    row.getCell(10).value = margin;
    row.getCell(11).value = penjualan.statusPembayaran;

    // Format
    row.getCell(7).numFmt = "#,##0";
    row.getCell(8).numFmt = "#,##0";
    row.getCell(9).numFmt = "#,##0";
    row.getCell(10).numFmt = "0.00";

    // Borders
    for (let i = 1; i <= 11; i++) {
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
  totalRow.getCell(5).value = grandTotalDus;
  totalRow.getCell(6).value = grandTotalPcs;
  totalRow.getCell(7).value = grandTotalPenjualan;
  totalRow.getCell(8).value = grandTotalModal;
  totalRow.getCell(9).value = grandTotalLaba;
  totalRow.getCell(10).value =
    grandTotalPenjualan > 0 ? (grandTotalLaba / grandTotalPenjualan) * 100 : 0;

  totalRow.font = { bold: true };
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF59D" },
  };

  totalRow.getCell(7).numFmt = "#,##0";
  totalRow.getCell(8).numFmt = "#,##0";
  totalRow.getCell(9).numFmt = "#,##0";
  totalRow.getCell(10).numFmt = "0.00";

  for (let i = 1; i <= 11; i++) {
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
    ];
  }

  const penjualanList = await prisma.penjualanHeader.findMany({
    where,
    orderBy: { tanggalTransaksi: "desc" },
    include: {
      customer: true,
      items: {
        include: {
          barang: {
            select: {
              id: true,
              namaBarang: true,
              ukuran: true,
              satuan: true,
              jumlahPerkardus: true,
            },
          },
        },
      },
    },
  });

  // Title
  worksheet.mergeCells("A1:L1");
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
  worksheet.mergeCells("A2:L2");
  const periodeCell = worksheet.getCell("A2");
  periodeCell.value = `Periode: ${formatDateRange(
    filters.startDate || undefined,
    filters.endDate || undefined
  )}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  // Total transaksi
  worksheet.mergeCells("A3:L3");
  const totalCell = worksheet.getCell("A3");
  totalCell.value = `Total Transaksi: ${penjualanList.length}`;
  totalCell.font = { bold: true };
  totalCell.alignment = { horizontal: "center" };

  // Column widths
  worksheet.getColumn(1).width = 5;
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 25;
  worksheet.getColumn(4).width = 12;
  worksheet.getColumn(5).width = 10;
  worksheet.getColumn(6).width = 12;
  worksheet.getColumn(7).width = 12;
  worksheet.getColumn(8).width = 12;
  worksheet.getColumn(9).width = 12;
  worksheet.getColumn(10).width = 12;
  worksheet.getColumn(11).width = 12;
  worksheet.getColumn(12).width = 10;

  let currentRow = 5;
  let grandTotalPenjualan = 0;
  let grandTotalModal = 0;
  let grandTotalLaba = 0;

  penjualanList.forEach((penjualan, transIndex) => {
    // Transaction header
    worksheet.mergeCells(`A${currentRow}:L${currentRow}`);
    const headerCell = worksheet.getCell(`A${currentRow}`);
    headerCell.value = `${transIndex + 1}. ${
      penjualan.kodePenjualan
    } | ${new Date(penjualan.tanggalTransaksi).toLocaleDateString("id-ID")} | ${
      penjualan.customer?.nama || penjualan.namaCustomer || "-"
    } | ${penjualan.statusPembayaran}`;
    headerCell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1976D2" },
    };
    headerCell.alignment = { horizontal: "left", vertical: "middle" };
    worksheet.getRow(currentRow).height = 25;
    currentRow++;

    // Item headers
    const itemHeaders = [
      "No",
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
      const jumlahPerkardus = toNumber(item.barang.jumlahPerkardus);

      const totalPcs = jumlahDus * jumlahPerkardus + jumlahPcs;
      const penjualanDus = hargaJual * jumlahDus;
      const penjualanPcs =
        jumlahPcs > 0
          ? Math.round((hargaJual / jumlahPerkardus) * jumlahPcs)
          : 0;
      const totalPenjualan = penjualanDus + penjualanPcs;
      const totalDiskon = diskonPerItem * jumlahDus;
      const subtotal = totalPenjualan - totalDiskon;

      const modalDus = hargaBeli * jumlahDus;
      const modalPcs =
        jumlahPcs > 0
          ? Math.round((hargaBeli / jumlahPerkardus) * jumlahPcs)
          : 0;
      const totalModalItem = modalDus + modalPcs;

      const marginItem = subtotal > 0 ? (laba / subtotal) * 100 : 0;

      subtotalPenjualan += subtotal;
      subtotalModal += totalModalItem;
      subtotalLaba += laba;

      const row = worksheet.getRow(currentRow);
      row.getCell(1).value = itemIndex + 1;
      row.getCell(2).value = `BRG-${item.barang.id}`;
      row.getCell(3).value = item.barang.namaBarang;
      row.getCell(4).value = `${item.barang.ukuran} ${item.barang.satuan}`;
      row.getCell(5).value = `${jumlahDus} (${totalPcs})`;
      row.getCell(6).value = hargaJual;
      row.getCell(7).value = hargaBeli;
      row.getCell(8).value = totalDiskon;
      row.getCell(9).value = subtotal;
      row.getCell(10).value = totalModalItem;
      row.getCell(11).value = laba;
      row.getCell(12).value = marginItem;

      // Format
      row.getCell(6).numFmt = "#,##0";
      row.getCell(7).numFmt = "#,##0";
      row.getCell(8).numFmt = "#,##0";
      row.getCell(9).numFmt = "#,##0";
      row.getCell(10).numFmt = "#,##0";
      row.getCell(11).numFmt = "#,##0";
      row.getCell(12).numFmt = "0.00";

      // Color laba
      if (laba > 0) {
        row.getCell(11).font = { color: { argb: "FF388E3C" } };
      } else if (laba < 0) {
        row.getCell(11).font = { color: { argb: "FFD32F2F" } };
      }

      // Borders
      for (let i = 1; i <= 12; i++) {
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
      worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
      diskonRow.getCell(1).value = "Diskon Nota:";
      diskonRow.getCell(1).alignment = { horizontal: "right" };
      diskonRow.getCell(9).value = -diskonNota;
      diskonRow.getCell(9).numFmt = "#,##0";
      diskonRow.getCell(9).font = { color: { argb: "FFD32F2F" } };
      subtotalPenjualan -= diskonNota;
      currentRow++;
    }

    // Subtotal per transaction
    const subtotalRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
    subtotalRow.getCell(1).value = "SUBTOTAL:";
    subtotalRow.getCell(1).font = { bold: true };
    subtotalRow.getCell(1).alignment = { horizontal: "right" };
    subtotalRow.getCell(9).value = subtotalPenjualan;
    subtotalRow.getCell(10).value = subtotalModal;
    subtotalRow.getCell(11).value = subtotalLaba;
    subtotalRow.getCell(12).value =
      subtotalPenjualan > 0 ? (subtotalLaba / subtotalPenjualan) * 100 : 0;

    subtotalRow.font = { bold: true };
    subtotalRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF9C4" },
    };

    subtotalRow.getCell(9).numFmt = "#,##0";
    subtotalRow.getCell(10).numFmt = "#,##0";
    subtotalRow.getCell(11).numFmt = "#,##0";
    subtotalRow.getCell(12).numFmt = "0.00";

    grandTotalPenjualan += subtotalPenjualan;
    grandTotalModal += subtotalModal;
    grandTotalLaba += subtotalLaba;

    currentRow += 2; // Space between transactions
  });

  // Grand total
  const grandTotalRow = worksheet.getRow(currentRow);
  worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
  grandTotalRow.getCell(1).value = "GRAND TOTAL:";
  grandTotalRow.getCell(1).font = {
    bold: true,
    size: 12,
    color: { argb: "FFFFFFFF" },
  };
  grandTotalRow.getCell(1).alignment = { horizontal: "right" };
  grandTotalRow.getCell(9).value = grandTotalPenjualan;
  grandTotalRow.getCell(10).value = grandTotalModal;
  grandTotalRow.getCell(11).value = grandTotalLaba;
  grandTotalRow.getCell(12).value =
    grandTotalPenjualan > 0 ? (grandTotalLaba / grandTotalPenjualan) * 100 : 0;

  grandTotalRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  grandTotalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF388E3C" },
  };

  grandTotalRow.getCell(9).numFmt = "#,##0";
  grandTotalRow.getCell(10).numFmt = "#,##0";
  grandTotalRow.getCell(11).numFmt = "#,##0";
  grandTotalRow.getCell(12).numFmt = "0.00";

  for (let i = 1; i <= 12; i++) {
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
                jumlahPerkardus: true,
              },
            },
          },
        },
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
        const jumlahPerkardus = toNumber(item.barang.jumlahPerkardus);

        const modalDus = hargaBeli * jumlahDus;
        const modalPcs =
          jumlahPcs > 0
            ? Math.round((hargaBeli / jumlahPerkardus) * jumlahPcs)
            : 0;
        monthTotalModal += modalDus + modalPcs;
        monthTotalLaba += laba;

        monthTotalDus += jumlahDus;
        monthTotalPcs += jumlahDus * jumlahPerkardus + jumlahPcs;
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
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF388E3C" },
  };

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
