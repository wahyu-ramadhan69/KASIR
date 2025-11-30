// =====================================================
// PATH: app/api/laporan/pembelian/export/route.ts
// COMPLETE VERSION with Items Detail
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

const prisma = new PrismaClient();

// Helper to convert BigInt to number safely
function toNumber(value: any): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value || 0);
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================
async function fetchPembelian(
  startDate: string | null,
  endDate: string | null,
  search: string | null,
  supplierId: string | null
): Promise<any[]> {
  const where: any = {
    statusTransaksi: "SELESAI",
  };

  // DATE RANGE FILTER - Use createdAt for consistency with UI
  if (startDate || endDate) {
    where.createdAt = {};

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      where.createdAt.gte = start;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  // SUPPLIER FILTER
  if (supplierId) {
    where.supplierId = parseInt(supplierId);
  }

  // SEARCH
  if (search) {
    where.OR = [
      { kodePembelian: { contains: search, mode: "insensitive" } },
      { supplier: { namaSupplier: { contains: search, mode: "insensitive" } } },
    ];
  }

  return await prisma.pembelianHeader.findMany({
    where,
    include: {
      supplier: true,
      items: {
        include: {
          barang: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

function addBorder(cell: any) {
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
}

function formatDateRange(
  startDate: string | null,
  endDate: string | null
): string {
  if (!startDate && !endDate) {
    return "Semua Periode";
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  if (startDate && endDate) {
    return `${formatDate(startDate)} s/d ${formatDate(endDate)}`;
  } else if (startDate) {
    return `Sejak ${formatDate(startDate)}`;
  } else {
    return `Sampai ${formatDate(endDate!)}`;
  }
}

// =====================================================
// EXPORT SUMMARY (Ringkasan)
// =====================================================
async function exportSummary(
  startDate: string | null,
  endDate: string | null,
  search: string | null,
  supplierId: string | null
): Promise<NextResponse> {
  const pembelianList = await fetchPembelian(
    startDate,
    endDate,
    search,
    supplierId
  );

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Laporan Pembelian");

  worksheet.columns = [
    { key: "no", width: 5 },
    { key: "kode", width: 15 },
    { key: "tanggal", width: 18 },
    { key: "supplier", width: 25 },
    { key: "items", width: 10 },
    { key: "dus", width: 10 },
    { key: "subtotal", width: 15 },
    { key: "diskon", width: 12 },
    { key: "total", width: 15 },
    { key: "dibayar", width: 15 },
    { key: "status", width: 12 },
  ];

  // Title
  worksheet.mergeCells("A1:K1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "LAPORAN PEMBELIAN";
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2196F3" },
  };

  // DATE RANGE ROW
  worksheet.mergeCells("A2:K2");
  const periodCell = worksheet.getCell("A2");
  periodCell.value = `Periode: ${formatDateRange(startDate, endDate)}`;
  periodCell.alignment = { horizontal: "center" };
  periodCell.font = { italic: true, size: 11 };

  // Info row
  worksheet.mergeCells("A3:K3");
  const infoCell = worksheet.getCell("A3");
  infoCell.value = `Total Transaksi: ${pembelianList.length}`;
  infoCell.alignment = { horizontal: "center" };
  infoCell.font = { size: 10 };

  worksheet.addRow([]);

  const headerRow = worksheet.addRow([
    "No",
    "Kode",
    "Tanggal",
    "Supplier",
    "Items",
    "Total Dus",
    "Subtotal",
    "Diskon",
    "Total",
    "Dibayar",
    "Status",
  ]);

  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    addBorder(cell);
  });

  let grandTotal = {
    subtotal: 0,
    diskon: 0,
    total: 0,
    dibayar: 0,
    totalDus: 0,
    totalItems: 0,
  };

  pembelianList.forEach((pb, index) => {
    const subtotal = toNumber(pb.subtotal);
    const diskonNota = toNumber(pb.diskonNota);
    const totalHarga = toNumber(pb.totalHarga);
    const jumlahDibayar = toNumber(pb.jumlahDibayar);

    let totalDus = 0;
    let jumlahItems = pb.items.length;

    pb.items.forEach((item: any) => {
      totalDus += toNumber(item.jumlahDus);
    });

    grandTotal.subtotal += subtotal;
    grandTotal.diskon += diskonNota;
    grandTotal.total += totalHarga;
    grandTotal.dibayar += jumlahDibayar;
    grandTotal.totalDus += totalDus;
    grandTotal.totalItems += jumlahItems;

    const row = worksheet.addRow([
      index + 1,
      pb.kodePembelian,
      new Date(pb.createdAt).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      pb.supplier.namaSupplier,
      jumlahItems,
      totalDus,
      subtotal,
      diskonNota,
      totalHarga,
      jumlahDibayar,
      pb.statusPembayaran,
    ]);

    row.getCell(7).numFmt = "#,##0";
    row.getCell(8).numFmt = "#,##0";
    row.getCell(9).numFmt = "#,##0";
    row.getCell(10).numFmt = "#,##0";

    row.eachCell((cell) => addBorder(cell));
  });

  // Total Row
  const totalRow = worksheet.addRow([
    "",
    "",
    "",
    "TOTAL:",
    grandTotal.totalItems,
    grandTotal.totalDus,
    grandTotal.subtotal,
    grandTotal.diskon,
    grandTotal.total,
    grandTotal.dibayar,
    "",
  ]);

  totalRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    if (colNumber >= 7 && colNumber <= 10) {
      cell.numFmt = "#,##0";
    }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFEB3B" },
    };
    cell.border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
    cell.alignment = { horizontal: "right", vertical: "middle" };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `Laporan-Pembelian-Summary-${startDate || "all"}-${
    endDate || "all"
  }-${Date.now()}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// =====================================================
// EXPORT DETAIL (Dengan breakdown items)
// =====================================================
async function exportDetail(
  startDate: string | null,
  endDate: string | null,
  search: string | null,
  supplierId: string | null
): Promise<NextResponse> {
  const pembelianList = await fetchPembelian(
    startDate,
    endDate,
    search,
    supplierId
  );

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Laporan Detail Pembelian");

  worksheet.columns = [
    { key: "col1", width: 5 },   // No
    { key: "col2", width: 12 },  // Tanggal
    { key: "col3", width: 20 },  // Kode Pembelian
    { key: "col4", width: 24 },  // Supplier
    { key: "col5", width: 18 },  // Status Pembayaran
    { key: "col6", width: 12 },  // Kode Barang
    { key: "col7", width: 22 },  // Nama Barang
    { key: "col8", width: 12 },  // Ukuran
    { key: "col9", width: 14 },  // Qty
    { key: "col10", width: 14 }, // Harga Beli
    { key: "col11", width: 12 }, // Diskon/Item
    { key: "col12", width: 14 }, // Total Harga
    { key: "col13", width: 14 }, // Subtotal
  ];

  // Title
  worksheet.mergeCells("A1:M1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "LAPORAN DETAIL PEMBELIAN";
  titleCell.font = { size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2196F3" },
  };

  // DATE RANGE ROW
  worksheet.mergeCells("A2:M2");
  const periodCell = worksheet.getCell("A2");
  periodCell.value = `Periode: ${formatDateRange(startDate, endDate)}`;
  periodCell.alignment = { horizontal: "center" };
  periodCell.font = { italic: true, size: 11 };

  worksheet.addRow([]);

  let currentRow = 4;
  let grandTotal = { subtotal: 0, diskon: 0, total: 0 };

  pembelianList.forEach((pembelian, idx) => {
    // Item headers
    const itemHeader = worksheet.addRow([
      "No",
      "Tanggal",
      "Kode Pembelian",
      "Supplier",
      "Status Pembayaran",
      "Kode",
      "Nama Barang",
      "Ukuran",
      "Qty (Dus/Pcs)",
      "Harga Beli",
      "Diskon/Item",
      "Total Harga",
      "Subtotal",
    ]);

    itemHeader.eachCell((cell) => {
      cell.font = { bold: true, size: 9 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      addBorder(cell);
    });
    currentRow++;

    let transaksiTotal = { subtotal: 0, diskon: 0, total: 0 };

    pembelian.items.forEach((item: any, itemIdx: number) => {
      const jumlahDus = toNumber(item.jumlahDus);
      const hargaPokok = toNumber(item.hargaPokok);
      const diskonPerItem = toNumber(item.diskonPerItem);
      const jumlahPerkardus = toNumber(item.barang.jumlahPerkardus);
      const ukuran = toNumber(item.barang.ukuran);

      const totalHarga = hargaPokok * jumlahDus;
      const totalDiskon = diskonPerItem * jumlahDus;
      const subtotal = totalHarga - totalDiskon;
      const totalPcs = jumlahDus * jumlahPerkardus;

      transaksiTotal.subtotal += totalHarga;
      transaksiTotal.diskon += totalDiskon;
      transaksiTotal.total += subtotal;

      const row = worksheet.addRow([
        itemIdx + 1,
        new Date(pembelian.createdAt).toLocaleDateString("id-ID"),
        pembelian.kodePembelian,
        pembelian.supplier.namaSupplier,
        pembelian.statusPembayaran,
        item.barang.id,
        item.barang.namaBarang,
        `${ukuran} ${item.barang.satuan}`,
        `${jumlahDus} (${totalPcs} pcs)`,
        hargaPokok,
        diskonPerItem,
        totalHarga,
        subtotal,
      ]);

      row.getCell(10).numFmt = "#,##0";
      row.getCell(11).numFmt = "#,##0";
      row.getCell(12).numFmt = "#,##0";
      row.getCell(13).numFmt = "#,##0";

      row.eachCell((cell) => {
        addBorder(cell);
        cell.alignment = { vertical: "middle" };
      });
      currentRow++;
    });

    // Diskon Nota
    if (toNumber(pembelian.diskonNota) > 0) {
      const diskonNotaRow = worksheet.addRow([
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "Diskon Nota:",
        "",
        toNumber(pembelian.diskonNota),
      ]);
      diskonNotaRow.getCell(13).numFmt = "#,##0";
      diskonNotaRow.getCell(13).font = { color: { argb: "FFD32F2F" } };
      diskonNotaRow.eachCell((cell) => addBorder(cell));
      currentRow++;
    }

    // Subtotal transaksi
    const totalHargaPembelian = toNumber(pembelian.totalHarga);
    const subtotalRow = worksheet.addRow([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "SUBTOTAL:",
      totalHargaPembelian,
    ]);

    subtotalRow.eachCell((cell, col) => {
      cell.font = { bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF9C4" },
      };
      if (col === 13) {
        cell.numFmt = "#,##0";
      }
      cell.border = {
        top: { style: "medium" },
        left: { style: "thin" },
        bottom: { style: "medium" },
        right: { style: "thin" },
      };
      cell.alignment = { horizontal: "right", vertical: "middle" };
    });

    grandTotal.subtotal += transaksiTotal.subtotal;
    grandTotal.diskon += transaksiTotal.diskon + toNumber(pembelian.diskonNota);
    grandTotal.total += totalHargaPembelian;

    currentRow++;
    worksheet.addRow([]);
    currentRow++;
  });

  // Grand Total
  currentRow++;
  worksheet.mergeCells(`A${currentRow}:L${currentRow}`);
  const grandLabel = worksheet.getCell(`A${currentRow}`);
  grandLabel.value = `GRAND TOTAL (${pembelianList.length} Transaksi)`;
  grandLabel.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  grandLabel.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF388E3C" },
  };
  grandLabel.alignment = { horizontal: "center", vertical: "middle" };
  grandLabel.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "medium" },
    right: { style: "thin" },
  };

  const grandCell = worksheet.getCell(`M${currentRow}`);
  grandCell.value = grandTotal.total;
  grandCell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  grandCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF388E3C" },
  };
  grandCell.numFmt = "#,##0";
  grandCell.border = {
    top: { style: "medium" },
    left: { style: "thin" },
    bottom: { style: "medium" },
    right: { style: "medium" },
  };
  grandCell.alignment = { horizontal: "right", vertical: "middle" };

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `Laporan-Pembelian-Detail-${startDate || "all"}-${
    endDate || "all"
  }-${Date.now()}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// =====================================================
// EXPORT YEARLY
// =====================================================
async function exportYearly(year: number): Promise<NextResponse> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Laporan ${year}`);

  worksheet.columns = [
    { key: "bulan", width: 15 },
    { key: "transaksi", width: 12 },
    { key: "items", width: 12 },
    { key: "dus", width: 12 },
    { key: "subtotal", width: 18 },
    { key: "diskon", width: 15 },
    { key: "total", width: 18 },
  ];

  // Title
  worksheet.mergeCells("A1:G1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `LAPORAN PEMBELIAN TAHUNAN ${year}`;
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2196F3" },
  };

  worksheet.addRow([]);

  const headerRow = worksheet.addRow([
    "Bulan",
    "Transaksi",
    "Items",
    "Total Dus",
    "Subtotal",
    "Diskon",
    "Total",
  ]);

  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
    cell.alignment = { horizontal: "center" };
    addBorder(cell);
  });

  const monthNames = [
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

  let yearTotal = {
    transaksi: 0,
    items: 0,
    dus: 0,
    subtotal: 0,
    diskon: 0,
    total: 0,
  };

  for (let month = 0; month < 12; month++) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    const pembelianList = await prisma.pembelianHeader.findMany({
      where: {
        statusTransaksi: "SELESAI",
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        items: { include: { barang: true } },
      },
    });

    let monthTotal = { items: 0, dus: 0, subtotal: 0, diskon: 0, total: 0 };

    pembelianList.forEach((pb) => {
      monthTotal.subtotal += toNumber(pb.subtotal);
      monthTotal.diskon += toNumber(pb.diskonNota);
      monthTotal.total += toNumber(pb.totalHarga);

      pb.items.forEach((item) => {
        monthTotal.items += 1;
        monthTotal.dus += toNumber(item.jumlahDus);
      });
    });

    const row = worksheet.addRow([
      monthNames[month],
      pembelianList.length,
      monthTotal.items,
      monthTotal.dus,
      monthTotal.subtotal,
      monthTotal.diskon,
      monthTotal.total,
    ]);

    row.getCell(5).numFmt = "#,##0";
    row.getCell(6).numFmt = "#,##0";
    row.getCell(7).numFmt = "#,##0";

    row.eachCell((cell) => addBorder(cell));

    yearTotal.transaksi += pembelianList.length;
    yearTotal.items += monthTotal.items;
    yearTotal.dus += monthTotal.dus;
    yearTotal.subtotal += monthTotal.subtotal;
    yearTotal.diskon += monthTotal.diskon;
    yearTotal.total += monthTotal.total;
  }

  // Total
  const totalRow = worksheet.addRow([
    "TOTAL",
    yearTotal.transaksi,
    yearTotal.items,
    yearTotal.dus,
    yearTotal.subtotal,
    yearTotal.diskon,
    yearTotal.total,
  ]);

  totalRow.eachCell((cell, col) => {
    cell.font = { bold: true };
    if (col >= 5 && col <= 7) cell.numFmt = "#,##0";
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFEB3B" },
    };
    cell.border = {
      top: { style: "medium" },
      bottom: { style: "medium" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Laporan-Pembelian-Tahunan-${year}.xlsx"`,
    },
  });
}

// =====================================================
// MAIN HANDLER
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "excel";
    const period = searchParams.get("period") || "current";
    const detail = searchParams.get("detail") !== "false";
    const year = searchParams.get("year");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");
    const supplierId = searchParams.get("supplierId");

    // YEARLY REPORT
    if (period === "yearly" && year) {
      return await exportYearly(parseInt(year));
    }

    // DETAIL REPORT (with date range)
    if (detail) {
      return await exportDetail(startDate, endDate, search, supplierId);
    }

    // SUMMARY REPORT (with date range)
    return await exportSummary(startDate, endDate, search, supplierId);
  } catch (error) {
    console.error("Error exporting:", error);
    return NextResponse.json(
      { success: false, error: "Gagal export data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
