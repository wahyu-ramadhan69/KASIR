import { NextRequest, NextResponse } from "next/server";
import { Prisma, PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function toNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value || 0);
}

function getStokKemasan(stok: number, jumlahPerKemasan: number) {
  const perKemasan = Math.max(1, jumlahPerKemasan);
  return {
    jumlahKemasan: Math.floor(stok / perKemasan),
    jumlahPcs: stok % perKemasan,
  };
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        {
          success: false,
          error: "Parameter startDate dan endDate wajib diisi",
        },
        { status: 400 },
      );
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "Format tanggal tidak valid" },
        { status: 400 },
      );
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const supplierIdsParam = searchParams.get("supplierIds");
    const search = searchParams.get("search")?.trim();

    const barangWhere: Prisma.BarangWhereInput = { isActive: true };

    if (supplierIdsParam && supplierIdsParam !== "all") {
      const ids = supplierIdsParam
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isInteger(id) && id > 0);
      if (ids.length > 0) barangWhere.supplierId = { in: ids };
    }

    if (search) {
      barangWhere.OR = [
        { namaBarang: { contains: search, mode: "insensitive" } },
        {
          supplier: { namaSupplier: { contains: search, mode: "insensitive" } },
        },
      ];
    }

    const barangList = await prisma.barang.findMany({
      where: barangWhere,
      include: { supplier: true },
      orderBy: [{ supplier: { namaSupplier: "asc" } }, { namaBarang: "asc" }],
    });

    const penjualanItems = await prisma.penjualanItem.groupBy({
      by: ["barangId"],
      where: {
        penjualan: {
          statusTransaksi: "SELESAI",
          isDeleted: false,
          tanggalTransaksi: { gte: startDate, lte: endDate },
        },
        barangId: { in: barangList.map((b) => b.id) },
      },
      _sum: { totalItem: true },
    });

    const terjualMap = new Map<number, number>();
    for (const item of penjualanItems) {
      terjualMap.set(item.barangId, toNumber(item._sum.totalItem));
    }

    const data = barangList.map((barang) => {
      const stokSekarang = toNumber(barang.stok);
      const jumlahPerKemasan = Math.max(1, toNumber(barang.jumlahPerKemasan));
      const totalTerjual = terjualMap.get(barang.id) ?? 0;
      const stokAwal = stokSekarang + totalTerjual;

      const stokAwalK = getStokKemasan(stokAwal, jumlahPerKemasan);
      const terjualK = getStokKemasan(totalTerjual, jumlahPerKemasan);
      const stokAkhirK = getStokKemasan(stokSekarang, jumlahPerKemasan);

      const hargaJual = toNumber(barang.hargaJual);
      const hargaBeli = toNumber(barang.hargaBeli);

      const nilaiTerjual =
        hargaJual * terjualK.jumlahKemasan +
        (terjualK.jumlahPcs > 0
          ? Math.round((hargaJual / jumlahPerKemasan) * terjualK.jumlahPcs)
          : 0);
      const modalTerjual =
        hargaBeli * terjualK.jumlahKemasan +
        (terjualK.jumlahPcs > 0
          ? Math.round((hargaBeli / jumlahPerKemasan) * terjualK.jumlahPcs)
          : 0);

      return {
        namaBarang: barang.namaBarang,
        namaSupplier: barang.supplier?.namaSupplier || "-",
        satuanKemasan: barang.jenisKemasan,
        jumlahPerKemasan,
        hargaJual,
        hargaBeli,
        stokAwal,
        stokAwalKemasan: stokAwalK.jumlahKemasan,
        stokAwalPcs: stokAwalK.jumlahPcs,
        totalTerjual,
        terjualKemasan: terjualK.jumlahKemasan,
        terjualPcs: terjualK.jumlahPcs,
        stokAkhir: stokSekarang,
        stokAkhirKemasan: stokAkhirK.jumlahKemasan,
        stokAkhirPcs: stokAkhirK.jumlahPcs,
        nilaiTerjual,
        modalTerjual,
        labaKotor: nilaiTerjual - modalTerjual,
      };
    });

    const summary = data.reduce(
      (acc, b) => {
        acc.jumlahBarang += 1;
        acc.totalTerjual += b.totalTerjual;
        acc.totalNilaiTerjual += b.nilaiTerjual;
        acc.totalModalTerjual += b.modalTerjual;
        acc.totalLabaKotor += b.labaKotor;
        return acc;
      },
      {
        jumlahBarang: 0,
        totalTerjual: 0,
        totalNilaiTerjual: 0,
        totalModalTerjual: 0,
        totalLabaKotor: 0,
      },
    );

    // ── Build Excel ───────────────────────────────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sistem Laporan";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Stok Periode", {
      pageSetup: { fitToPage: true, fitToWidth: 1, orientation: "landscape" },
    });

    const periodeLabel = `${formatDateLabel(startDate)} s/d ${formatDateLabel(endDate)}`;
    const tanggalCetak = new Date().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Judul
    ws.mergeCells("A1:M1");
    const titleCell = ws.getCell("A1");
    titleCell.value = "LAPORAN STOK BARANG PER PERIODE";
    titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1565C0" },
    };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 32;

    // Sub-header periode
    ws.mergeCells("A2:M2");
    const periodeCell = ws.getCell("A2");
    periodeCell.value = `Periode: ${periodeLabel}`;
    periodeCell.font = { bold: true, size: 12, color: { argb: "FF1565C0" } };
    periodeCell.alignment = { horizontal: "center" };
    ws.getRow(2).height = 20;

    // Tanggal cetak
    ws.mergeCells("A3:M3");
    const subCell = ws.getCell("A3");
    subCell.value = `Dicetak: ${tanggalCetak}${search ? `  |  Pencarian: "${search}"` : ""}`;
    subCell.font = { italic: true, size: 10, color: { argb: "FF777777" } };
    subCell.alignment = { horizontal: "center" };
    ws.getRow(3).height = 16;

    ws.getRow(4).height = 6; // spacer

    // ── Header grup ───────────────────────────────────────────────────────────
    // Baris 5: grup header
    // Baris 6: sub-header kolom
    const GRP_ROW = 5;
    const HDR_ROW = 6;

    const grpStyle = (argb: string) => ({
      font: {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 10,
      } as ExcelJS.Font,
      fill: {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb },
      },
      alignment: { horizontal: "center" as const, vertical: "middle" as const },
      border: {
        top: { style: "thin" as const },
        bottom: { style: "thin" as const },
        left: { style: "thin" as const },
        right: { style: "thin" as const },
      },
    });

    const hdrStyle = (argb: string) => ({
      font: {
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 9,
      } as ExcelJS.Font,
      fill: {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb },
      },
      alignment: {
        horizontal: "center" as const,
        vertical: "middle" as const,
        wrapText: true,
      },
      border: {
        top: { style: "thin" as const },
        bottom: { style: "thin" as const },
        left: { style: "thin" as const },
        right: { style: "thin" as const },
      },
    });

    // Helper apply style
    const applyStyle = (
      cell: ExcelJS.Cell,
      style: ReturnType<typeof grpStyle>,
    ) => {
      cell.font = style.font;
      cell.fill = style.fill;
      cell.alignment = style.alignment;
      cell.border = style.border;
    };

    // Kolom layout:
    // A=No, B=Barang, C=Supplier, D=Kemasan
    // E=Terjual Kemasan, F=Terjual PCS, G=Terjual Total
    // H=Stok Akhir Kemasan, I=Stok Akhir PCS, J=Stok Akhir Total
    // K=Nilai Terjual, L=Modal Terjual, M=Laba Kotor

    ws.columns = [
      { width: 5 }, // A No
      { width: 28 }, // B Barang
      { width: 20 }, // C Supplier
      { width: 14 }, // D Kemasan
      { width: 12 }, // E Terjual Kemasan
      { width: 11 }, // F Terjual PCS
      { width: 12 }, // G Terjual Total
      { width: 12 }, // H Stok Akhir Kemasan
      { width: 11 }, // I Stok Akhir PCS
      { width: 12 }, // J Stok Akhir Total
      { width: 16 }, // K Nilai Terjual
      { width: 16 }, // L Modal Terjual
      { width: 16 }, // M Laba Kotor
    ];

    // Grup header baris 5
    // No, Barang, Supplier, Kemasan → merge ke baris 6
    ["A", "B", "C", "D"].forEach((col) => {
      ws.mergeCells(`${col}${GRP_ROW}:${col}${HDR_ROW}`);
    });

    const grpRow5 = ws.getRow(GRP_ROW);
    const setGrpCell = (col: string, label: string, argb: string) => {
      const cell = grpRow5.getCell(col);
      cell.value = label;
      applyStyle(cell, grpStyle(argb));
    };

    setGrpCell("A", "No", "FF37474F");
    setGrpCell("B", "Nama Barang", "FF37474F");
    setGrpCell("C", "Supplier", "FF37474F");
    setGrpCell("D", "Kemasan", "FF37474F");

    // Grup: Terjual (E-G)
    ws.mergeCells(`E${GRP_ROW}:G${GRP_ROW}`);
    const grpTerjual = ws.getCell(`E${GRP_ROW}`);
    grpTerjual.value = `TERJUAL (${periodeLabel})`;
    applyStyle(grpTerjual, grpStyle("FF1565C0"));

    // Grup: Stok Akhir (H-J)
    ws.mergeCells(`H${GRP_ROW}:J${GRP_ROW}`);
    const grpAkhir = ws.getCell(`H${GRP_ROW}`);
    grpAkhir.value = "STOK AKHIR (SEKARANG)";
    applyStyle(grpAkhir, grpStyle("FF6A1B9A"));

    // Grup: Nilai (K-M)
    ws.mergeCells(`K${GRP_ROW}:M${GRP_ROW}`);
    const grpNilai = ws.getCell(`K${GRP_ROW}`);
    grpNilai.value = "NILAI PENJUALAN PERIODE";
    applyStyle(grpNilai, grpStyle("FFB71C1C"));

    ws.getRow(GRP_ROW).height = 20;

    // Sub-header baris 6
    const hdrRow = ws.getRow(HDR_ROW);
    const subHeaders: { col: string; label: string; argb: string }[] = [
      { col: "E", label: "Kemasan", argb: "FF1565C0" },
      { col: "F", label: "PCS", argb: "FF1565C0" },
      { col: "G", label: "Total", argb: "FF1565C0" },
      { col: "H", label: "Kemasan", argb: "FF6A1B9A" },
      { col: "I", label: "PCS", argb: "FF6A1B9A" },
      { col: "J", label: "Total", argb: "FF6A1B9A" },
      { col: "K", label: "Nilai Jual", argb: "FFB71C1C" },
      { col: "L", label: "Modal", argb: "FFB71C1C" },
      { col: "M", label: "Laba Kotor", argb: "FFB71C1C" },
    ];

    subHeaders.forEach(({ col, label, argb }) => {
      const cell = hdrRow.getCell(col);
      cell.value = label;
      applyStyle(cell, hdrStyle(argb));
    });

    // Juga apply style ke merged cells A-D di baris 6 (sudah merged ke baris 5)
    ws.getRow(HDR_ROW).height = 20;

    // ── Baris data ────────────────────────────────────────────────────────────
    const IDR_FMT = "#,##0";
    const rupiahFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;

    data.forEach((row, idx) => {
      const r = ws.addRow([
        idx + 1,
        row.namaBarang,
        row.namaSupplier,
        `${row.jumlahPerKemasan} pcs/${row.satuanKemasan}`,
        row.terjualKemasan,
        row.terjualPcs,
        row.totalTerjual,
        row.stokAkhirKemasan,
        row.stokAkhirPcs,
        row.stokAkhir,
        row.nilaiTerjual,
        row.modalTerjual,
        row.labaKotor,
      ]);

      const isOdd = idx % 2 === 0;
      const bgBase = isOdd ? "FFFAFAFA" : "FFFFFFFF";

      r.eachCell((cell, col) => {
        cell.border = {
          top: { style: "hair", color: { argb: "FFE0E0E0" } },
          bottom: { style: "hair", color: { argb: "FFE0E0E0" } },
          left: { style: "hair", color: { argb: "FFE0E0E0" } },
          right: { style: "hair", color: { argb: "FFE0E0E0" } },
        };

        // Default background
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bgBase },
        };

        if (col === 1) cell.alignment = { horizontal: "center" };

        // Terjual (E=5, F=6, G=7) → tint biru
        if ([5, 6, 7].includes(col)) {
          cell.numFmt = IDR_FMT;
          cell.alignment = { horizontal: "right" };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: isOdd ? "FFE3F2FD" : "FFF0F8FF" },
          };
          if (col === 7 && row.totalTerjual === 0) {
            cell.font = { color: { argb: "FFBDBDBD" } };
          }
        }
        // Stok Akhir (H=8, I=9, J=10) → tint ungu
        if ([8, 9, 10].includes(col)) {
          cell.numFmt = IDR_FMT;
          cell.alignment = { horizontal: "right" };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: isOdd ? "FFF3E5F5" : "FFF9F2FC" },
          };
        }
        // Nilai (K=11, L=12) → rupiah
        if ([11, 12].includes(col)) {
          cell.numFmt = rupiahFmt;
          cell.alignment = { horizontal: "right" };
        }
        // Laba Kotor (M=13)
        if (col === 13) {
          cell.numFmt = rupiahFmt;
          cell.alignment = { horizontal: "right" };
          cell.font = {
            bold: true,
            color: { argb: row.labaKotor >= 0 ? "FF2E7D32" : "FFC62828" },
          };
        }
      });

      r.height = 18;
    });

    // ── Baris total ───────────────────────────────────────────────────────────
    ws.addRow([]);

    const totalRow = ws.addRow([
      "",
      "TOTAL",
      "",
      "",
      "",
      "",
      summary.totalTerjual,
      "",
      "",
      "",
      summary.totalNilaiTerjual,
      summary.totalModalTerjual,
      summary.totalLabaKotor,
    ]);

    totalRow.eachCell((cell, col) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1565C0" },
      };
      cell.border = {
        top: { style: "medium", color: { argb: "FF0D47A1" } },
        bottom: { style: "medium", color: { argb: "FF0D47A1" } },
      };
      if (col === 7) {
        cell.numFmt = IDR_FMT;
        cell.alignment = { horizontal: "right" };
      }
      if ([11, 12, 13].includes(col)) {
        cell.numFmt = rupiahFmt;
        cell.alignment = { horizontal: "right" };
      }
    });
    totalRow.height = 22;

    // ── Summary box ───────────────────────────────────────────────────────────
    ws.addRow([]);
    const summaryStartRow = ws.lastRow!.number + 1;

    const summaryItems: [string, number, string, boolean][] = [
      ["Total Jenis Barang", summary.jumlahBarang, "FF1565C0", false],
      ["Total Item Terjual", summary.totalTerjual, "FF00695C", false],
      ["Total Nilai Terjual", summary.totalNilaiTerjual, "FF4527A0", true],
      ["Total Modal", summary.totalModalTerjual, "FF37474F", true],
      ["Total Laba Kotor", summary.totalLabaKotor, "FFB71C1C", true],
    ];

    summaryItems.forEach(([label, value, color, isRupiah], i) => {
      const col = i * 2 + 1;
      const labelCell = ws.getCell(summaryStartRow, col);
      const valCell = ws.getCell(summaryStartRow, col + 1);

      labelCell.value = label;
      labelCell.font = { bold: true, size: 9, color: { argb: "FF555555" } };
      labelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF5F5F5" },
      };
      labelCell.alignment = { horizontal: "center", vertical: "middle" };
      labelCell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };

      valCell.value = value;
      valCell.font = { bold: true, size: 12, color: { argb: color } };
      valCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFFFFF" },
      };
      valCell.alignment = { horizontal: "center", vertical: "middle" };
      valCell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
      valCell.numFmt = isRupiah ? rupiahFmt : "#,##0";
    });
    ws.getRow(summaryStartRow).height = 26;

    // Freeze header
    ws.views = [{ state: "frozen", ySplit: HDR_ROW, xSplit: 0 }];

    // ── Output ────────────────────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Laporan-Stok-Periode-${startDateParam}-sd-${endDateParam}-${dateStr}.xlsx`;

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating laporan stok periode Excel:", error);
    const message =
      error instanceof Error ? error.message : "Gagal generate laporan";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
