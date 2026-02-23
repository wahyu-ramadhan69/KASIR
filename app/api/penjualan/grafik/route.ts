// app/api/penjualan/grafik/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function deriveDusPcsFromTotal(totalItem: number, jumlahPerKemasan: number) {
  const perKemasan = Math.max(1, jumlahPerKemasan);
  const jumlahDus = Math.floor(totalItem / perKemasan);
  const jumlahPcs = totalItem % perKemasan;
  return { jumlahDus, jumlahPcs };
}

function getTotalItemPcs(item: any, jumlahPerKemasan: number): number {
  if (item.totalItem !== undefined && item.totalItem !== null) {
    return Number(item.totalItem);
  }
  const jumlahDus = Number(item.jumlahDus);
  const jumlahPcs = Number(item.jumlahPcs);
  return jumlahDus * jumlahPerKemasan + jumlahPcs;
}

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

export async function GET(request: Request) {
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "daily";
    const range = parseInt(searchParams.get("range") || "30");
    const dateParam = searchParams.get("date");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const useCustomRange = !!(startDateParam && endDateParam);

    const roleUpper = authData.role?.toUpperCase();
    const isAdmin = roleUpper === "ADMIN";
    const isKasir = roleUpper === "KASIR";
    const userId = Number(authData.userId);
    const shouldFilterByUser = !isAdmin && !Number.isNaN(userId);

    // ✅ Kalkulasi startDate & today berdasarkan mode
    let today: Date;
    let startDate: Date;

    if (useCustomRange) {
      // Mode custom range: gunakan startDate & endDate dari params
      startDate = new Date(`${startDateParam}T00:00:00`);
      startDate.setHours(0, 0, 0, 0);
      today = new Date(`${endDateParam}T00:00:00`);
      today.setHours(23, 59, 59, 999);
    } else {
      // Mode normal: pakai period + range + date
      today = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date();
      today.setHours(23, 59, 59, 999);
      startDate = new Date(today);

      if (period === "daily") {
        startDate.setDate(startDate.getDate() - (range - 1));
        startDate.setHours(0, 0, 0, 0);
      } else if (period === "monthly") {
        startDate.setMonth(startDate.getMonth() - (range - 1));
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
      } else if (period === "yearly") {
        startDate.setFullYear(startDate.getFullYear() - (range - 1));
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
      }
    }

    type PenjualanEntry = {
      tanggal: Date;
      nominal: number;
    };

    let penjualanEntries: PenjualanEntry[] = [];
    let piutangEntries: PenjualanEntry[] = [];
    let piutangOutstandingEntries: PenjualanEntry[] = [];
    let pembayaranPenjualanEntries: PenjualanEntry[] = [];

    if (isKasir) {
      const pembayaranPenjualan = await prisma.pembayaranPenjualan.findMany({
        where: {
          tanggalBayar: { gte: startDate, lte: today },
          penjualan: { statusTransaksi: "SELESAI", isDeleted: false },
          jenisPembayaran: "PENJUALAN",
          ...(shouldFilterByUser ? { userId } : {}),
        },
        select: { tanggalBayar: true, nominal: true },
      });
      penjualanEntries = pembayaranPenjualan.map((item) => ({
        tanggal: item.tanggalBayar,
        nominal: Number(item.nominal),
      }));
      pembayaranPenjualanEntries = penjualanEntries;

      const pembayaranPiutang = await prisma.pembayaranPenjualan.findMany({
        where: {
          tanggalBayar: { gte: startDate, lte: today },
          penjualan: { statusTransaksi: "SELESAI", isDeleted: false },
          jenisPembayaran: "PIUTANG",
          ...(shouldFilterByUser ? { userId } : {}),
        },
        select: { tanggalBayar: true, nominal: true },
      });
      piutangEntries = pembayaranPiutang.map((item) => ({
        tanggal: item.tanggalBayar,
        nominal: Number(item.nominal),
      }));

      const piutangOutstanding = await prisma.penjualanHeader.findMany({
        where: {
          tanggalTransaksi: { gte: startDate, lte: today },
          statusTransaksi: "SELESAI",
          statusPembayaran: "HUTANG",
          isDeleted: false,
          ...(shouldFilterByUser ? { userId } : {}),
        },
        select: {
          tanggalTransaksi: true,
          totalHarga: true,
          jumlahDibayar: true,
        },
      });
      piutangOutstandingEntries = piutangOutstanding.map((item) => ({
        tanggal: item.tanggalTransaksi,
        nominal: Math.max(
          0,
          Number(item.totalHarga) - Number(item.jumlahDibayar || 0),
        ),
      }));
    } else {
      const penjualanHeaders = await prisma.penjualanHeader.findMany({
        where: {
          tanggalTransaksi: { gte: startDate, lte: today },
          statusTransaksi: "SELESAI",
          isDeleted: false,
          ...(shouldFilterByUser ? { userId } : {}),
        },
        select: { tanggalTransaksi: true, totalHarga: true },
      });
      penjualanEntries = penjualanHeaders.map((item) => ({
        tanggal: item.tanggalTransaksi,
        nominal: Number(item.totalHarga),
      }));

      const pembayaranPenjualan = await prisma.pembayaranPenjualan.findMany({
        where: {
          tanggalBayar: { gte: startDate, lte: today },
          penjualan: { statusTransaksi: "SELESAI", isDeleted: false },
          jenisPembayaran: "PENJUALAN",
          ...(shouldFilterByUser ? { userId } : {}),
        },
        select: { tanggalBayar: true, nominal: true },
      });
      pembayaranPenjualanEntries = pembayaranPenjualan.map((item) => ({
        tanggal: item.tanggalBayar,
        nominal: Number(item.nominal),
      }));

      const pembayaranPiutang = await prisma.pembayaranPenjualan.findMany({
        where: {
          tanggalBayar: { gte: startDate, lte: today },
          jenisPembayaran: "PIUTANG",
          penjualan: { isDeleted: false },
          ...(shouldFilterByUser ? { userId } : {}),
        },
        select: { tanggalBayar: true, nominal: true },
      });
      piutangEntries = pembayaranPiutang.map((item) => ({
        tanggal: item.tanggalBayar,
        nominal: Number(item.nominal),
      }));

      const piutangOutstanding = await prisma.penjualanHeader.findMany({
        where: {
          tanggalTransaksi: { gte: startDate, lte: today },
          statusTransaksi: "SELESAI",
          statusPembayaran: "HUTANG",
          isDeleted: false,
          ...(shouldFilterByUser ? { userId } : {}),
        },
        select: {
          tanggalTransaksi: true,
          totalHarga: true,
          jumlahDibayar: true,
        },
      });
      piutangOutstandingEntries = piutangOutstanding.map((item) => ({
        tanggal: item.tanggalTransaksi,
        nominal: Math.max(
          0,
          Number(item.totalHarga) - Number(item.jumlahDibayar || 0),
        ),
      }));
    }

    const pembelianHeaders = await prisma.pembelianHeader.findMany({
      where: {
        createdAt: { gte: startDate, lte: today },
        statusTransaksi: "SELESAI",
      },
      select: { id: true, createdAt: true, totalHarga: true },
    });

    const pengeluaran = await prisma.pengeluaran.findMany({
      where: {
        tanggalInput: { gte: startDate, lte: today },
        ...(shouldFilterByUser ? { userId } : {}),
      },
      select: { tanggalInput: true, jumlah: true },
    });

    const labaItems = await prisma.penjualanItem.findMany({
      where: {
        penjualan: {
          tanggalTransaksi: { gte: startDate, lte: today },
          statusTransaksi: "SELESAI",
          isDeleted: false,
          ...(shouldFilterByUser ? { userId } : {}),
        },
      },
      select: {
        hargaJual: true,
        hargaBeli: true,
        totalItem: true,
        barang: { select: { jumlahPerKemasan: true } },
        penjualan: { select: { tanggalTransaksi: true } },
      },
    });

    const pengembalianRusak = await prisma.pengembalianBarang.findMany({
      where: {
        tanggalPengembalian: { gte: startDate, lte: today },
        kondisiBarang: { in: ["RUSAK", "KADALUARSA"] },
        ...(shouldFilterByUser ? { userId } : {}),
      },
      select: {
        tanggalPengembalian: true,
        jumlahDus: true,
        jumlahPcs: true,
        barang: { select: { hargaBeli: true, jumlahPerKemasan: true } },
      },
    });

    type DailyValue = {
      penjualan: number;
      pembayaranPenjualan: number;
      pembayaranPiutang: number;
      piutang: number;
      pembelian: number;
      pengeluaran: number;
      labaKotor: number;
      kerugian: number;
      laba: number;
    };

    const dataMap: Record<string, DailyValue> = {};

    const getKey = (date: Date): string => {
      if (useCustomRange) {
        // Custom range selalu gunakan daily (per hari)
        return date.toISOString().slice(0, 10);
      }
      if (period === "daily") return date.toISOString().slice(0, 10);
      if (period === "monthly") return date.toISOString().slice(0, 7);
      return date.toISOString().slice(0, 4);
    };

    // Inisialisasi semua periode dengan 0
    const cursor = new Date(startDate);
    while (cursor <= today) {
      const key = getKey(cursor);
      if (!dataMap[key]) {
        dataMap[key] = {
          penjualan: 0,
          pembayaranPenjualan: 0,
          pembayaranPiutang: 0,
          piutang: 0,
          pembelian: 0,
          pengeluaran: 0,
          labaKotor: 0,
          kerugian: 0,
          laba: 0,
        };
      }

      // Increment cursor berdasarkan period atau daily untuk custom range
      if (useCustomRange || period === "daily") {
        cursor.setDate(cursor.getDate() + 1);
      } else if (period === "monthly") {
        cursor.setMonth(cursor.getMonth() + 1);
      } else {
        cursor.setFullYear(cursor.getFullYear() + 1);
      }
    }

    const initKey = (key: string) => {
      if (!dataMap[key]) {
        dataMap[key] = {
          penjualan: 0,
          pembayaranPenjualan: 0,
          pembayaranPiutang: 0,
          piutang: 0,
          pembelian: 0,
          pengeluaran: 0,
          labaKotor: 0,
          kerugian: 0,
          laba: 0,
        };
      }
    };

    for (const h of penjualanEntries) {
      const key = getKey(h.tanggal);
      initKey(key);
      dataMap[key].penjualan += h.nominal;
    }

    for (const h of pembayaranPenjualanEntries) {
      const key = getKey(h.tanggal);
      initKey(key);
      dataMap[key].pembayaranPenjualan += h.nominal;
    }

    for (const h of piutangEntries) {
      const key = getKey(h.tanggal);
      initKey(key);
      dataMap[key].pembayaranPiutang += h.nominal;
    }

    for (const h of piutangOutstandingEntries) {
      const key = getKey(h.tanggal);
      initKey(key);
      dataMap[key].piutang += h.nominal;
    }

    for (const p of pembelianHeaders) {
      const key = getKey(p.createdAt);
      initKey(key);
      dataMap[key].pembelian += Number(p.totalHarga);
    }

    for (const e of pengeluaran) {
      const key = getKey(e.tanggalInput);
      initKey(key);
      dataMap[key].pengeluaran += Number(e.jumlah);
    }

    for (const item of pengembalianRusak) {
      const key = getKey(item.tanggalPengembalian);
      initKey(key);
      const hargaBeli = Number(item.barang.hargaBeli);
      const jumlahPerKemasan = Number(item.barang.jumlahPerKemasan);
      const modalDus = hargaBeli * Number(item.jumlahDus);
      const modalPcs =
        jumlahPerKemasan > 0
          ? Math.round((hargaBeli / jumlahPerKemasan) * Number(item.jumlahPcs))
          : 0;
      dataMap[key].kerugian += modalDus + modalPcs;
    }

    for (const item of labaItems) {
      const key = getKey(item.penjualan.tanggalTransaksi);
      initKey(key);
      const jumlahPerKemasan = Number(item.barang?.jumlahPerKemasan || 1);
      const totalPcs = getTotalItemPcs(item, jumlahPerKemasan);
      const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
        totalPcs,
        jumlahPerKemasan,
      );
      const totalQty = jumlahDus + jumlahPcs;
      const labaKotorPerItem =
        (Number(item.hargaJual) - Number(item.hargaBeli)) * totalQty;
      dataMap[key].labaKotor += labaKotorPerItem;
    }

    // Hitung laba bersih
    for (const key in dataMap) {
      dataMap[key].laba =
        dataMap[key].labaKotor -
        dataMap[key].pengeluaran -
        dataMap[key].kerugian;
    }

    const data = Object.entries(dataMap)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, value]) => ({
        date,
        penjualan: value.penjualan,
        pembayaranPenjualan: value.pembayaranPenjualan,
        pembayaranPiutang: value.pembayaranPiutang,
        piutang: value.piutang,
        pembelian: value.pembelian,
        pengeluaran: value.pengeluaran,
        labaKotor: value.labaKotor,
        kerugian: value.kerugian,
        laba: value.laba,
      }));

    const totalPembayaranPenjualan = pembayaranPenjualanEntries.reduce(
      (sum, item) => sum + item.nominal,
      0,
    );
    const totalPembayaranPiutang = piutangEntries.reduce(
      (sum, item) => sum + item.nominal,
      0,
    );
    const totalPiutangOutstanding = piutangOutstandingEntries.reduce(
      (sum, item) => sum + item.nominal,
      0,
    );

    return NextResponse.json(
      deepSerialize({
        success: true,
        data,
        period: useCustomRange ? "daily" : period,
        range,
        useCustomRange,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: today.toISOString().slice(0, 10),
        paymentTotals: {
          penjualan: totalPembayaranPenjualan,
          piutang: totalPembayaranPiutang,
        },
        totalPiutang: totalPiutangOutstanding,
      }),
    );
  } catch (error) {
    console.error("Error grafik:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
