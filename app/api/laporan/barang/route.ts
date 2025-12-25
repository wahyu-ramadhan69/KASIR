import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Period = "hari" | "bulan" | "tahun";

function deepSerialize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(deepSerialize);
  if (typeof obj === "object") {
    const serialized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        serialized[key] = deepSerialize(obj[key]);
      }
    }
    return serialized;
  }
  return obj;
}

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = normalizePeriod(searchParams.get("periode") || searchParams.get("period"));
    const dateParam = searchParams.get("date") || searchParams.get("tanggal");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const statusParam = (searchParams.get("statusPembayaran") || "all").toUpperCase();

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
    } else if (dateParam || searchParams.has("periode") || searchParams.has("period")) {
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
            ukuran: true,
            satuan: true,
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
        ukuran: number;
        satuan: string;
        jumlahPerKemasan: number;
        jenisKemasan: string;
        totalDus: number; // total kemasan terjual (sudah termasuk konversi pcs ke kemasan)
        totalPcs: number; // total item terjual (dus dan pcs dikonversi ke item)
        totalPcsSetara: number; // alias dari total item terjual
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
        jumlahPcs > 0 ? Math.round((hargaBeli / jumlahPerKemasan) * jumlahPcs) : 0;
      const totalModalItem = modalDus + modalPcs;

      const penjualanDus = hargaJual * jumlahDus;
      const penjualanPcs =
        jumlahPcs > 0 ? Math.round((hargaJual / jumlahPerKemasan) * jumlahPcs) : 0;
      const totalPenjualanItem = penjualanDus + penjualanPcs;

      const labaItem =
        typeof item.laba === "bigint" || typeof item.laba === "number"
          ? toNumber(item.laba)
          : totalPenjualanItem - totalModalItem;

      const totalKemasanTerjual = totalItemTerjual / jumlahPerKemasan; // bisa pecahan jika tidak pas kemasan

      if (!barangMap.has(item.barangId)) {
        barangMap.set(item.barangId, {
          barangId: item.barangId,
          namaBarang: item.barang.namaBarang,
          ukuran: toNumber(item.barang.ukuran),
          satuan: item.barang.satuan,
          jumlahPerKemasan,
          jenisKemasan: item.barang.jenisKemasan,
          totalDus: 0,
          totalPcs: 0,
          totalPcsSetara: 0,
          totalModal: 0,
          totalPenjualan: 0,
          totalLaba: 0,
        });
      }

      const agg = barangMap.get(item.barangId)!;
      agg.totalDus += totalKemasanTerjual;
      agg.totalPcs += totalItemTerjual;
      agg.totalPcsSetara += totalItemTerjual;
      agg.totalModal += totalModalItem;
      agg.totalPenjualan += totalPenjualanItem;
      agg.totalLaba += labaItem;
    }

    const result = Array.from(barangMap.values()).sort(
      (a, b) => b.totalLaba - a.totalLaba
    );

    const summary = result.reduce(
      (acc, curr) => {
        acc.totalModal += curr.totalModal;
        acc.totalPenjualan += curr.totalPenjualan;
        acc.totalLaba += curr.totalLaba;
        acc.totalPcsSetara += curr.totalPcs; // total item terjual
        return acc;
      },
      { totalModal: 0, totalPenjualan: 0, totalLaba: 0, totalPcsSetara: 0 }
    );

    return NextResponse.json(
      deepSerialize({
        success: true,
        filters: {
          period,
          statusPembayaran: statusParam === "ALL" ? "all" : statusParam.toLowerCase(),
          date: startDate,
          startDate,
          endDate,
          range: { startDate, endDate },
        },
        data: result,
        summary: {
          ...summary,
          jumlahBarang: result.length,
        },
      })
    );
  } catch (error) {
    console.error("Error generating laporan laba per barang:", error);
    const message = error instanceof Error ? error.message : "Gagal mengambil laporan laba per barang";
    const status = message === "Tanggal tidak valid" ? 400 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  } finally {
    await prisma.$disconnect();
  }
}
