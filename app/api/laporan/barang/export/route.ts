import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

type Period = "hari" | "bulan" | "tahun";

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

function normalizePeriod(raw: string | null): Period {
  const value = (raw || "hari").toLowerCase();
  if (["hari", "harian", "day", "daily"].includes(value)) return "hari";
  if (["bulan", "bulanan", "month", "monthly"].includes(value)) return "bulan";
  if (["tahun", "tahunan", "year", "yearly"].includes(value)) return "tahun";
  return "hari";
}

function getDateRange(period: Period, dateParam: string | null) {
  const baseDate = dateParam ? new Date(dateParam) : new Date();
  if (isNaN(baseDate.getTime())) {
    throw new Error("Tanggal tidak valid");
  }

  const startDate = new Date(baseDate);
  const endDate = new Date(baseDate);

  if (period === "hari") {
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  } else if (period === "bulan") {
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setMonth(endDate.getMonth() + 1, 0);
    endDate.setHours(23, 59, 59, 999);
  } else if (period === "tahun") {
    startDate.setMonth(0, 1);
    startDate.setHours(0, 0, 0, 0);
    endDate.setMonth(11, 31);
    endDate.setHours(23, 59, 59, 999);
  }

  return { startDate, endDate };
}

function formatDateRange(startDate?: Date, endDate?: Date): string {
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
    return `${startDate.getDate()} ${
      months[startDate.getMonth()]
    } ${startDate.getFullYear()} s/d ${endDate.getDate()} ${
      months[endDate.getMonth()]
    } ${endDate.getFullYear()}`;
  } else if (startDate) {
    return `Sejak ${startDate.getDate()} ${
      months[startDate.getMonth()]
    } ${startDate.getFullYear()}`;
  } else if (endDate) {
    return `Sampai ${endDate.getDate()} ${
      months[endDate.getMonth()]
    } ${endDate.getFullYear()}`;
  }
  return "Semua Periode";
}

export async function GET(request: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const period = normalizePeriod(
      searchParams.get("periode") || searchParams.get("period")
    );
    const dateParam = searchParams.get("date") || searchParams.get("tanggal");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const statusParam = (
      searchParams.get("statusPembayaran") || "all"
    ).toUpperCase();

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateParam || endDateParam) {
      if (startDateParam) {
        const s = new Date(startDateParam);
        if (isNaN(s.getTime())) throw new Error("Tanggal tidak valid");
        s.setHours(0, 0, 0, 0);
        startDate = s;
      }
      if (endDateParam) {
        const e = new Date(endDateParam);
        if (isNaN(e.getTime())) throw new Error("Tanggal tidak valid");
        e.setHours(23, 59, 59, 999);
        endDate = e;
      }
    } else if (
      dateParam ||
      searchParams.has("periode") ||
      searchParams.has("period")
    ) {
      const range = getDateRange(period, dateParam);
      startDate = range.startDate;
      endDate = range.endDate;
    }

    const penjualanFilter: any = {
      statusTransaksi: "SELESAI",
    };

    if (startDate || endDate) {
      penjualanFilter.tanggalTransaksi = {};
      if (startDate) penjualanFilter.tanggalTransaksi.gte = startDate;
      if (endDate) penjualanFilter.tanggalTransaksi.lte = endDate;
    }

    if (statusParam === "LUNAS" || statusParam === "HUTANG") {
      penjualanFilter.statusPembayaran = statusParam;
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
            berat: true,
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
        berat: number;
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
          berat: toNumber(item.barang.berat),
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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Laba Per Barang");

    // Title
    worksheet.mergeCells("A1:J1");
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
    worksheet.mergeCells("A2:J2");
    const periodeCell = worksheet.getCell("A2");
    periodeCell.value = `Periode: ${formatDateRange(startDate, endDate)}`;
    periodeCell.font = { italic: true, size: 11 };
    periodeCell.alignment = { horizontal: "center" };

    worksheet.getRow(3).height = 5;

    const headers = [
      "No",
      "Barang",
      "Berat (kg)",
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

    worksheet.columns = [
      { key: "no", width: 5 },
      { key: "barang", width: 32 },
      { key: "berat", width: 12 },
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
      excelRow.getCell("C").value = formatKgDisplay(row.berat);
      excelRow.getCell(
        "D"
      ).value = `${row.jumlahPerKemasan} item/${row.jenisKemasan}`;
      excelRow.getCell("E").value = row.totalKemasan;
      excelRow.getCell("F").value = row.totalItem;
      excelRow.getCell("G").value = row.totalPenjualan;
      excelRow.getCell("H").value = row.totalModal;
      excelRow.getCell("I").value = row.totalLaba;
      excelRow.getCell("J").value = margin;

      ["E", "F", "G", "H", "I", "J"].forEach((key) => {
        const cell = excelRow.getCell(key);
        cell.alignment = { horizontal: "right" };
        cell.numFmt = key === "J" ? "0.00" : "#,##0";
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
    totalRow.getCell("B").font = { bold: true };
    totalRow.getCell("E").value = totalKemasan;
    totalRow.getCell("F").value = totalItem;
    totalRow.getCell("G").value = totalPenjualan;
    totalRow.getCell("H").value = totalModal;
    totalRow.getCell("I").value = totalLaba;
    totalRow.getCell("J").value = totalPenjualan
      ? (totalLaba / totalPenjualan) * 100
      : 0;

    ["E", "F", "G", "H", "I", "J"].forEach((key) => {
      const cell = totalRow.getCell(key);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "right" };
      cell.numFmt = key === "J" ? "0.00" : "#,##0";
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF388E3C" },
      };
    });

    ["A", "B", "C", "D"].forEach((key) => {
      const cell = totalRow.getCell(key);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF388E3C" },
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Laporan-Laba-Barang-${formatDateRange(
      startDate,
      endDate
    ).replace(/\s/g, "-")}-${Date.now()}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating laporan laba per barang:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate report";
    const status = message === "Tanggal tidak valid" ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  } finally {
    await prisma.$disconnect();
  }
}
