import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "current";
    const year = searchParams.get("year");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");

    if (period === "yearly" && year) {
      return await exportYearly(parseInt(year));
    } else {
      return await exportMonthly(startDate, endDate, search);
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

// Export Monthly (Bulan Ini atau Custom Range)
async function exportMonthly(
  startDate: string | null,
  endDate: string | null,
  search: string | null
): Promise<NextResponse> {
  const whereHeader: any = {
    statusTransaksi: "SELESAI",
  };

  if (startDate || endDate) {
    whereHeader.tanggalTransaksi = {};
    if (startDate) {
      whereHeader.tanggalTransaksi.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      whereHeader.tanggalTransaksi.lte = end;
    }
  }

  const allItems = await prisma.penjualanItem.findMany({
    where: {
      penjualan: whereHeader,
    },
    include: {
      barang: true,
    },
  });

  const groupedData = new Map();

  allItems.forEach((item) => {
    const barangId = item.barangId;

    if (!groupedData.has(barangId)) {
      groupedData.set(barangId, {
        barangId: barangId,
        namaBarang: item.barang.namaBarang,
        ukuran: item.barang.ukuran,
        satuan: item.barang.satuan,
        jumlahPerkardus: item.barang.jumlahPerkardus,
        totalDusTerjual: 0,
        totalPcsTerjual: 0,
        totalQtyTerjual: 0,
        totalPenjualan: 0,
        totalModal: 0,
        totalLaba: 0,
        totalDiskon: 0,
        hargaBeli: item.hargaBeli,
        hargaJual: item.hargaJual,
        transaksiCount: new Set(),
      });
    }

    const data = groupedData.get(barangId);

    data.totalDusTerjual += item.jumlahDus;
    data.totalPcsTerjual += item.jumlahPcs;
    data.totalQtyTerjual +=
      item.jumlahDus * item.barang.jumlahPerkardus + item.jumlahPcs;

    const penjualanDus = item.hargaJual * item.jumlahDus;
    const penjualanPcs =
      item.jumlahPcs > 0
        ? Math.round(
            (item.hargaJual / item.barang.jumlahPerkardus) * item.jumlahPcs
          )
        : 0;

    const modalDus = item.hargaBeli * item.jumlahDus;
    const modalPcs =
      item.jumlahPcs > 0
        ? Math.round(
            (item.hargaBeli / item.barang.jumlahPerkardus) * item.jumlahPcs
          )
        : 0;

    data.totalPenjualan += penjualanDus + penjualanPcs;
    data.totalModal += modalDus + modalPcs;
    data.totalLaba += item.laba;
    data.totalDiskon += item.diskonPerItem * item.jumlahDus;
    data.hargaBeli = item.hargaBeli;
    data.hargaJual = item.hargaJual;
    data.transaksiCount.add(item.penjualanId);
  });

  let itemList = Array.from(groupedData.values()).map((item) => {
    const margin =
      item.totalPenjualan > 0
        ? (item.totalLaba / item.totalPenjualan) * 100
        : 0;
    return {
      ...item,
      margin: parseFloat(margin.toFixed(2)),
      jumlahTransaksi: item.transaksiCount.size,
    };
  });

  if (search) {
    itemList = itemList.filter((item) =>
      item.namaBarang.toLowerCase().includes(search.toLowerCase())
    );
  }

  itemList.sort((a, b) => b.totalQtyTerjual - a.totalQtyTerjual);

  return await createExcelMonthly(itemList, startDate, endDate);
}

async function createExcelMonthly(
  data: any[],
  startDate: string | null,
  endDate: string | null
): Promise<NextResponse> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Laporan Per Item");

  worksheet.columns = [
    { key: "no", width: 5 },
    { key: "nama", width: 30 },
    { key: "ukuran", width: 12 },
    { key: "dus", width: 10 },
    { key: "pcs", width: 10 },
    { key: "total", width: 12 },
    { key: "transaksi", width: 10 },
    { key: "penjualan", width: 18 },
    { key: "modal", width: 18 },
    { key: "laba", width: 18 },
    { key: "margin", width: 10 },
  ];

  // Title
  worksheet.mergeCells("A1:K1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "LAPORAN PENJUALAN PER ITEM";
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
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

  // Header
  const headerRow = worksheet.addRow([
    "No",
    "Nama Barang",
    "Ukuran",
    "Dus",
    "Pcs",
    "Total Pcs",
    "Transaksi",
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

  let totalDus = 0;
  let totalPcs = 0;
  let totalPenjualan = 0;
  let totalModal = 0;
  let totalLaba = 0;

  data.forEach((item, index) => {
    totalDus += item.totalDusTerjual;
    totalPcs += item.totalPcsTerjual;
    totalPenjualan += item.totalPenjualan;
    totalModal += item.totalModal;
    totalLaba += item.totalLaba;

    const row = worksheet.addRow([
      index + 1,
      item.namaBarang,
      `${item.ukuran} ${item.satuan}`,
      item.totalDusTerjual,
      item.totalPcsTerjual,
      item.totalQtyTerjual,
      item.jumlahTransaksi,
      item.totalPenjualan,
      item.totalModal,
      item.totalLaba,
      item.margin,
    ]);

    row.getCell(8).numFmt = "#,##0";
    row.getCell(9).numFmt = "#,##0";
    row.getCell(10).numFmt = "#,##0";
    row.getCell(11).numFmt = "0.00";

    if (item.totalLaba > 0) {
      row.getCell(10).font = { color: { argb: "FF388E3C" }, bold: true };
    } else if (item.totalLaba < 0) {
      row.getCell(10).font = { color: { argb: "FFD32F2F" }, bold: true };
    }

    row.eachCell((cell) => addBorder(cell));
  });

  // Total
  const totalRow = worksheet.addRow([
    "",
    "",
    "TOTAL:",
    totalDus,
    totalPcs,
    "",
    "",
    totalPenjualan,
    totalModal,
    totalLaba,
    totalPenjualan > 0 ? (totalLaba / totalPenjualan) * 100 : 0,
  ]);

  totalRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    if (colNumber >= 8 && colNumber <= 10) {
      cell.numFmt = "#,##0";
    }
    if (colNumber === 11) {
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
    cell.alignment = { horizontal: "right", vertical: "middle" };
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Laporan-Per-Item-${Date.now()}.xlsx"`,
    },
  });
}

// Export Yearly (Per Bulan Jan-Des)
async function exportYearly(year: number): Promise<NextResponse> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Laporan Tahunan ${year}`);

  worksheet.columns = [
    { key: "bulan", width: 15 },
    { key: "item", width: 12 },
    { key: "dus", width: 12 },
    { key: "pcs", width: 12 },
    { key: "totalPcs", width: 12 },
    { key: "penjualan", width: 18 },
    { key: "modal", width: 18 },
    { key: "laba", width: 18 },
    { key: "margin", width: 10 },
  ];

  // Title
  worksheet.mergeCells("A1:I1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `LAPORAN PENJUALAN PER ITEM TAHUNAN ${year}`;
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
    "Item Unik",
    "Dus",
    "Pcs",
    "Total Pcs",
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

  let totalItemsYear = 0;
  let totalDusYear = 0;
  let totalPcsYear = 0;
  let totalQtyYear = 0;
  let totalPenjualanYear = 0;
  let totalModalYear = 0;
  let totalLabaYear = 0;

  for (let month = 0; month < 12; month++) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    const items = await prisma.penjualanItem.findMany({
      where: {
        penjualan: {
          statusTransaksi: "SELESAI",
          tanggalTransaksi: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      include: {
        barang: true,
      },
    });

    const uniqueItems = new Set();
    let totalDus = 0;
    let totalPcs = 0;
    let totalQty = 0;
    let totalPenjualan = 0;
    let totalModal = 0;
    let totalLaba = 0;

    items.forEach((item) => {
      uniqueItems.add(item.barangId);
      totalDus += item.jumlahDus;
      totalPcs += item.jumlahPcs;
      totalQty += item.jumlahDus * item.barang.jumlahPerkardus + item.jumlahPcs;

      const penjualanDus = item.hargaJual * item.jumlahDus;
      const penjualanPcs =
        item.jumlahPcs > 0
          ? Math.round(
              (item.hargaJual / item.barang.jumlahPerkardus) * item.jumlahPcs
            )
          : 0;

      const modalDus = item.hargaBeli * item.jumlahDus;
      const modalPcs =
        item.jumlahPcs > 0
          ? Math.round(
              (item.hargaBeli / item.barang.jumlahPerkardus) * item.jumlahPcs
            )
          : 0;

      totalPenjualan += penjualanDus + penjualanPcs;
      totalModal += modalDus + modalPcs;
      totalLaba += item.laba;
    });

    const margin = totalPenjualan > 0 ? (totalLaba / totalPenjualan) * 100 : 0;

    const row = worksheet.addRow([
      monthNames[month],
      uniqueItems.size,
      totalDus,
      totalPcs,
      totalQty,
      totalPenjualan,
      totalModal,
      totalLaba,
      parseFloat(margin.toFixed(2)),
    ]);

    row.getCell(6).numFmt = "#,##0";
    row.getCell(7).numFmt = "#,##0";
    row.getCell(8).numFmt = "#,##0";
    row.getCell(9).numFmt = "0.00";

    row.eachCell((cell) => addBorder(cell));

    totalItemsYear += uniqueItems.size;
    totalDusYear += totalDus;
    totalPcsYear += totalPcs;
    totalQtyYear += totalQty;
    totalPenjualanYear += totalPenjualan;
    totalModalYear += totalModal;
    totalLabaYear += totalLaba;
  }

  // Total
  const totalRow = worksheet.addRow([
    "TOTAL",
    totalItemsYear,
    totalDusYear,
    totalPcsYear,
    totalQtyYear,
    totalPenjualanYear,
    totalModalYear,
    totalLabaYear,
    totalPenjualanYear > 0 ? (totalLabaYear / totalPenjualanYear) * 100 : 0,
  ]);

  totalRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true };
    if (colNumber >= 6 && colNumber <= 8) {
      cell.numFmt = "#,##0";
    }
    if (colNumber === 9) {
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
      "Content-Disposition": `attachment; filename="Laporan-Per-Item-Tahunan-${year}.xlsx"`,
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
