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
    const worksheet = workbook.addWorksheet("Laporan Pengeluaran");

    if (period === "yearly" && year) {
      // YEARLY REPORT
      await generateYearlyReport(worksheet, parseInt(year));
    } else if (detail) {
      // DETAIL REPORT (with keterangan)
      await generateDetailReport(worksheet, { startDate, endDate, search });
    } else {
      // SUMMARY REPORT (no keterangan)
      await generateSummaryReport(worksheet, { startDate, endDate, search });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const dateRange = formatDateRange(
      startDate || undefined,
      endDate || undefined
    );
    const filename = `Laporan-Pengeluaran-${dateRange.replace(
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
  const where: any = {};

  if (filters.startDate || filters.endDate) {
    where.tanggalInput = {};
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      where.tanggalInput.gte = start;
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      where.tanggalInput.lte = end;
    }
  }

  if (filters.search) {
    where.OR = [
      { namaPengeluaran: { contains: filters.search, mode: "insensitive" } },
      { keterangan: { contains: filters.search, mode: "insensitive" } },
    ];
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
  worksheet.mergeCells("A1:E1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "LAPORAN PENGELUARAN";
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD32F2F" },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  // Periode
  worksheet.mergeCells("A2:E2");
  const periodeCell = worksheet.getCell("A2");
  periodeCell.value = `Periode: ${formatDateRange(
    filters.startDate || undefined,
    filters.endDate || undefined
  )}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  // Total transaksi
  worksheet.mergeCells("A3:E3");
  const totalCell = worksheet.getCell("A3");
  totalCell.value = `Total Transaksi: ${pengeluaranList.length}`;
  totalCell.font = { bold: true };
  totalCell.alignment = { horizontal: "center" };

  // Headers
  const headers = ["No", "Tanggal", "Nama Pengeluaran", "Jumlah", "Input By"];
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
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 30;
  worksheet.getColumn(4).width = 18;
  worksheet.getColumn(5).width = 20;

  // Data rows
  let currentRow = 6;
  let grandTotal = 0;

  pengeluaranList.forEach((pengeluaran, index) => {
    const jumlah = toNumber(pengeluaran.jumlah);
    grandTotal += jumlah;

    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = new Date(
      pengeluaran.tanggalInput
    ).toLocaleDateString("id-ID");
    row.getCell(3).value = pengeluaran.namaPengeluaran;
    row.getCell(4).value = jumlah;
    row.getCell(5).value = pengeluaran.user?.email || "-";

    // Format
    row.getCell(4).numFmt = "#,##0";

    // Borders
    for (let i = 1; i <= 5; i++) {
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
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
  totalRow.getCell(1).value = "TOTAL";
  totalRow.getCell(1).alignment = { horizontal: "center" };
  totalRow.getCell(4).value = grandTotal;

  totalRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD32F2F" },
  };

  totalRow.getCell(4).numFmt = "#,##0";

  for (let i = 1; i <= 5; i++) {
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
  const where: any = {};

  if (filters.startDate || filters.endDate) {
    where.tanggalInput = {};
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      where.tanggalInput.gte = start;
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      where.tanggalInput.lte = end;
    }
  }

  if (filters.search) {
    where.OR = [
      { namaPengeluaran: { contains: filters.search, mode: "insensitive" } },
      { keterangan: { contains: filters.search, mode: "insensitive" } },
    ];
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
  worksheet.mergeCells("A1:F1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = "LAPORAN PENGELUARAN DETAIL";
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD32F2F" },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  // Periode
  worksheet.mergeCells("A2:F2");
  const periodeCell = worksheet.getCell("A2");
  periodeCell.value = `Periode: ${formatDateRange(
    filters.startDate || undefined,
    filters.endDate || undefined
  )}`;
  periodeCell.font = { italic: true, size: 11 };
  periodeCell.alignment = { horizontal: "center" };

  // Total transaksi
  worksheet.mergeCells("A3:F3");
  const totalCell = worksheet.getCell("A3");
  totalCell.value = `Total Transaksi: ${pengeluaranList.length}`;
  totalCell.font = { bold: true };
  totalCell.alignment = { horizontal: "center" };

  // Headers
  const headers = [
    "No",
    "Tanggal",
    "Nama Pengeluaran",
    "Keterangan",
    "Jumlah",
    "Input By",
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
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 25;
  worksheet.getColumn(4).width = 35;
  worksheet.getColumn(5).width = 18;
  worksheet.getColumn(6).width = 20;

  // Data rows
  let currentRow = 6;
  let grandTotal = 0;

  pengeluaranList.forEach((pengeluaran, index) => {
    const jumlah = toNumber(pengeluaran.jumlah);
    grandTotal += jumlah;

    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = index + 1;
    row.getCell(2).value = new Date(
      pengeluaran.tanggalInput
    ).toLocaleDateString("id-ID");
    row.getCell(3).value = pengeluaran.namaPengeluaran;
    row.getCell(4).value = pengeluaran.keterangan || "-";
    row.getCell(5).value = jumlah;
    row.getCell(6).value = pengeluaran.user?.email || "-";

    // Format
    row.getCell(5).numFmt = "#,##0";

    // Borders
    for (let i = 1; i <= 6; i++) {
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
  worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
  totalRow.getCell(1).value = "TOTAL";
  totalRow.getCell(1).alignment = { horizontal: "center" };
  totalRow.getCell(5).value = grandTotal;

  totalRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD32F2F" },
  };

  totalRow.getCell(5).numFmt = "#,##0";

  for (let i = 1; i <= 6; i++) {
    totalRow.getCell(i).border = {
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
  worksheet.mergeCells("A1:C1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `LAPORAN PENGELUARAN TAHUNAN ${year}`;
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD32F2F" },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 30;

  // Headers
  const headers = ["Bulan", "Transaksi", "Total"];
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
  worksheet.getColumn(3).width = 20;

  let currentRow = 4;
  let annualTotalTransaksi = 0;
  let annualTotalPengeluaran = 0;

  // Data for each month
  for (let month = 0; month < 12; month++) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const pengeluaranList = await prisma.pengeluaran.findMany({
      where: {
        tanggalInput: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    let monthTotal = 0;

    pengeluaranList.forEach((pengeluaran) => {
      monthTotal += toNumber(pengeluaran.jumlah);
    });

    const row = worksheet.getRow(currentRow);
    row.getCell(1).value = months[month];
    row.getCell(2).value = pengeluaranList.length;
    row.getCell(3).value = monthTotal;

    // Format
    row.getCell(3).numFmt = "#,##0";

    // Borders
    for (let i = 1; i <= 3; i++) {
      row.getCell(i).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }

    annualTotalTransaksi += pengeluaranList.length;
    annualTotalPengeluaran += monthTotal;

    currentRow++;
  }

  // Annual total
  const totalRow = worksheet.getRow(currentRow);
  totalRow.getCell(1).value = "TOTAL TAHUNAN";
  totalRow.getCell(2).value = annualTotalTransaksi;
  totalRow.getCell(3).value = annualTotalPengeluaran;

  totalRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD32F2F" },
  };

  totalRow.getCell(3).numFmt = "#,##0";

  for (let i = 1; i <= 3; i++) {
    totalRow.getCell(i).border = {
      top: { style: "medium" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };
  }
}
