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

function toNumber(value: any): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value || 0);
}

function formatKgDisplay(grams: any): string {
  const kg = toNumber(grams) / 1000;
  if (!Number.isFinite(kg)) return "0";
  const trimmed = kg.toFixed(3).replace(/\.?0+$/, "");
  return trimmed.replace(".", ",");
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
      await generatePembayaranSheet(workbook, { startDate, endDate, search });
    } else {
      // SUMMARY REPORT (no items breakdown)
      await generateSummaryReport(worksheet, { startDate, endDate, search });
      await generatePembayaranSheet(workbook, { startDate, endDate, search });
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
  const where: any = { statusTransaksi: "SELESAI", isDeleted: false };

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
          barang: {
            select: {
              jumlahPerKemasan: true,
              berat: true,
              jenisKemasan: true,
            },
          },
        },
      },
    },
  });
  const userNameById = await buildUserNameMap(penjualanList);

  // Title
  worksheet.mergeCells("A1:P1");
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
  worksheet.mergeCells("A2:P2");
  const periodeCell = worksheet.getCell("A2");
  periodeCell.value = `Periode: ${formatDateRange(
    filters.startDate || undefined,
    filters.endDate || undefined
  )}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  // Total transaksi
  worksheet.mergeCells("A3:P3");
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
    "QTY Kemasan",
    "QTY Total Item",
    "Tipe Penjualan",
    "Metode Pembayaran",
    "PIC Penjualan",
    "Total Penjualan",
    "Modal",
    "Laba",
    "Margin %",
    "Status",
    "Total Berat (kg)",
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
  worksheet.getColumn(6).width = 14;
  worksheet.getColumn(7).width = 16;
  worksheet.getColumn(8).width = 14;
  worksheet.getColumn(9).width = 16;
  worksheet.getColumn(10).width = 18;
  worksheet.getColumn(11).width = 15;
  worksheet.getColumn(12).width = 15;
  worksheet.getColumn(13).width = 15;
  worksheet.getColumn(14).width = 10;
  worksheet.getColumn(15).width = 10;
  worksheet.getColumn(16).width = 14;

  // Data rows
  let currentRow = 6;
  let grandTotalPenjualan = 0;
  let grandTotalModal = 0;
  let grandTotalLaba = 0;
  let grandTotalKemasan = 0;
  let grandTotalPcs = 0;
  let grandTotalBeratGrams = 0;

  penjualanList.forEach((penjualan, index) => {
    const totalKemasan = penjualan.items.reduce((sum, item) => {
      const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
      const totalPcsItem = getTotalItemPcs(item, jumlahPerKemasan);
      const perKemasan = Math.max(1, jumlahPerKemasan);
      return sum + totalPcsItem / perKemasan;
    }, 0);
    const kemasanLabels = new Set(
      penjualan.items
        .map((item) => item.barang?.jenisKemasan?.toLowerCase())
        .filter((label): label is string => Boolean(label))
    );
    const kemasanLabel =
      kemasanLabels.size === 1
        ? Array.from(kemasanLabels)[0]
        : "kemasan";
    const totalPcs = penjualan.items.reduce((sum, item) => {
      const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
      return sum + getTotalItemPcs(item, jumlahPerKemasan);
    }, 0);
    const totalBeratGrams = penjualan.items.reduce((sum, item) => {
      const beratPerItem = toNumber(item.barang.berat);
      const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
      const totalPcsItem = getTotalItemPcs(item, jumlahPerKemasan);
      return sum + beratPerItem * totalPcsItem;
    }, 0);

    const totalModal = penjualan.items.reduce((sum, item) => {
      const hargaBeli = toNumber(item.hargaBeli);
      const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
      const totalPcsItem = getTotalItemPcs(item, jumlahPerKemasan);
      const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
        totalPcsItem,
        jumlahPerKemasan
      );

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
    grandTotalKemasan += totalKemasan;
    grandTotalPcs += totalPcs;
    grandTotalBeratGrams += totalBeratGrams;

    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = penjualan.kodePenjualan;
    row.getCell(3).value = getDijualOleh(penjualan);
    row.getCell(4).value = new Date(
      penjualan.tanggalTransaksi
    ).toLocaleDateString("id-ID");
    row.getCell(5).value = getCustomerOrSalesName(penjualan);

    row.getCell(6).value = `${Number(totalKemasan.toFixed(2))} ${kemasanLabel}`;
    row.getCell(7).value = `${totalPcs} item`;
    row.getCell(8).value = getCustomerType(penjualan);
    row.getCell(9).value = penjualan.metodePembayaran || "-";
    row.getCell(10).value = getPicPenjualan(penjualan, userNameById);
    row.getCell(11).value = penjualanAmount;
    row.getCell(12).value = totalModal;
    row.getCell(13).value = totalLaba;
    row.getCell(14).value = margin;
    row.getCell(15).value = penjualan.statusPembayaran;
    row.getCell(16).value = formatKgDisplay(totalBeratGrams);

    // Format
    row.getCell(11).numFmt = "#,##0";
    row.getCell(12).numFmt = "#,##0";
    row.getCell(13).numFmt = "#,##0";
    row.getCell(14).numFmt = "0.00";

    // Borders
    for (let i = 1; i <= 16; i++) {
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
  totalRow.getCell(6).value = `${Number(grandTotalKemasan.toFixed(2))} kemasan`;
  totalRow.getCell(7).value = `${grandTotalPcs} item`;
  totalRow.getCell(11).value = grandTotalPenjualan;
  totalRow.getCell(12).value = grandTotalModal;
  totalRow.getCell(13).value = grandTotalLaba;
  totalRow.getCell(14).value =
    grandTotalPenjualan > 0 ? (grandTotalLaba / grandTotalPenjualan) * 100 : 0;
  totalRow.getCell(16).value = formatKgDisplay(grandTotalBeratGrams);

  totalRow.font = { bold: true };
  // Limit highlight to data columns only
  for (let i = 1; i <= 16; i++) {
    totalRow.getCell(i).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF59D" },
    };
  }

  totalRow.getCell(11).numFmt = "#,##0";
  totalRow.getCell(12).numFmt = "#,##0";
  totalRow.getCell(13).numFmt = "#,##0";
  totalRow.getCell(14).numFmt = "0.00";

  for (let i = 1; i <= 16; i++) {
    totalRow.getCell(i).border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  }
}

async function generatePembayaranSheet(
  workbook: ExcelJS.Workbook,
  filters: {
    startDate?: string | null;
    endDate?: string | null;
    search?: string | null;
  }
) {
  const worksheet = workbook.addWorksheet("Pembayaran Penjualan");

  const where: any = {
    penjualan: {
      statusTransaksi: "SELESAI",
      isDeleted: false,
    },
  };

  if (filters.startDate || filters.endDate) {
    where.tanggalBayar = {};
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      where.tanggalBayar.gte = start;
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      where.tanggalBayar.lte = end;
    }
  }

  if (filters.search) {
    where.OR = [
      { kodePembayaran: { contains: filters.search, mode: "insensitive" } },
      {
        penjualan: {
          kodePenjualan: { contains: filters.search, mode: "insensitive" },
        },
      },
      {
        penjualan: {
          namaCustomer: { contains: filters.search, mode: "insensitive" },
        },
      },
      {
        penjualan: {
          customer: {
            nama: { contains: filters.search, mode: "insensitive" },
          },
        },
      },
    ];
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
    filters.startDate || undefined,
    filters.endDate || undefined
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
    "Pembayaran",
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
    row.getCell(3).value = new Date(pembayaran.tanggalBayar).toLocaleDateString(
      "id-ID"
    );
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
          barang: {
            select: {
              id: true,
              namaBarang: true,
              berat: true,
              jenisKemasan: true,
              jumlahPerKemasan: true,
            },
          },
        },
      },
    },
  });
  const userNameById = await buildUserNameMap(penjualanList);

  // Title
  worksheet.mergeCells("A1:T1");
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
  worksheet.mergeCells("A2:T2");
  const periodeCell = worksheet.getCell("A2");
  periodeCell.value = `Periode: ${formatDateRange(
    filters.startDate || undefined,
    filters.endDate || undefined
  )}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  // Total transaksi
  worksheet.mergeCells("A3:T3");
  const totalCell = worksheet.getCell("A3");
  totalCell.value = `Total Transaksi: ${penjualanList.length}`;
  totalCell.font = { bold: true };
  totalCell.alignment = { horizontal: "center" };

  // Column widths
  worksheet.getColumn(1).width = 5; // No
  worksheet.getColumn(2).width = 12; // Tanggal
  worksheet.getColumn(3).width = 18; // Kode Penjualan
  worksheet.getColumn(4).width = 18; // Dijual Oleh
  worksheet.getColumn(5).width = 20; // PIC Penjualan
  worksheet.getColumn(6).width = 28; // Penjualan
  worksheet.getColumn(7).width = 16; // Status Pembayaran
  worksheet.getColumn(8).width = 16; // Metode Pembayaran
  worksheet.getColumn(9).width = 14; // Kode Barang
  worksheet.getColumn(10).width = 22; // Nama Barang
  worksheet.getColumn(11).width = 12; // Berat
  worksheet.getColumn(12).width = 14; // Qty kemasan
  worksheet.getColumn(13).width = 14; // Qty total item
  worksheet.getColumn(14).width = 12; // Harga Jual
  worksheet.getColumn(15).width = 12; // Harga Beli
  worksheet.getColumn(16).width = 12; // Diskon
  worksheet.getColumn(17).width = 12; // Subtotal
  worksheet.getColumn(18).width = 12; // Modal
  worksheet.getColumn(19).width = 12; // Laba
  worksheet.getColumn(20).width = 10; // Margin %

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
      "PIC Penjualan",
      "Customer",
      "Status Pembayaran",
      "Metode Pembayaran",
      "Kode",
      "Nama Barang",
      "Berat (kg)",
      "QTY Kemasan",
      "QTY Total Item",
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
      const hargaJual = toNumber(item.hargaJual);
      const hargaBeli = toNumber(item.hargaBeli);
      const diskonPerItem = toNumber(item.diskonPerItem);
      const laba = toNumber(item.laba);
      const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);

      const totalPcs = getTotalItemPcs(item, jumlahPerKemasan);
      const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
        totalPcs,
        jumlahPerKemasan
      );
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
      row.getCell(5).value = getPicPenjualan(penjualan, userNameById);
      row.getCell(6).value = getCustomerOrSalesName(penjualan);
      row.getCell(7).value = penjualan.statusPembayaran;
      row.getCell(8).value = penjualan.metodePembayaran || "-";
      row.getCell(9).value = `BRG-${item.barang.id}`;
      row.getCell(10).value = item.barang.namaBarang;
      row.getCell(11).value = formatKgDisplay(item.barang.berat);
      row.getCell(12).value = `${jumlahDus} ${item.barang.jenisKemasan}`;
      row.getCell(13).value = `${totalPcs} item`;
      row.getCell(14).value = hargaJual;
      row.getCell(15).value = hargaBeli;
      row.getCell(16).value = totalDiskon;
      row.getCell(17).value = subtotal;
      row.getCell(18).value = totalModalItem;
      row.getCell(19).value = laba;
      row.getCell(20).value = marginItem;

      // Format
      row.getCell(14).numFmt = "#,##0";
      row.getCell(15).numFmt = "#,##0";
      row.getCell(16).numFmt = "#,##0";
      row.getCell(17).numFmt = "#,##0";
      row.getCell(18).numFmt = "#,##0";
      row.getCell(19).numFmt = "#,##0";
      row.getCell(20).numFmt = "0.00";

      // Color laba
      if (laba > 0) {
        row.getCell(19).font = { color: { argb: "FF388E3C" } };
      } else if (laba < 0) {
        row.getCell(19).font = { color: { argb: "FFD32F2F" } };
      }

      // Borders
      for (let i = 1; i <= 20; i++) {
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
      worksheet.mergeCells(`A${currentRow}:M${currentRow}`);
      diskonRow.getCell(1).value = "Diskon Nota:";
      diskonRow.getCell(1).alignment = { horizontal: "right" };
      diskonRow.getCell(17).value = -diskonNota;
      diskonRow.getCell(17).numFmt = "#,##0";
      diskonRow.getCell(17).font = { color: { argb: "FFD32F2F" } };
      subtotalPenjualan -= diskonNota;
      currentRow++;
    }

    // Subtotal per transaction
    const subtotalRow = worksheet.getRow(currentRow);
    worksheet.mergeCells(`A${currentRow}:M${currentRow}`);
    subtotalRow.getCell(1).value = "SUBTOTAL:";
    subtotalRow.getCell(1).font = { bold: true };
    subtotalRow.getCell(1).alignment = { horizontal: "right" };
    subtotalRow.getCell(17).value = subtotalPenjualan;
    subtotalRow.getCell(18).value = subtotalModal;
    subtotalRow.getCell(19).value = subtotalLaba;
    subtotalRow.getCell(20).value =
      subtotalPenjualan > 0 ? (subtotalLaba / subtotalPenjualan) * 100 : 0;

    subtotalRow.font = { bold: true };
    for (let i = 1; i <= 20; i++) {
      subtotalRow.getCell(i).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF9C4" },
      };
    }

    subtotalRow.getCell(17).numFmt = "#,##0";
    subtotalRow.getCell(18).numFmt = "#,##0";
    subtotalRow.getCell(19).numFmt = "#,##0";
    subtotalRow.getCell(20).numFmt = "0.00";

    grandTotalPenjualan += subtotalPenjualan;
    grandTotalModal += subtotalModal;
    grandTotalLaba += subtotalLaba;

    currentRow += 2; // Space between transactions
  });

  // Grand total
  const grandTotalRow = worksheet.getRow(currentRow);
  worksheet.mergeCells(`A${currentRow}:M${currentRow}`);
  grandTotalRow.getCell(1).value = "GRAND TOTAL:";
  grandTotalRow.getCell(1).font = {
    bold: true,
    size: 12,
    color: { argb: "FFFFFFFF" },
  };
  grandTotalRow.getCell(1).alignment = { horizontal: "right" };
  grandTotalRow.getCell(17).value = grandTotalPenjualan;
  grandTotalRow.getCell(18).value = grandTotalModal;
  grandTotalRow.getCell(19).value = grandTotalLaba;
  grandTotalRow.getCell(20).value =
    grandTotalPenjualan > 0 ? (grandTotalLaba / grandTotalPenjualan) * 100 : 0;

  grandTotalRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  for (let i = 1; i <= 20; i++) {
    grandTotalRow.getCell(i).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF388E3C" },
    };
  }

  grandTotalRow.getCell(17).numFmt = "#,##0";
  grandTotalRow.getCell(18).numFmt = "#,##0";
  grandTotalRow.getCell(19).numFmt = "#,##0";
  grandTotalRow.getCell(20).numFmt = "0.00";

  for (let i = 1; i <= 20; i++) {
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
        isDeleted: false,
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
              jenisKemasan: true,
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
        const hargaBeli = toNumber(item.hargaBeli);
        const laba = toNumber(item.laba);
        const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
        const totalPcsItem = getTotalItemPcs(item, jumlahPerKemasan);
        const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
          totalPcsItem,
          jumlahPerKemasan
        );

        const modalDus = hargaBeli * jumlahDus;
        const modalPcs =
          jumlahPcs > 0
            ? Math.round((hargaBeli / jumlahPerKemasan) * jumlahPcs)
            : 0;
        monthTotalModal += modalDus + modalPcs;
        monthTotalLaba += laba;

        monthTotalDus += jumlahDus;
        monthTotalPcs += totalPcsItem;
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
