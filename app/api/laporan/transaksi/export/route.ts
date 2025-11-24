// =====================================================
// PATH: app/api/laporan/transaksi/export/route.ts
// FINAL VERSION: Support detail, summary, yearly
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

const prisma = new PrismaClient();

// GET: Export laporan transaksi
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "excel";
    const period = searchParams.get("period") || "current";
    const detail = searchParams.get("detail") !== "false"; // default true
    const year = searchParams.get("year");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");

    // Route berdasarkan period
    if (period === "yearly" && year) {
      return await exportYearly(parseInt(year));
    } else if (detail) {
      return await exportDetail(format, startDate, endDate, search);
    } else {
      return await exportSummary(format, startDate, endDate, search);
    }
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

// =====================================================
// EXPORT DETAIL (Per Transaksi + Breakdown Items)
// =====================================================
async function exportDetail(
  format: string,
  startDate: string | null,
  endDate: string | null,
  search: string | null
) {
  const penjualanList = await fetchPenjualan(startDate, endDate, search);

  if (format === "excel") {
    return await exportToExcelDetail(penjualanList, startDate, endDate);
  } else {
    return await exportToPDF(penjualanList, startDate, endDate);
  }
}

async function exportToExcelDetail(
  data: any[],
  startDate: string | null,
  endDate: string | null
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Laporan Detail Transaksi");

  worksheet.columns = [
    { key: "col1", width: 18 },
    { key: "col2", width: 35 },
    { key: "col3", width: 12 },
    { key: "col4", width: 12 },
    { key: "col5", width: 15 },
    { key: "col6", width: 15 },
    { key: "col7", width: 12 },
    { key: "col8", width: 15 },
    { key: "col9", width: 15 },
    { key: "col10", width: 15 },
    { key: "col11", width: 10 },
  ];

  // Title
  worksheet.mergeCells("A1:K1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "LAPORAN DETAIL TRANSAKSI PENJUALAN";
  titleCell.font = { size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2196F3" },
  };

  if (startDate || endDate) {
    worksheet.mergeCells("A2:K2");
    const periodCell = worksheet.getCell("A2");
    periodCell.value = `Periode: ${startDate || "..."} s/d ${endDate || "..."}`;
    periodCell.alignment = { horizontal: "center" };
    periodCell.font = { italic: true, size: 11 };
  }

  worksheet.addRow([]);

  let currentRow = startDate || endDate ? 4 : 3;

  let grandTotalPenjualan = 0;
  let grandTotalModal = 0;
  let grandTotalLaba = 0;

  data.forEach((penjualan) => {
    currentRow++;

    // Transaction Header
    worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
    const headerCell = worksheet.getCell(`A${currentRow}`);
    headerCell.value = `${penjualan.kodePenjualan} | ${new Date(
      penjualan.tanggalTransaksi
    ).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })} | ${penjualan.customer?.nama || penjualan.namaCustomer || "Umum"} ${
      penjualan.customer?.namaToko ? `(${penjualan.customer.namaToko})` : ""
    } | ${penjualan.statusPembayaran}`;
    headerCell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    headerCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1976D2" },
    };
    headerCell.alignment = { horizontal: "left", vertical: "middle" };
    addBorder(headerCell);

    currentRow++;

    // Item Headers
    const itemHeaderRow = worksheet.addRow([
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
    ]);

    itemHeaderRow.eachCell((cell) => {
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

    let transaksiPenjualan = 0;
    let transaksiModal = 0;
    let transaksiLaba = 0;

    // Items
    penjualan.items.forEach((item: any) => {
      const totalPcs =
        item.jumlahDus * item.barang.jumlahPerkardus + item.jumlahPcs;

      const penjualanDus = item.hargaJual * item.jumlahDus;
      const penjualanPcs =
        item.jumlahPcs > 0
          ? Math.round(
              (item.hargaJual / item.barang.jumlahPerkardus) * item.jumlahPcs
            )
          : 0;
      const totalPenjualan = penjualanDus + penjualanPcs;

      const totalDiskon = item.diskonPerItem * item.jumlahDus;
      const subtotal = totalPenjualan - totalDiskon;

      const modalDus = item.hargaBeli * item.jumlahDus;
      const modalPcs =
        item.jumlahPcs > 0
          ? Math.round(
              (item.hargaBeli / item.barang.jumlahPerkardus) * item.jumlahPcs
            )
          : 0;
      const totalModal = modalDus + modalPcs;

      const labaItem = item.laba;
      const marginItem = subtotal > 0 ? (labaItem / subtotal) * 100 : 0;

      transaksiPenjualan += subtotal;
      transaksiModal += totalModal;
      transaksiLaba += labaItem;

      const qtyText =
        item.jumlahDus > 0 && item.jumlahPcs > 0
          ? `${item.jumlahDus} dus + ${item.jumlahPcs} pcs (${totalPcs} pcs)`
          : item.jumlahDus > 0
          ? `${item.jumlahDus} dus (${totalPcs} pcs)`
          : `${item.jumlahPcs} pcs`;

      const row = worksheet.addRow([
        item.barang.id,
        item.barang.namaBarang,
        `${item.barang.ukuran} ${item.barang.satuan}`,
        qtyText,
        item.hargaJual,
        item.hargaBeli,
        totalDiskon,
        subtotal,
        totalModal,
        labaItem,
        parseFloat(marginItem.toFixed(2)),
      ]);

      row.getCell(5).numFmt = "#,##0";
      row.getCell(6).numFmt = "#,##0";
      row.getCell(7).numFmt = "#,##0";
      row.getCell(8).numFmt = "#,##0";
      row.getCell(9).numFmt = "#,##0";
      row.getCell(10).numFmt = "#,##0";
      row.getCell(11).numFmt = "0.00";

      if (labaItem > 0) {
        row.getCell(10).font = { color: { argb: "FF388E3C" }, bold: true };
      } else if (labaItem < 0) {
        row.getCell(10).font = { color: { argb: "FFD32F2F" }, bold: true };
      }

      row.eachCell((cell) => {
        addBorder(cell);
        cell.alignment = { vertical: "middle" };
      });

      currentRow++;
    });

    // Subtotal transaksi
    const marginTransaksi =
      transaksiPenjualan > 0 ? (transaksiLaba / transaksiPenjualan) * 100 : 0;

    const subtotalRow = worksheet.addRow([
      "",
      "",
      "",
      "",
      "",
      "",
      "SUBTOTAL:",
      transaksiPenjualan,
      transaksiModal,
      transaksiLaba,
      parseFloat(marginTransaksi.toFixed(2)),
    ]);

    subtotalRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF9C4" },
      };
      if (colNumber >= 8 && colNumber <= 10) {
        cell.numFmt = "#,##0";
      }
      if (colNumber === 11) {
        cell.numFmt = "0.00";
      }
      cell.border = {
        top: { style: "medium" },
        left: { style: "thin" },
        bottom: { style: "medium" },
        right: { style: "thin" },
      };
      cell.alignment = { horizontal: "right", vertical: "middle" };
    });

    grandTotalPenjualan += transaksiPenjualan;
    grandTotalModal += transaksiModal;
    grandTotalLaba += transaksiLaba;

    currentRow++;
    worksheet.addRow([]);
    currentRow++;
  });

  // Grand Total
  currentRow++;
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  const grandTotalLabelCell = worksheet.getCell(`A${currentRow}`);
  grandTotalLabelCell.value = `GRAND TOTAL (${data.length} Transaksi)`;
  grandTotalLabelCell.font = {
    bold: true,
    size: 12,
    color: { argb: "FFFFFFFF" },
  };
  grandTotalLabelCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF388E3C" },
  };
  grandTotalLabelCell.alignment = { horizontal: "center", vertical: "middle" };
  grandTotalLabelCell.border = {
    top: { style: "medium" },
    left: { style: "medium" },
    bottom: { style: "medium" },
    right: { style: "thin" },
  };

  const grandMargin =
    grandTotalPenjualan > 0 ? (grandTotalLaba / grandTotalPenjualan) * 100 : 0;

  ["G", "H", "I", "J", "K"].forEach((col, idx) => {
    const cell = worksheet.getCell(`${col}${currentRow}`);
    if (idx === 0) cell.value = "";
    else if (idx === 1) cell.value = grandTotalPenjualan;
    else if (idx === 2) cell.value = grandTotalModal;
    else if (idx === 3) cell.value = grandTotalLaba;
    else if (idx === 4) cell.value = parseFloat(grandMargin.toFixed(2));

    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF388E3C" },
    };
    if (idx >= 1 && idx <= 3) {
      cell.numFmt = "#,##0";
    }
    if (idx === 4) {
      cell.numFmt = "0.00";
    }
    cell.border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: idx === 4 ? { style: "medium" } : { style: "thin" },
    };
    cell.alignment = { horizontal: "right", vertical: "middle" };
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Laporan-Detail-${Date.now()}.xlsx"`,
    },
  });
}

// =====================================================
// EXPORT SUMMARY (Ringkasan tanpa detail items)
// =====================================================
async function exportSummary(
  format: string,
  startDate: string | null,
  endDate: string | null,
  search: string | null
) {
  const penjualanList = await fetchPenjualan(startDate, endDate, search);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Laporan Transaksi");

  worksheet.columns = [
    { key: "no", width: 5 },
    { key: "kode", width: 15 },
    { key: "tanggal", width: 18 },
    { key: "customer", width: 20 },
    { key: "dus", width: 10 },
    { key: "pcs", width: 10 },
    { key: "penjualan", width: 15 },
    { key: "modal", width: 15 },
    { key: "laba", width: 15 },
    { key: "margin", width: 10 },
    { key: "status", width: 12 },
  ];

  // Title
  worksheet.mergeCells("A1:K1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "LAPORAN TRANSAKSI PENJUALAN";
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4CAF50" },
  };

  if (startDate || endDate) {
    worksheet.mergeCells("A2:K2");
    const periodCell = worksheet.getCell("A2");
    periodCell.value = `Periode: ${startDate || "..."} s/d ${endDate || "..."}`;
    periodCell.alignment = { horizontal: "center" };
    periodCell.font = { italic: true };
  }

  const headerRow = worksheet.addRow([
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

  let totalPenjualan = 0;
  let totalModal = 0;
  let totalLaba = 0;
  let totalDus = 0;
  let totalPcs = 0;

  penjualanList.forEach((pj, index) => {
    let dus = 0;
    let pcs = 0;

    const modal = pj.items.reduce((sum: number, item: any) => {
      dus += item.jumlahDus;
      pcs += item.jumlahPcs;

      const modalDus = item.hargaBeli * item.jumlahDus;
      const modalPcs =
        item.jumlahPcs > 0
          ? Math.round(
              (item.hargaBeli / item.barang.jumlahPerkardus) * item.jumlahPcs
            )
          : 0;
      return sum + modalDus + modalPcs;
    }, 0);

    const laba = pj.items.reduce(
      (sum: number, item: any) => sum + item.laba,
      0
    );
    const margin = pj.totalHarga > 0 ? (laba / pj.totalHarga) * 100 : 0;

    totalPenjualan += pj.totalHarga;
    totalModal += modal;
    totalLaba += laba;
    totalDus += dus;
    totalPcs += pcs;

    const row = worksheet.addRow([
      index + 1,
      pj.kodePenjualan,
      new Date(pj.tanggalTransaksi).toLocaleString("id-ID"),
      pj.customer?.nama || pj.namaCustomer || "-",
      dus,
      pcs,
      pj.totalHarga,
      modal,
      laba,
      parseFloat(margin.toFixed(2)),
      pj.statusPembayaran,
    ]);

    row.getCell(7).numFmt = "#,##0";
    row.getCell(8).numFmt = "#,##0";
    row.getCell(9).numFmt = "#,##0";
    row.getCell(10).numFmt = "0.00";

    row.eachCell((cell) => addBorder(cell));
  });

  // Total
  const totalRow = worksheet.addRow([
    "",
    "",
    "",
    "TOTAL:",
    totalDus,
    totalPcs,
    totalPenjualan,
    totalModal,
    totalLaba,
    totalPenjualan > 0 ? (totalLaba / totalPenjualan) * 100 : 0,
    "",
  ]);

  totalRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    if (colNumber >= 7 && colNumber <= 9) {
      cell.numFmt = "#,##0";
    }
    if (colNumber === 10) {
      cell.numFmt = "0.00";
    }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFEB3B" },
    };
    addBorder(cell);
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Laporan-Transaksi-${Date.now()}.xlsx"`,
    },
  });
}

// =====================================================
// EXPORT YEARLY (Per Bulan Jan-Des)
// =====================================================
async function exportYearly(year: number) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Laporan Tahunan ${year}`);

  worksheet.columns = [
    { key: "bulan", width: 15 },
    { key: "transaksi", width: 12 },
    { key: "dus", width: 12 },
    { key: "pcs", width: 12 },
    { key: "penjualan", width: 18 },
    { key: "modal", width: 18 },
    { key: "laba", width: 18 },
    { key: "margin", width: 10 },
  ];

  // Title
  worksheet.mergeCells("A1:H1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `LAPORAN TRANSAKSI TAHUNAN ${year}`;
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4CAF50" },
  };

  worksheet.addRow([]);

  const headerRow = worksheet.addRow([
    "Bulan",
    "Transaksi",
    "Dus",
    "Pcs",
    "Penjualan",
    "Modal",
    "Laba",
    "Margin %",
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

  let totalTransaksi = 0;
  let totalDusYear = 0;
  let totalPcsYear = 0;
  let totalPenjualanYear = 0;
  let totalModalYear = 0;
  let totalLabaYear = 0;

  for (let month = 0; month < 12; month++) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

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
            barang: true,
          },
        },
      },
    });

    let totalPenjualan = 0;
    let totalModal = 0;
    let totalLaba = 0;
    let totalDus = 0;
    let totalPcs = 0;

    penjualanList.forEach((penjualan) => {
      totalPenjualan += penjualan.totalHarga;

      penjualan.items.forEach((item) => {
        totalDus += item.jumlahDus;
        totalPcs += item.jumlahPcs;

        const modalDus = item.hargaBeli * item.jumlahDus;
        const modalPcs =
          item.jumlahPcs > 0
            ? Math.round(
                (item.hargaBeli / item.barang.jumlahPerkardus) * item.jumlahPcs
              )
            : 0;
        totalModal += modalDus + modalPcs;
        totalLaba += item.laba;
      });
    });

    const margin = totalPenjualan > 0 ? (totalLaba / totalPenjualan) * 100 : 0;

    const row = worksheet.addRow([
      monthNames[month],
      penjualanList.length,
      totalDus,
      totalPcs,
      totalPenjualan,
      totalModal,
      totalLaba,
      parseFloat(margin.toFixed(2)),
    ]);

    row.getCell(5).numFmt = "#,##0";
    row.getCell(6).numFmt = "#,##0";
    row.getCell(7).numFmt = "#,##0";
    row.getCell(8).numFmt = "0.00";

    row.eachCell((cell) => addBorder(cell));

    totalTransaksi += penjualanList.length;
    totalDusYear += totalDus;
    totalPcsYear += totalPcs;
    totalPenjualanYear += totalPenjualan;
    totalModalYear += totalModal;
    totalLabaYear += totalLaba;
  }

  // Total
  const totalRow = worksheet.addRow([
    "TOTAL",
    totalTransaksi,
    totalDusYear,
    totalPcsYear,
    totalPenjualanYear,
    totalModalYear,
    totalLabaYear,
    totalPenjualanYear > 0 ? (totalLabaYear / totalPenjualanYear) * 100 : 0,
  ]);

  totalRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    if (colNumber >= 5 && colNumber <= 7) {
      cell.numFmt = "#,##0";
    }
    if (colNumber === 8) {
      cell.numFmt = "0.00";
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
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Laporan-Tahunan-${year}.xlsx"`,
    },
  });
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================
async function fetchPenjualan(
  startDate: string | null,
  endDate: string | null,
  search: string | null
) {
  const where: any = {
    statusTransaksi: "SELESAI",
  };

  if (startDate || endDate) {
    where.tanggalTransaksi = {};
    if (startDate) {
      where.tanggalTransaksi.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.tanggalTransaksi.lte = end;
    }
  }

  if (search) {
    where.OR = [
      { kodePenjualan: { contains: search, mode: "insensitive" } },
      { namaCustomer: { contains: search, mode: "insensitive" } },
    ];
  }

  return await prisma.penjualanHeader.findMany({
    where,
    include: {
      customer: true,
      items: {
        include: {
          barang: true,
        },
      },
    },
    orderBy: {
      tanggalTransaksi: "desc",
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

async function exportToPDF(
  data: any[],
  startDate: string | null,
  endDate: string | null
) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: any[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve(
        new NextResponse(buffer, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="Laporan-${Date.now()}.pdf"`,
          },
        })
      );
    });

    doc.fontSize(16).font("Helvetica-Bold").text("LAPORAN TRANSAKSI", {
      align: "center",
    });

    if (startDate || endDate) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(`Periode: ${startDate || "..."} s/d ${endDate || "..."}`, {
          align: "center",
        });
    }

    doc.moveDown();
    doc.fontSize(10).text(`Total: ${data.length} transaksi`);

    doc.end();
  });
}

function formatRupiah(num: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(num);
}
