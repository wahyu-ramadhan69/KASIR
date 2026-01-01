import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

const prisma = new PrismaClient();

function toNumber(value: any): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value || 0);
}

function deriveDusPcsFromTotal(totalItem: number, jumlahPerKemasan: number) {
  const perKemasan = Math.max(1, jumlahPerKemasan);
  const jumlahDus = Math.floor(totalItem / perKemasan);
  const jumlahPcs = totalItem % perKemasan;
  return { jumlahDus, jumlahPcs };
}

function getTotalItemPcs(item: any, jumlahPerKemasan: number): number {
  if (item.totalItem !== undefined && item.totalItem !== null) {
    return toNumber(item.totalItem);
  }
  const jumlahDus = toNumber(item.jumlahDus);
  const jumlahPcs = toNumber(item.jumlahPcs);
  return jumlahDus * jumlahPerKemasan + jumlahPcs;
}

function toKg(grams: any): number {
  const kg = toNumber(grams) / 1000;
  return Number(kg.toFixed(3));
}

function formatKgDisplay(grams: any): string {
  const kg = toNumber(grams) / 1000;
  if (!Number.isFinite(kg)) return "0";
  const trimmed = kg.toFixed(3).replace(/\.?0+$/, "");
  return trimmed.replace(".", ",");
}

function getCustomerOrSalesName(penjualan: any): string {
  if (penjualan.customer) return penjualan.customer.nama;
  if (penjualan.sales) return penjualan.sales.namaSales;
  return penjualan.namaCustomer || penjualan.namaSales || "-";
}

function getDijualOleh(p: any): string {
  if (p.perjalananSalesId) return "Kanvas Luar Kota";
  if (p.karyawanId) return "Kanvas Dalam Kota";
  return "Toko";
}

function getPicPenjualan(p: any, userNameById: Map<number, string>): string {
  const tipe = getDijualOleh(p);
  if (tipe === "Toko") {
    if (p.userId && userNameById.has(p.userId)) {
      return userNameById.get(p.userId) || "-";
    }
    return "-";
  }

  return (
    p.perjalananSales?.karyawan?.nama || p.karyawan?.nama || p.namaSales || "-"
  );
}

async function buildUserNameMap(penjualanList: any[]) {
  const userIds = Array.from(
    new Set(
      penjualanList
        .map((penjualan) => penjualan.userId)
        .filter((userId): userId is number => Boolean(userId))
    )
  );

  if (userIds.length === 0) {
    return new Map<number, string>();
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true },
  });

  return new Map<number, string>(users.map((user) => [user.id, user.username]));
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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const mode = searchParams.get("mode") || "summary"; // 'summary' or 'detail'

    const workbook = new ExcelJS.Workbook();

    // Build date filter
    const dateFilter: any = {};
    if (startDate || endDate) {
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
    }

    // ====================================
    // SHEET 1: RINGKASAN
    // ====================================
    await generateRingkasan(workbook, dateFilter, startDate, endDate);

    // ====================================
    // SHEET 2: LAPORAN PEMBELIAN
    // ====================================
    if (mode === "detail") {
      await generateLaporanPembelianDetail(
        workbook,
        dateFilter,
        startDate,
        endDate
      );
    } else {
      await generateLaporanPembelian(workbook, dateFilter, startDate, endDate);
    }

    // ====================================
    // SHEET 3: LAPORAN PENJUALAN
    // ====================================
    await generateLaporanPenjualan(workbook, dateFilter, startDate, endDate);
    if (mode === "detail") {
      await generateLaporanPenjualanDetail(
        workbook,
        dateFilter,
        startDate,
        endDate
      );
    }

    // ====================================
    // SHEET 4: PEMBAYARAN PENJUALAN
    // ====================================
    await generateLaporanPembayaranPenjualan(
      workbook,
      dateFilter,
      startDate,
      endDate
    );

    // ====================================
    // SHEET 5: LAPORAN PENGELUARAN
    // ====================================
    await generateLaporanPengeluaran(workbook, dateFilter, startDate, endDate);

    // ====================================
    // SHEET 6: BARANG RUSAK
    // ====================================
    await generateLaporanPengembalianBarang(
      workbook,
      dateFilter,
      startDate,
      endDate
    );

    // ====================================
    // SHEET 7: LABA PER BARANG
    // ====================================
    await generateLaporanLabaBarang(workbook, dateFilter, startDate, endDate);

    const buffer = await workbook.xlsx.writeBuffer();
    const dateRange = formatDateRange(
      startDate || undefined,
      endDate || undefined
    );
    const modeLabel = mode === "detail" ? "Detail" : "Summary";
    const filename = `Laporan-Lengkap-${modeLabel}-${dateRange.replace(
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
    console.error("Error generating combined report:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate report" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// ====================================
// PENGEMBALIAN BARANG (RUSAK & KADALUARSA)
// ====================================
async function generateLaporanPengembalianBarang(
  workbook: ExcelJS.Workbook,
  dateFilter: any,
  startDate: string | null,
  endDate: string | null
) {
  const worksheet = workbook.addWorksheet("Barang Rusak");

  const where: any = {
    kondisiBarang: { in: ["RUSAK", "KADALUARSA"] },
  };

  if (Object.keys(dateFilter).length > 0) {
    where.tanggalPengembalian = dateFilter;
  }

  const pengembalianList = await prisma.pengembalianBarang.findMany({
    where,
    orderBy: { tanggalPengembalian: "desc" },
    include: {
      barang: {
        select: {
          namaBarang: true,
          jumlahPerKemasan: true,
        },
      },
      perjalanan: {
        select: {
          karyawan: {
            select: {
              nama: true,
            },
          },
        },
      },
    },
  });

  // Title
  worksheet.mergeCells("A1:I1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "BARANG RUSAK (RUSAK & KADALUARSA)";
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2196F3" },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  // Periode
  worksheet.mergeCells("A2:I2");
  const periodeCell = worksheet.getCell("A2");
  periodeCell.value = `Periode: ${formatDateRange(
    startDate || undefined,
    endDate || undefined
  )}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  worksheet.getRow(3).height = 5;

  // Headers
  const headers = [
    "No",
    "Tanggal",
    "Barang",
    "Kondisi",
    "Dus",
    "Pcs",
    "Total Pcs",
    "Keterangan",
    "Sales",
  ];
  const headerRow = worksheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF424242" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 20;

  // Column widths
  worksheet.getColumn(1).width = 5;
  worksheet.getColumn(2).width = 12;
  worksheet.getColumn(3).width = 28;
  worksheet.getColumn(4).width = 14;
  worksheet.getColumn(5).width = 8;
  worksheet.getColumn(6).width = 8;
  worksheet.getColumn(7).width = 12;
  worksheet.getColumn(8).width = 30;
  worksheet.getColumn(9).width = 20;

  let currentRow = 5;
  let totalDus = 0;
  let totalPcs = 0;
  let totalAllPcs = 0;

  pengembalianList.forEach((item, index) => {
    const jumlahDus = toNumber(item.jumlahDus);
    const jumlahPcs = toNumber(item.jumlahPcs);
    const perKemasan = toNumber(item.barang?.jumlahPerKemasan);
    const totalPcsItem = jumlahDus * perKemasan + jumlahPcs;

    totalDus += jumlahDus;
    totalPcs += jumlahPcs;
    totalAllPcs += totalPcsItem;

    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = new Date(
      item.tanggalPengembalian
    ).toLocaleDateString("id-ID");
    row.getCell(3).value = item.barang?.namaBarang || "-";
    row.getCell(4).value = item.kondisiBarang;
    row.getCell(5).value = jumlahDus;
    row.getCell(6).value = jumlahPcs;
    row.getCell(7).value = totalPcsItem;
    row.getCell(8).value = item.keterangan || "-";
    row.getCell(9).value = item.perjalanan?.karyawan?.nama || "-";

    row.getCell(5).alignment = { horizontal: "center" };
    row.getCell(6).alignment = { horizontal: "center" };
    row.getCell(7).alignment = { horizontal: "center" };

    for (let i = 1; i <= 9; i++) {
      row.getCell(i).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }

    currentRow++;
  });

  const totalRow = worksheet.getRow(currentRow);
  worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
  totalRow.getCell(1).value = "TOTAL";
  totalRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(5).value = totalDus;
  totalRow.getCell(6).value = totalPcs;
  totalRow.getCell(7).value = totalAllPcs;

  totalRow.height = 25;

  for (let i = 1; i <= 9; i++) {
    const cell = totalRow.getCell(i);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF388E3C" },
    };
    cell.border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  }

  for (let i = 10; i <= 50; i++) {
    const cell = totalRow.getCell(i);
    cell.style = {};
  }
}

// ====================================
// LAPORAN PENJUALAN
// ====================================
async function generateLaporanPenjualan(
  workbook: ExcelJS.Workbook,
  dateFilter: any,
  startDate: string | null,
  endDate: string | null
) {
  const worksheet = workbook.addWorksheet("Laporan Penjualan");

  const where: any = {
    statusTransaksi: "SELESAI",
    isDeleted: false,
  };

  if (Object.keys(dateFilter).length > 0) {
    where.tanggalTransaksi = dateFilter;
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
              berat: true,
              jumlahPerKemasan: true,
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
    startDate || undefined,
    endDate || undefined
  )}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  worksheet.getRow(3).height = 5;

  // Headers
  const headers = [
    "No",
    "Kode",
    "Tanggal",
    "Customer",
    "Metode Pembayaran",
    "Qty Kemasan",
    "Qty Item",
    "Penjualan",
    "Modal",
    "Laba",
    "Margin %",
  ];
  const headerRow = worksheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF424242" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 20;

  // Column widths
  worksheet.getColumn(1).width = 5;
  worksheet.getColumn(2).width = 18;
  worksheet.getColumn(3).width = 12;
  worksheet.getColumn(4).width = 25;
  worksheet.getColumn(5).width = 18;
  worksheet.getColumn(6).width = 8;
  worksheet.getColumn(7).width = 8;
  worksheet.getColumn(8).width = 15;
  worksheet.getColumn(9).width = 15;
  worksheet.getColumn(10).width = 15;
  worksheet.getColumn(11).width = 10;

  // Data rows
  let currentRow = 5;
  let grandTotalPenjualan = 0;
  let grandTotalModal = 0;
  let grandTotalLaba = 0;
  let grandTotalDus = 0;
  let grandTotalPcs = 0;

  penjualanList.forEach((penjualan, index) => {
    const totalHarga = toNumber(penjualan.totalHarga);
    let totalModal = 0;
    let totalLaba = 0;
    let totalDus = 0;
    let totalPcs = 0;

    penjualan.items.forEach((item) => {
      const hargaBeli = toNumber(item.hargaBeli);
      const laba = toNumber(item.laba);
      const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
      const totalItem = getTotalItemPcs(item, jumlahPerKemasan);
      const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
        totalItem,
        jumlahPerKemasan
      );

      const modalDus = hargaBeli * jumlahDus;
      const modalPcs =
        jumlahPcs > 0 && jumlahPerKemasan > 0
          ? Math.round((hargaBeli / jumlahPerKemasan) * jumlahPcs)
          : 0;

      totalModal += modalDus + modalPcs;
      totalLaba += laba;
      totalDus += jumlahDus;
      totalPcs += totalItem;
    });

    const margin = totalHarga > 0 ? (totalLaba / totalHarga) * 100 : 0;

    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = penjualan.kodePenjualan;
    row.getCell(3).value = new Date(
      penjualan.tanggalTransaksi
    ).toLocaleDateString("id-ID");
    row.getCell(4).value = getCustomerOrSalesName(penjualan);
    row.getCell(5).value = penjualan.metodePembayaran || "-";
    row.getCell(6).value = totalDus;
    row.getCell(7).value = totalPcs;
    row.getCell(8).value = totalHarga;
    row.getCell(9).value = totalModal;
    row.getCell(10).value = totalLaba;
    row.getCell(11).value = margin;

    // Format
    row.getCell(8).numFmt = "#,##0";
    row.getCell(9).numFmt = "#,##0";
    row.getCell(10).numFmt = "#,##0";
    row.getCell(11).numFmt = "0.00";

    // Alignment
    row.getCell(6).alignment = { horizontal: "center" };
    row.getCell(7).alignment = { horizontal: "center" };
    row.getCell(8).alignment = { horizontal: "right" };
    row.getCell(9).alignment = { horizontal: "right" };
    row.getCell(10).alignment = { horizontal: "right" };
    row.getCell(11).alignment = { horizontal: "right" };

    // Color coding for laba
    if (totalLaba > 0) {
      row.getCell(10).font = { color: { argb: "FF388E3C" }, bold: true };
    } else if (totalLaba < 0) {
      row.getCell(10).font = { color: { argb: "FFD32F2F" }, bold: true };
    }

    // Borders
    for (let i = 1; i <= 11; i++) {
      row.getCell(i).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }

    grandTotalPenjualan += totalHarga;
    grandTotalModal += totalModal;
    grandTotalLaba += totalLaba;
    grandTotalDus += totalDus;
    grandTotalPcs += totalPcs;

    currentRow++;
  });

  // Grand total row
  const totalRow = worksheet.getRow(currentRow);
  worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
  totalRow.getCell(1).value = "TOTAL";
  totalRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(6).value = grandTotalDus;
  totalRow.getCell(7).value = grandTotalPcs;
  totalRow.getCell(8).value = grandTotalPenjualan;
  totalRow.getCell(9).value = grandTotalModal;
  totalRow.getCell(10).value = grandTotalLaba;
  totalRow.getCell(11).value =
    grandTotalPenjualan > 0 ? (grandTotalLaba / grandTotalPenjualan) * 100 : 0;

  totalRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  // Limit fill to the data columns only (A-K)
  for (let i = 1; i <= 11; i++) {
    totalRow.getCell(i).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF388E3C" },
    };
  }
  totalRow.height = 25;

  totalRow.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(8).alignment = { horizontal: "right", vertical: "middle" };
  totalRow.getCell(9).alignment = { horizontal: "right", vertical: "middle" };
  totalRow.getCell(10).alignment = { horizontal: "right", vertical: "middle" };
  totalRow.getCell(11).alignment = { horizontal: "right", vertical: "middle" };

  totalRow.getCell(8).numFmt = "#,##0";
  totalRow.getCell(9).numFmt = "#,##0";
  totalRow.getCell(10).numFmt = "#,##0";
  totalRow.getCell(11).numFmt = "0.00";

  for (let i = 1; i <= 11; i++) {
    totalRow.getCell(i).border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  }
}

// ====================================
// LAPORAN PEMBAYARAN PENJUALAN
// ====================================
async function generateLaporanPembayaranPenjualan(
  workbook: ExcelJS.Workbook,
  dateFilter: any,
  startDate: string | null,
  endDate: string | null
) {
  const worksheet = workbook.addWorksheet("Pembayaran Penjualan");

  const where: any = {
    penjualan: {
      statusTransaksi: "SELESAI",
      isDeleted: false,
    },
  };

  if (Object.keys(dateFilter).length > 0) {
    where.tanggalBayar = dateFilter;
  }

  const pembayaranList = await prisma.pembayaranPenjualan.findMany({
    where,
    orderBy: { tanggalBayar: "desc" },
    include: {
      penjualan: {
        include: {
          customer: true,
          karyawan: true,
        },
      },
    },
  });

  const userIds = Array.from(
    new Set(
      pembayaranList
        .map((pembayaran) => pembayaran.userId)
        .filter((userId): userId is number => Number.isFinite(userId as number))
    )
  );
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true },
      })
    : [];
  const userNameById = new Map<number, string>(
    users.map((user) => [user.id, user.username])
  );

  // Title
  worksheet.mergeCells("A1:L1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "LAPORAN PEMBAYARAN PENJUALAN";
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
    startDate || undefined,
    endDate || undefined
  )}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  // Total pembayaran
  worksheet.mergeCells("A3:L3");
  const totalCell = worksheet.getCell("A3");
  totalCell.value = `Total Pembayaran: ${pembayaranList.length}`;
  totalCell.font = { bold: true };
  totalCell.alignment = { horizontal: "center" };

  const headers = [
    "No",
    "Kode Pembayaran",
    "Tanggal Bayar",
    "Kode Penjualan",
    "Customer",
    "Metode",
    "Jenis",
    "Nominal",
    "Total Cash",
    "Total Transfer",
    "Catatan",
    "Kasir",
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

  worksheet.getColumn(1).width = 5;
  worksheet.getColumn(2).width = 20;
  worksheet.getColumn(3).width = 18;
  worksheet.getColumn(4).width = 18;
  worksheet.getColumn(5).width = 22;
  worksheet.getColumn(6).width = 14;
  worksheet.getColumn(7).width = 14;
  worksheet.getColumn(8).width = 16;
  worksheet.getColumn(9).width = 16;
  worksheet.getColumn(10).width = 16;
  worksheet.getColumn(11).width = 24;
  worksheet.getColumn(12).width = 18;

  let currentRow = 6;
  let totalNominal = 0;
  let totalCash = 0;
  let totalTransfer = 0;

  pembayaranList.forEach((pembayaran, index) => {
    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = pembayaran.kodePembayaran;
    row.getCell(3).value = new Date(
      pembayaran.tanggalBayar
    ).toLocaleDateString("id-ID");
    row.getCell(4).value = pembayaran.penjualan?.kodePenjualan || "-";
    row.getCell(5).value =
      pembayaran.penjualan?.customer?.nama ||
      pembayaran.penjualan?.namaCustomer ||
      "-";
    row.getCell(6).value = pembayaran.metode || "-";
    row.getCell(7).value = pembayaran.jenisPembayaran || "-";
    row.getCell(8).value = toNumber(pembayaran.nominal);
    row.getCell(9).value = toNumber(pembayaran.totalCash);
    row.getCell(10).value = toNumber(pembayaran.totalTransfer);
    row.getCell(11).value = pembayaran.catatan || "-";
    row.getCell(12).value = pembayaran.userId
      ? userNameById.get(pembayaran.userId) || "-"
      : "-";

    row.getCell(8).numFmt = "#,##0";
    row.getCell(9).numFmt = "#,##0";
    row.getCell(10).numFmt = "#,##0";

    for (let i = 1; i <= 12; i++) {
      row.getCell(i).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }

    totalNominal += toNumber(pembayaran.nominal);
    totalCash += toNumber(pembayaran.totalCash);
    totalTransfer += toNumber(pembayaran.totalTransfer);
    currentRow++;
  });

  const totalRow = worksheet.getRow(currentRow);
  totalRow.getCell(1).value = "TOTAL";
  totalRow.getCell(8).value = totalNominal;
  totalRow.getCell(9).value = totalCash;
  totalRow.getCell(10).value = totalTransfer;
  totalRow.getCell(8).numFmt = "#,##0";
  totalRow.getCell(9).numFmt = "#,##0";
  totalRow.getCell(10).numFmt = "#,##0";
  totalRow.font = { bold: true };
  for (let i = 1; i <= 12; i++) {
    totalRow.getCell(i).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF59D" },
    };
    totalRow.getCell(i).border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  }
}

// ====================================
// LAPORAN PEMBELIAN
// ====================================
async function generateLaporanPembelian(
  workbook: ExcelJS.Workbook,
  dateFilter: any,
  startDate: string | null,
  endDate: string | null
) {
  const worksheet = workbook.addWorksheet("Laporan Pembelian");

  const where: any = {};

  if (Object.keys(dateFilter).length > 0) {
    where.createdAt = dateFilter;
  }

  const pembelianList = await prisma.pembelianHeader.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      supplier: true,
      items: {
        include: {
          barang: true,
        },
      },
    },
  });

  // Title
  worksheet.mergeCells("A1:G1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "LAPORAN PEMBELIAN";
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2196F3" },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  // Periode
  worksheet.mergeCells("A2:G2");
  const periodeCell = worksheet.getCell("A2");
  periodeCell.value = `Periode: ${formatDateRange(
    startDate || undefined,
    endDate || undefined
  )}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  worksheet.getRow(3).height = 5;

  // Headers
  const headers = [
    "No",
    "Kode",
    "Tanggal",
    "Supplier",
    "Kemasan",
    "Pembelian",
    "Diskon",
  ];
  const headerRow = worksheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF424242" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 20;

  // Column widths
  worksheet.getColumn(1).width = 5;
  worksheet.getColumn(2).width = 18;
  worksheet.getColumn(3).width = 12;
  worksheet.getColumn(4).width = 25;
  worksheet.getColumn(5).width = 8;
  worksheet.getColumn(6).width = 15;
  worksheet.getColumn(7).width = 15;

  // Data rows
  let currentRow = 5;
  let grandTotalPembelian = 0;
  let grandTotalDiskon = 0;
  let grandTotalDus = 0;

  pembelianList.forEach((pembelian, index) => {
    const totalHarga = toNumber(pembelian.totalHarga);
    let totalDiskon = 0;
    let totalDus = 0;

    pembelian.items.forEach((item) => {
      const diskonPerItem = toNumber(item.diskonPerItem);
      const jumlahPerKemasan = Math.max(
        1,
        toNumber(item.barang.jumlahPerKemasan)
      );
      const totalItem = toNumber(item.totalItem);
      const { jumlahDus } = deriveDusPcsFromTotal(totalItem, jumlahPerKemasan);

      totalDiskon += diskonPerItem * jumlahDus;
      totalDus += jumlahDus;
    });

    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = pembelian.kodePembelian;
    row.getCell(3).value = new Date(pembelian.createdAt).toLocaleDateString(
      "id-ID"
    );
    row.getCell(4).value = pembelian.supplier?.namaSupplier || "-";
    row.getCell(5).value = totalDus;
    row.getCell(6).value = totalHarga;
    row.getCell(7).value = totalDiskon;

    // Format
    row.getCell(6).numFmt = "#,##0";
    row.getCell(7).numFmt = "#,##0";

    // Alignment
    row.getCell(5).alignment = { horizontal: "center" };
    row.getCell(6).alignment = { horizontal: "right" };
    row.getCell(7).alignment = { horizontal: "right" };

    // Borders
    for (let i = 1; i <= 7; i++) {
      row.getCell(i).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }

    grandTotalPembelian += totalHarga;
    grandTotalDiskon += totalDiskon;
    grandTotalDus += totalDus;

    currentRow++;
  });

  // Grand total row
  const totalRow = worksheet.getRow(currentRow);
  worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
  totalRow.getCell(1).value = "TOTAL";
  totalRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(5).value = grandTotalDus;
  totalRow.getCell(6).value = grandTotalPembelian;
  totalRow.getCell(7).value = grandTotalDiskon;

  totalRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  // Limit fill to columns A-G only
  for (let i = 1; i <= 7; i++) {
    totalRow.getCell(i).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF388E3C" },
    };
  }
  totalRow.height = 25;

  totalRow.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(6).alignment = { horizontal: "right", vertical: "middle" };
  totalRow.getCell(7).alignment = { horizontal: "right", vertical: "middle" };

  totalRow.getCell(6).numFmt = "#,##0";
  totalRow.getCell(7).numFmt = "#,##0";

  for (let i = 1; i <= 7; i++) {
    totalRow.getCell(i).border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  }
}

// ====================================
// LAPORAN PENGELUARAN
// ====================================
async function generateLaporanPengeluaran(
  workbook: ExcelJS.Workbook,
  dateFilter: any,
  startDate: string | null,
  endDate: string | null
) {
  const worksheet = workbook.addWorksheet("Laporan Pengeluaran");

  const where: any = {};

  if (Object.keys(dateFilter).length > 0) {
    where.tanggalInput = dateFilter;
  }

  const pengeluaranList = await prisma.pengeluaran.findMany({
    where,
    orderBy: { tanggalInput: "desc" },
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  // Title
  worksheet.mergeCells("A1:G1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "LAPORAN PENGELUARAN";
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2196F3" },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  // Periode
  worksheet.mergeCells("A2:G2");
  const periodeCell = worksheet.getCell("A2");
  periodeCell.value = `Periode: ${formatDateRange(
    startDate || undefined,
    endDate || undefined
  )}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  worksheet.getRow(3).height = 5;

  // Headers - UPDATED ORDER: No, Tanggal, Nama Pengeluaran, Keterangan, Input By, Jumlah
  const headers = [
    "No",
    "Tanggal",
    "Nama Pengeluaran",
    "Jenis Pengeluaran",
    "Keterangan",
    "Input By",
    "Jumlah",
  ];
  const headerRow = worksheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF424242" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 20;

  // Column widths
  worksheet.getColumn(1).width = 5; // No
  worksheet.getColumn(2).width = 12; // Tanggal
  worksheet.getColumn(3).width = 25; // Nama Pengeluaran
  worksheet.getColumn(4).width = 18; // Jenis Pengeluaran
  worksheet.getColumn(5).width = 35; // Keterangan
  worksheet.getColumn(6).width = 25; // Input By
  worksheet.getColumn(7).width = 15; // Jumlah

  // Data rows
  let currentRow = 5;
  let grandTotal = 0;

  pengeluaranList.forEach((pengeluaran, index) => {
    const jumlah = toNumber(pengeluaran.jumlah);
    grandTotal += jumlah;

    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = index + 1; // No
    row.getCell(2).value = new Date(
      pengeluaran.tanggalInput
    ).toLocaleDateString("id-ID"); // Tanggal
    row.getCell(3).value = pengeluaran.namaPengeluaran; // Nama Pengeluaran
    row.getCell(4).value = pengeluaran.jenisPengeluaran; // Jenis Pengeluaran
    row.getCell(5).value = pengeluaran.keterangan || "-"; // Keterangan
    row.getCell(6).value = pengeluaran.user?.email || "-"; // Input By
    row.getCell(7).value = jumlah; // Jumlah

    // Format
    row.getCell(7).numFmt = "#,##0";
    row.getCell(7).alignment = { horizontal: "right" };

    // Borders
    for (let i = 1; i <= 7; i++) {
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
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  totalRow.getCell(1).value = "TOTAL";
  totalRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(7).value = grandTotal;

  totalRow.height = 25;

  // Apply formatting only to columns 1-7 (A-G)
  for (let i = 1; i <= 7; i++) {
    const cell = totalRow.getCell(i);

    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF388E3C" },
    };
    cell.border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  }

  // Clear formatting for columns beyond G (8 onwards) to prevent green bleeding
  for (let i = 8; i <= 50; i++) {
    const cell = totalRow.getCell(i);
    cell.style = {};
  }

  totalRow.getCell(7).alignment = { horizontal: "right", vertical: "middle" };
  totalRow.getCell(7).numFmt = "#,##0";
}

// ====================================
// RINGKASAN
// ====================================
async function generateRingkasan(
  workbook: ExcelJS.Workbook,
  dateFilter: any,
  startDate: string | null,
  endDate: string | null
) {
  const worksheet = workbook.addWorksheet("Ringkasan");

  // Title
  worksheet.mergeCells("A1:D1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "RINGKASAN LAPORAN KEUANGAN";
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2196F3" },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  // Periode
  worksheet.mergeCells("A2:D2");
  const periodeCell = worksheet.getCell("A2");
  periodeCell.value = `Periode: ${formatDateRange(
    startDate || undefined,
    endDate || undefined
  )}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  worksheet.getRow(3).height = 5;

  // Fetch data for summary
  const wherePenjualan: any = { statusTransaksi: "SELESAI", isDeleted: false };
  const wherePengeluaran: any = {};
  const wherePengembalian: any = {
    kondisiBarang: { in: ["RUSAK", "KADALUARSA"] },
  };

  if (Object.keys(dateFilter).length > 0) {
    wherePenjualan.tanggalTransaksi = dateFilter;
    wherePengeluaran.tanggalInput = dateFilter;
    wherePengembalian.tanggalPengembalian = dateFilter;
  }

  const penjualanList = await prisma.penjualanHeader.findMany({
    where: wherePenjualan,
    include: {
      items: {
        include: {
          barang: true,
        },
      },
    },
  });

  const pengeluaranList = await prisma.pengeluaran.findMany({
    where: wherePengeluaran,
  });

  const pengembalianList = await prisma.pengembalianBarang.findMany({
    where: wherePengembalian,
    include: {
      barang: {
        select: {
          hargaBeli: true,
          jumlahPerKemasan: true,
        },
      },
    },
  });

  // Calculate totals
  let totalPenjualan = 0;
  let totalModalPenjualan = 0;
  let totalLabaPenjualan = 0;

  penjualanList.forEach((penjualan) => {
    totalPenjualan += toNumber(penjualan.totalHarga);

    penjualan.items.forEach((item) => {
      const hargaBeli = toNumber(item.hargaBeli);
      const laba = toNumber(item.laba);
      const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
      const totalItem = getTotalItemPcs(item, jumlahPerKemasan);
      const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
        totalItem,
        jumlahPerKemasan
      );

      const modalDus = hargaBeli * jumlahDus;
      const modalPcs =
        jumlahPcs > 0 && jumlahPerKemasan > 0
          ? Math.round((hargaBeli / jumlahPerKemasan) * jumlahPcs)
          : 0;

      totalModalPenjualan += modalDus + modalPcs;
      totalLabaPenjualan += laba;
    });
  });

  const totalPengembalianRusak = pengembalianList.reduce((sum, item) => {
    const jumlahDus = toNumber(item.jumlahDus);
    const jumlahPcs = toNumber(item.jumlahPcs);
    const hargaBeli = toNumber(item.barang?.hargaBeli);
    const perKemasan = toNumber(item.barang?.jumlahPerKemasan);

    const modalDus = hargaBeli * jumlahDus;
    const modalPcs =
      jumlahPcs > 0 && perKemasan > 0
        ? Math.round((hargaBeli / perKemasan) * jumlahPcs)
        : 0;

    return sum + modalDus + modalPcs;
  }, 0);

  const totalPengeluaran = pengeluaranList.reduce(
    (sum, p) => sum + toNumber(p.jumlah),
    0
  );

  const labaKotor = totalLabaPenjualan;
  const labaBersih = labaKotor - totalPengeluaran - totalPengembalianRusak;
  const marginRataRata =
    totalPenjualan > 0 ? (labaKotor / totalPenjualan) * 100 : 0;

  // Headers
  const headers = ["Kategori", "Jumlah Transaksi", "Total (Rp)", "Keterangan"];
  const headerRow = worksheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF424242" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 20;

  // Column widths
  worksheet.getColumn(1).width = 25;
  worksheet.getColumn(2).width = 18;
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 45;

  // Data
  const summaryData = [
    {
      kategori: "Penjualan",
      jumlah: penjualanList.length,
      total: totalPenjualan,
      keterangan: "Total pendapatan dari penjualan",
      color: "FF4CAF50",
      isBold: false,
    },
    {
      kategori: "Modal Penjualan",
      jumlah: "-",
      total: totalModalPenjualan,
      keterangan: "Total modal barang yang terjual",
      color: "FFFF9800",
      isBold: false,
    },
    {
      kategori: "Laba Kotor",
      jumlah: "-",
      total: labaKotor,
      keterangan: `Penjualan - Modal (Margin: ${marginRataRata.toFixed(2)}%)`,
      color: labaKotor >= 0 ? "FFFFFFFF" : "FFD32F2F",
      textColor: labaKotor >= 0 ? "FF000000" : "FFFFFFFF",
      isBold: true,
    },
    {
      kategori: "Pengembalian Rusak",
      jumlah: pengembalianList.length,
      total: totalPengembalianRusak,
      keterangan: "Total harga beli barang rusak & kadaluarsa",
      color: "FF2196F3",
      isBold: false,
    },
    {
      kategori: "Pengeluaran Operasional",
      jumlah: pengeluaranList.length,
      total: totalPengeluaran,
      keterangan: "Total pengeluaran operasional",
      color: "FF388E3C",
      isBold: false,
    },
    {
      kategori: "Laba Bersih",
      jumlah: "-",
      total: labaBersih,
      keterangan: "Laba Kotor - Pengeluaran - Pengembalian Rusak",
      color: "FF388E3C",
      isBold: true,
    },
  ];

  let currentRow = 5;
  summaryData.forEach((data) => {
    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = data.kategori;
    row.getCell(2).value = data.jumlah;
    row.getCell(3).value = data.total;
    row.getCell(4).value = data.keterangan;

    // Format
    row.getCell(2).alignment = { horizontal: "center" };
    row.getCell(3).alignment = { horizontal: "right" };
    row.getCell(3).numFmt = "#,##0";

    // Highlight special rows (only columns A-D)
    if (data.isBold) {
      row.height = 25;

      // Apply formatting only to columns 1-4 (A-D)
      for (let i = 1; i <= 4; i++) {
        const cell = row.getCell(i);
        cell.font = {
          bold: true,
          color: { argb: data.textColor || "FFFFFFFF" },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: data.color },
        };
      }

      // Clear formatting for columns beyond D (5 onwards)
      for (let i = 5; i <= 50; i++) {
        const cell = row.getCell(i);
        cell.style = {};
      }
    }

    // Borders
    for (let i = 1; i <= 4; i++) {
      row.getCell(i).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }

    currentRow++;
  });

  // Add spacing
  currentRow += 2;

  // Additional info
  const infoRow = worksheet.getRow(currentRow);
  worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
  infoRow.getCell(1).value =
    "Catatan: Laba Bersih = (Penjualan - Modal Penjualan) - Pengeluaran Operasional - Pengembalian Barang Rusak";
  infoRow.getCell(1).font = { italic: true, size: 10 };
  infoRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  infoRow.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF5F5F5" },
  };
  infoRow.height = 20;
}

// ====================================
// LAPORAN PENJUALAN DETAIL
// ====================================
async function generateLaporanPenjualanDetail(
  workbook: ExcelJS.Workbook,
  dateFilter: any,
  startDate: string | null,
  endDate: string | null
) {
  const worksheet = workbook.addWorksheet("Laporan Penjualan Detail");

  const where: any = {
    statusTransaksi: "SELESAI",
    isDeleted: false,
  };

  if (Object.keys(dateFilter).length > 0) {
    where.tanggalTransaksi = dateFilter;
  }

  const penjualanList = await prisma.penjualanHeader.findMany({
    where,
    orderBy: { tanggalTransaksi: "desc" },
    include: {
      customer: true,
      karyawan: true,
      perjalananSales: {
        select: {
          karyawan: {
            select: {
              id: true,
              nama: true,
              nik: true,
            },
          },
        },
      },
      items: {
        include: {
          barang: true,
        },
      },
    },
  });
  const userNameById = await buildUserNameMap(penjualanList);

  // Title
  worksheet.mergeCells("A1:O1");
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
  worksheet.mergeCells("A2:O2");
  const periodeCell = worksheet.getCell("A2");
  periodeCell.value = `Periode: ${formatDateRange(
    startDate || undefined,
    endDate || undefined
  )}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  worksheet.getRow(3).height = 5;

  // Headers
  const headers = [
    "No",
    "Kode Penjualan",
    "Tanggal",
    "Status Penjualan",
    "Metode Pembayaran",
    "PIC Penjualan",
    "Customer",
    "Nama Barang",
    "Berat (kg)",
    "Qty Kemasan",
    "Qty Item",
    "Harga Jual",
    "Modal",
    "Laba",
    "Margin %",
  ];
  const headerRow = worksheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF424242" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 20;

  // Column widths
  worksheet.getColumn(1).width = 5;
  worksheet.getColumn(2).width = 18;
  worksheet.getColumn(3).width = 12;
  worksheet.getColumn(4).width = 16;
  worksheet.getColumn(5).width = 16;
  worksheet.getColumn(6).width = 18;
  worksheet.getColumn(7).width = 20;
  worksheet.getColumn(8).width = 25;
  worksheet.getColumn(9).width = 10;
  worksheet.getColumn(10).width = 8;
  worksheet.getColumn(11).width = 8;
  worksheet.getColumn(12).width = 15;
  worksheet.getColumn(13).width = 15;
  worksheet.getColumn(14).width = 15;
  worksheet.getColumn(15).width = 10;

  let currentRow = 5;
  let itemNumber = 1;
  let grandTotalPenjualan = 0;
  let grandTotalModal = 0;
  let grandTotalLaba = 0;

  penjualanList.forEach((penjualan) => {
    const customerName = penjualan.customer?.nama || "-";
    const tanggal = new Date(penjualan.tanggalTransaksi).toLocaleDateString(
      "id-ID"
    );

    penjualan.items.forEach((item) => {
      const hargaBeli = toNumber(item.hargaBeli);
      const hargaJual = toNumber(item.hargaJual);
      const laba = toNumber(item.laba);
      const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
      const totalItem = getTotalItemPcs(item, jumlahPerKemasan);
      const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
        totalItem,
        jumlahPerKemasan
      );

      const modalDus = hargaBeli * jumlahDus;
      const modalPcs =
        jumlahPcs > 0 && jumlahPerKemasan > 0
          ? Math.round((hargaBeli / jumlahPerKemasan) * jumlahPcs)
          : 0;
      const totalModal = modalDus + modalPcs;

      const hargaJualDus = hargaJual * jumlahDus;
      const hargaJualPcs =
        jumlahPcs > 0 && jumlahPerKemasan > 0
          ? Math.round((hargaJual / jumlahPerKemasan) * jumlahPcs)
          : 0;
      const totalHargaJual = hargaJualDus + hargaJualPcs;

      const margin = totalHargaJual > 0 ? (laba / totalHargaJual) * 100 : 0;

      const row = worksheet.getRow(currentRow);
      row.getCell(1).value = itemNumber;
      row.getCell(2).value = penjualan.kodePenjualan;
      row.getCell(3).value = tanggal;
      row.getCell(4).value = getDijualOleh(penjualan);
      row.getCell(5).value = penjualan.metodePembayaran || "-";
      row.getCell(6).value = getPicPenjualan(penjualan, userNameById);
      row.getCell(7).value = customerName;
      row.getCell(8).value = item.barang.namaBarang;
      row.getCell(9).value = formatKgDisplay(item.barang.berat);
      row.getCell(10).value = `${jumlahDus} ${
        item.barang.jenisKemasan || "kemasan"
      }`;
      row.getCell(11).value = `${jumlahPcs} item`;
      row.getCell(12).value = totalHargaJual;
      row.getCell(13).value = totalModal;
      row.getCell(14).value = laba;
      row.getCell(15).value = margin;

      // Format
      row.getCell(9).alignment = { horizontal: "right" };
      row.getCell(10).alignment = { horizontal: "center" };
      row.getCell(11).alignment = { horizontal: "center" };
      row.getCell(12).alignment = { horizontal: "right" };
      row.getCell(13).alignment = { horizontal: "right" };
      row.getCell(14).alignment = { horizontal: "right" };
      row.getCell(15).alignment = { horizontal: "right" };

      row.getCell(12).numFmt = "#,##0";
      row.getCell(13).numFmt = "#,##0";
      row.getCell(14).numFmt = "#,##0";
      row.getCell(15).numFmt = "0.00";

      // Color coding for laba
      if (laba > 0) {
        row.getCell(14).font = { color: { argb: "FF388E3C" }, bold: true };
      } else if (laba < 0) {
        row.getCell(14).font = { color: { argb: "FFD32F2F" }, bold: true };
      }

      // Borders
      for (let i = 1; i <= 15; i++) {
        row.getCell(i).border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }

      grandTotalPenjualan += totalHargaJual;
      grandTotalModal += totalModal;
      grandTotalLaba += laba;

      currentRow++;
      itemNumber++;
    });
  });

  // Grand total row
  const totalRow = worksheet.getRow(currentRow);
  worksheet.mergeCells(`A${currentRow}:K${currentRow}`);
  totalRow.getCell(1).value = "TOTAL";
  totalRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(12).value = grandTotalPenjualan;
  totalRow.getCell(13).value = grandTotalModal;
  totalRow.getCell(14).value = grandTotalLaba;
  totalRow.getCell(15).value =
    grandTotalPenjualan > 0 ? (grandTotalLaba / grandTotalPenjualan) * 100 : 0;

  totalRow.height = 25;

  // Apply formatting only to columns 1-15 (A-O)
  for (let i = 1; i <= 15; i++) {
    const cell = totalRow.getCell(i);

    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF388E3C" },
    };
    cell.border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  }

  // Clear formatting for columns beyond O (16 onwards) to prevent green bleeding
  for (let i = 16; i <= 50; i++) {
    const cell = totalRow.getCell(i);
    cell.style = {};
  }

  totalRow.getCell(12).alignment = { horizontal: "right", vertical: "middle" };
  totalRow.getCell(13).alignment = { horizontal: "right", vertical: "middle" };
  totalRow.getCell(14).alignment = { horizontal: "right", vertical: "middle" };
  totalRow.getCell(15).alignment = { horizontal: "right", vertical: "middle" };

  totalRow.getCell(12).numFmt = "#,##0";
  totalRow.getCell(13).numFmt = "#,##0";
  totalRow.getCell(14).numFmt = "#,##0";
  totalRow.getCell(15).numFmt = "0.00";
}

// ====================================
// LAPORAN PEMBELIAN DETAIL
// ====================================
async function generateLaporanPembelianDetail(
  workbook: ExcelJS.Workbook,
  dateFilter: any,
  startDate: string | null,
  endDate: string | null
) {
  const worksheet = workbook.addWorksheet("Laporan Pembelian Detail");

  const where: any = {};

  if (Object.keys(dateFilter).length > 0) {
    where.createdAt = dateFilter;
  }

  const pembelianList = await prisma.pembelianHeader.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      supplier: true,
      items: {
        include: {
          barang: true,
        },
      },
    },
  });

  // Title
  worksheet.mergeCells("A1:J1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "LAPORAN PEMBELIAN DETAIL";
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2196F3" },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  // Periode
  worksheet.mergeCells("A2:J2");
  const periodeCell = worksheet.getCell("A2");
  periodeCell.value = `Periode: ${formatDateRange(
    startDate || undefined,
    endDate || undefined
  )}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  worksheet.getRow(3).height = 5;

  // Headers - FIXED: menggunakan hargaPokok bukan hargaPerDus
  const headers = [
    "No",
    "Kode Pembelian",
    "Tanggal",
    "Supplier",
    "Nama Barang",
    "Berat (kg)",
    "QTY Kemasan",
    "Harga Pokok",
    "Diskon",
    "Total",
  ];
  const headerRow = worksheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF424242" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 20;

  // Column widths
  worksheet.getColumn(1).width = 5;
  worksheet.getColumn(2).width = 18;
  worksheet.getColumn(3).width = 12;
  worksheet.getColumn(4).width = 20;
  worksheet.getColumn(5).width = 25;
  worksheet.getColumn(6).width = 10;
  worksheet.getColumn(7).width = 8;
  worksheet.getColumn(8).width = 15;
  worksheet.getColumn(9).width = 15;
  worksheet.getColumn(10).width = 15;

  let currentRow = 5;
  let itemNumber = 1;
  let grandTotal = 0;
  let grandTotalDiskon = 0;

  pembelianList.forEach((pembelian) => {
    const supplierName = pembelian.supplier?.namaSupplier || "-";
    const tanggal = new Date(pembelian.createdAt).toLocaleDateString("id-ID");

    pembelian.items.forEach((item) => {
      const jumlahPerKemasan = Math.max(
        1,
        toNumber(item.barang.jumlahPerKemasan)
      );
      const totalItem = toNumber(item.totalItem);
      const { jumlahDus } = deriveDusPcsFromTotal(totalItem, jumlahPerKemasan);
      const hargaPokok = toNumber(item.hargaPokok); // FIXED: menggunakan hargaPokok
      const diskonPerItem = toNumber(item.diskonPerItem);
      const labelKemasan = item.barang.jenisKemasan || "kemasan";

      const totalHarga = (hargaPokok - diskonPerItem) * jumlahDus;
      const totalDiskon = diskonPerItem * jumlahDus;

      const row = worksheet.getRow(currentRow);
      row.getCell(1).value = itemNumber;
      row.getCell(2).value = pembelian.kodePembelian;
      row.getCell(3).value = tanggal;
      row.getCell(4).value = supplierName;
      row.getCell(5).value = item.barang.namaBarang;
      row.getCell(6).value = formatKgDisplay(item.barang.berat);
      row.getCell(7).value = `${jumlahDus} ${labelKemasan}`;
      row.getCell(8).value = hargaPokok;
      row.getCell(9).value = diskonPerItem;
      row.getCell(10).value = totalHarga;

      // Format
      row.getCell(6).alignment = { horizontal: "right" };
      row.getCell(7).alignment = { horizontal: "center" };
      row.getCell(8).alignment = { horizontal: "right" };
      row.getCell(9).alignment = { horizontal: "right" };
      row.getCell(10).alignment = { horizontal: "right" };

      row.getCell(8).numFmt = "#,##0";
      row.getCell(9).numFmt = "#,##0";
      row.getCell(10).numFmt = "#,##0";

      // Borders
      for (let i = 1; i <= 10; i++) {
        row.getCell(i).border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }

      grandTotal += totalHarga;
      grandTotalDiskon += totalDiskon;

      currentRow++;
      itemNumber++;
    });
  });

  // Grand total row
  const totalRow = worksheet.getRow(currentRow);
  worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
  totalRow.getCell(1).value = "TOTAL";
  totalRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(9).value = grandTotalDiskon;
  totalRow.getCell(10).value = grandTotal;

  totalRow.height = 25;

  // Apply formatting only to columns 1-10 (A-J)
  for (let i = 1; i <= 10; i++) {
    const cell = totalRow.getCell(i);

    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF388E3C" },
    };
    cell.border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  }

  // Clear formatting for columns beyond J (11 onwards) to prevent green bleeding
  for (let i = 11; i <= 50; i++) {
    const cell = totalRow.getCell(i);
    cell.style = {};
  }

  totalRow.getCell(9).alignment = { horizontal: "right", vertical: "middle" };
  totalRow.getCell(10).alignment = { horizontal: "right", vertical: "middle" };

  totalRow.getCell(9).numFmt = "#,##0";
  totalRow.getCell(10).numFmt = "#,##0";
}

// ====================================
// LABA PER BARANG
// ====================================
async function generateLaporanLabaBarang(
  workbook: ExcelJS.Workbook,
  dateFilter: any,
  startDate: string | null,
  endDate: string | null
) {
  const worksheet = workbook.addWorksheet("Laba Per Barang");

  const penjualanFilter: any = {
    statusTransaksi: "SELESAI",
    isDeleted: false,
  };

  if (Object.keys(dateFilter).length > 0) {
    penjualanFilter.tanggalTransaksi = dateFilter;
  }

  const items = await prisma.penjualanItem.findMany({
    where: {
      penjualan: penjualanFilter,
    },
    include: {
      barang: {
        select: {
          id: true,
          namaBarang: true,
          jumlahPerKemasan: true,
          jenisKemasan: true,
        },
      },
    },
  });

  const barangMap = new Map<
    number,
    {
      barangId: number;
      namaBarang: string;
      jumlahPerKemasan: number;
      jenisKemasan: string;
      totalKemasan: number;
      totalItem: number;
      totalModal: number;
      totalPenjualan: number;
      totalLaba: number;
    }
  >();

  for (const item of items) {
    const jumlahPerKemasan = Math.max(
      1,
      toNumber(item.barang.jumlahPerKemasan)
    );
    const totalItemTerjual = toNumber(item.totalItem);
    const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
      totalItemTerjual,
      jumlahPerKemasan
    );
    const hargaJual = toNumber(item.hargaJual);
    const hargaBeli = toNumber(item.hargaBeli);

    const modalDus = hargaBeli * jumlahDus;
    const modalPcs =
      jumlahPcs > 0
        ? Math.round((hargaBeli / jumlahPerKemasan) * jumlahPcs)
        : 0;
    const totalModalItem = modalDus + modalPcs;

    const penjualanDus = hargaJual * jumlahDus;
    const penjualanPcs =
      jumlahPcs > 0
        ? Math.round((hargaJual / jumlahPerKemasan) * jumlahPcs)
        : 0;
    const totalPenjualanItem = penjualanDus + penjualanPcs;

    const labaItem =
      typeof item.laba === "bigint" || typeof item.laba === "number"
        ? toNumber(item.laba)
        : totalPenjualanItem - totalModalItem;

    const totalKemasanTerjual = totalItemTerjual / jumlahPerKemasan;

    if (!barangMap.has(item.barangId)) {
      barangMap.set(item.barangId, {
        barangId: item.barangId,
        namaBarang: item.barang.namaBarang,
        jumlahPerKemasan,
        jenisKemasan: item.barang.jenisKemasan,
        totalKemasan: 0,
        totalItem: 0,
        totalModal: 0,
        totalPenjualan: 0,
        totalLaba: 0,
      });
    }

    const agg = barangMap.get(item.barangId)!;
    agg.totalKemasan += totalKemasanTerjual;
    agg.totalItem += totalItemTerjual;
    agg.totalModal += totalModalItem;
    agg.totalPenjualan += totalPenjualanItem;
    agg.totalLaba += labaItem;
  }

  const rows = Array.from(barangMap.values()).sort(
    (a, b) => b.totalLaba - a.totalLaba
  );

  // Title
  worksheet.mergeCells("A1:I1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "LAPORAN LABA PER BARANG";
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2196F3" },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  // Periode
  worksheet.mergeCells("A2:I2");
  const periodeCell = worksheet.getCell("A2");
  periodeCell.value = `Periode: ${formatDateRange(
    startDate || undefined,
    endDate || undefined
  )}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  worksheet.getRow(3).height = 5;

  const headers = [
    "No",
    "Barang",
    "Kemasan",
    "Qty Kemasan",
    "Qty Item",
    "Penjualan",
    "Modal",
    "Laba",
    "Margin %",
  ];
  const headerRow = worksheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF424242" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 20;

  worksheet.columns = [
    { key: "no", width: 5 },
    { key: "barang", width: 32 },
    { key: "kemasan", width: 22 },
    { key: "qtyKemasan", width: 14 },
    { key: "qtyItem", width: 14 },
    { key: "penjualan", width: 16 },
    { key: "modal", width: 16 },
    { key: "laba", width: 16 },
    { key: "margin", width: 12 },
  ];

  let rowIndex = 5;
  let totalModal = 0;
  let totalPenjualan = 0;
  let totalLaba = 0;
  let totalItem = 0;
  let totalKemasan = 0;

  rows.forEach((row, idx) => {
    const margin = row.totalPenjualan
      ? (row.totalLaba / row.totalPenjualan) * 100
      : 0;

    const excelRow = worksheet.getRow(rowIndex);
    excelRow.getCell("A").value = idx + 1;
    excelRow.getCell("B").value = row.namaBarang;
    excelRow.getCell(
      "C"
    ).value = `${row.jumlahPerKemasan} item/${row.jenisKemasan}`;
    excelRow.getCell("D").value = row.totalKemasan;
    excelRow.getCell("E").value = row.totalItem;
    excelRow.getCell("F").value = row.totalPenjualan;
    excelRow.getCell("G").value = row.totalModal;
    excelRow.getCell("H").value = row.totalLaba;
    excelRow.getCell("I").value = margin;

    ["D", "E", "F", "G", "H", "I"].forEach((key) => {
      const cell = excelRow.getCell(key);
      cell.alignment = { horizontal: "right" };
      cell.numFmt = key === "I" ? "0.00" : "#,##0";
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    ["A", "B", "C"].forEach((key) => {
      const cell = excelRow.getCell(key);
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    totalModal += row.totalModal;
    totalPenjualan += row.totalPenjualan;
    totalLaba += row.totalLaba;
    totalItem += row.totalItem;
    totalKemasan += row.totalKemasan;
    rowIndex++;
  });

  const totalRow = worksheet.getRow(rowIndex + 1);
  totalRow.getCell("B").value = "TOTAL";
  totalRow.getCell("D").value = totalKemasan;
  totalRow.getCell("E").value = totalItem;
  totalRow.getCell("F").value = totalPenjualan;
  totalRow.getCell("G").value = totalModal;
  totalRow.getCell("H").value = totalLaba;
  totalRow.getCell("I").value = totalPenjualan
    ? (totalLaba / totalPenjualan) * 100
    : 0;

  totalRow.height = 25;
  for (let i = 1; i <= 9; i++) {
    const cell = totalRow.getCell(i);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF388E3C" },
    };
    cell.border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  }

  totalRow.getCell("B").alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  ["D", "E", "F", "G", "H", "I"].forEach((key) => {
    const cell = totalRow.getCell(key);
    cell.alignment = { horizontal: "right", vertical: "middle" };
    cell.numFmt = key === "I" ? "0.00" : "#,##0";
  });
}
