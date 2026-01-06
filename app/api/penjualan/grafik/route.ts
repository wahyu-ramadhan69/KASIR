// app/api/penjualan/summary/route.ts
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

// Deep serialize to handle all BigInt in nested objects
function deepSerialize(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "bigint") {
    return Number(obj);
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepSerialize);
  }

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
    const roleUpper = authData.role?.toUpperCase();
    const isAdmin = roleUpper === "ADMIN";
    const isKasir = roleUpper === "KASIR";
    const userId = Number(authData.userId);
    const shouldFilterByUser = !isAdmin && !Number.isNaN(userId);

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const startDate = new Date();

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

    type PenjualanEntry = {
      tanggal: Date;
      nominal: number;
    };

    let penjualanEntries: PenjualanEntry[] = [];
    let piutangEntries: PenjualanEntry[] = [];
    let piutangOutstandingEntries: PenjualanEntry[] = [];
    let pembayaranPenjualanEntries: PenjualanEntry[] = [];

    if (isKasir) {
      // Fetch data penjualan berdasarkan pembayaran (khusus kasir)
      const pembayaranPenjualan = await prisma.pembayaranPenjualan.findMany({
        where: {
          tanggalBayar: {
            gte: startDate,
            lte: today,
          },
          penjualan: {
            statusTransaksi: "SELESAI",
          },
          jenisPembayaran: "PENJUALAN",
          ...(shouldFilterByUser ? { userId } : {}),
        },
        select: {
          tanggalBayar: true,
          nominal: true,
        },
      });
      penjualanEntries = pembayaranPenjualan.map((item) => ({
        tanggal: item.tanggalBayar,
        nominal: Number(item.nominal),
      }));
      pembayaranPenjualanEntries = penjualanEntries;

      const pembayaranPiutang = await prisma.pembayaranPenjualan.findMany({
        where: {
          tanggalBayar: {
            gte: startDate,
            lte: today,
          },
          penjualan: {
            statusTransaksi: "SELESAI",
          },
          jenisPembayaran: "PIUTANG",
          ...(shouldFilterByUser ? { userId } : {}),
        },
        select: {
          tanggalBayar: true,
          nominal: true,
        },
      });
      piutangEntries = pembayaranPiutang.map((item) => ({
        tanggal: item.tanggalBayar,
        nominal: Number(item.nominal),
      }));

      const piutangOutstanding = await prisma.penjualanHeader.findMany({
        where: {
          tanggalTransaksi: {
            gte: startDate,
            lte: today,
          },
          statusTransaksi: "SELESAI",
          statusPembayaran: "HUTANG",
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
          Number(item.totalHarga) - Number(item.jumlahDibayar || 0)
        ),
      }));
    } else {
      // Fetch data penjualan berdasarkan header (admin/role lain)
      const penjualanHeaders = await prisma.penjualanHeader.findMany({
        where: {
          tanggalTransaksi: {
            gte: startDate,
            lte: today,
          },
          statusTransaksi: "SELESAI",
          ...(shouldFilterByUser ? { userId } : {}),
        },
        select: {
          tanggalTransaksi: true,
          totalHarga: true,
        },
      });
      penjualanEntries = penjualanHeaders.map((item) => ({
        tanggal: item.tanggalTransaksi,
        nominal: Number(item.totalHarga),
      }));

      const pembayaranPenjualan = await prisma.pembayaranPenjualan.findMany({
        where: {
          tanggalBayar: {
            gte: startDate,
            lte: today,
          },
          penjualan: {
            statusTransaksi: "SELESAI",
          },
          jenisPembayaran: "PENJUALAN",
          ...(shouldFilterByUser ? { userId } : {}),
        },
        select: {
          tanggalBayar: true,
          nominal: true,
        },
      });
      pembayaranPenjualanEntries = pembayaranPenjualan.map((item) => ({
        tanggal: item.tanggalBayar,
        nominal: Number(item.nominal),
      }));

      const pembayaranPiutang = await prisma.pembayaranPenjualan.findMany({
        where: {
          tanggalBayar: {
            gte: startDate,
            lte: today,
          },
          jenisPembayaran: "PIUTANG",
          ...(shouldFilterByUser ? { userId } : {}),
        },
        select: {
          tanggalBayar: true,
          nominal: true,
        },
      });
      piutangEntries = pembayaranPiutang.map((item) => ({
        tanggal: item.tanggalBayar,
        nominal: Number(item.nominal),
      }));

      const piutangOutstanding = await prisma.penjualanHeader.findMany({
        where: {
          tanggalTransaksi: {
            gte: startDate,
            lte: today,
          },
          statusTransaksi: "SELESAI",
          statusPembayaran: "HUTANG",
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
          Number(item.totalHarga) - Number(item.jumlahDibayar || 0)
        ),
      }));
    }

    // Fetch data pembelian
    const pembelianHeaders = await prisma.pembelianHeader.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: today,
        },
        statusTransaksi: "SELESAI",
      },
      select: {
        id: true,
        createdAt: true,
        totalHarga: true,
      },
    });

    // Fetch data pengeluaran
    const pengeluaran = await prisma.pengeluaran.findMany({
      where: {
        tanggalInput: {
          gte: startDate,
          lte: today,
        },
        ...(shouldFilterByUser ? { userId } : {}),
      },
      select: {
        tanggalInput: true,
        jumlah: true,
      },
    });

    // Fetch data untuk hitung laba kotor
    const labaItems = await prisma.penjualanItem.findMany({
      where: {
        penjualan: {
          tanggalTransaksi: {
            gte: startDate,
            lte: today,
          },
          statusTransaksi: "SELESAI",
          ...(shouldFilterByUser ? { userId } : {}),
        },
      },
      select: {
        hargaJual: true,
        hargaBeli: true,
        totalItem: true,
        barang: {
          select: {
            jumlahPerKemasan: true,
          },
        },
        penjualan: {
          select: { tanggalTransaksi: true },
        },
      },
    });

    // Fetch data pengembalian barang rusak/kadaluarsa untuk kerugian
    const pengembalianRusak = await prisma.pengembalianBarang.findMany({
      where: {
        tanggalPengembalian: {
          gte: startDate,
          lte: today,
        },
        kondisiBarang: {
          in: ["RUSAK", "KADALUARSA"],
        },
        ...(shouldFilterByUser ? { userId } : {}),
      },
      select: {
        tanggalPengembalian: true,
        jumlahDus: true,
        jumlahPcs: true,
        barang: {
          select: {
            hargaBeli: true,
            jumlahPerKemasan: true,
          },
        },
      },
    });

    type DailyValue = {
      penjualan: number;
      piutang: number;
      pembelian: number;
      pengeluaran: number;
      labaKotor: number;
      kerugian: number;
      laba: number; // ✅ Ini akan dihitung = labaKotor - pengeluaran - kerugian
    };

    const dataMap: Record<string, DailyValue> = {};

    // Helper function untuk generate key berdasarkan period
    const getKey = (date: Date): string => {
      if (period === "daily") {
        return date.toISOString().slice(0, 10); // YYYY-MM-DD
      } else if (period === "monthly") {
        return date.toISOString().slice(0, 7); // YYYY-MM
      } else {
        return date.toISOString().slice(0, 4); // YYYY
      }
    };

    // Inisialisasi semua periode dengan 0
    const cursor = new Date(startDate);
    while (cursor <= today) {
      const key = getKey(cursor);
      if (!dataMap[key]) {
        dataMap[key] = {
          penjualan: 0,
          piutang: 0,
          pembelian: 0,
          pengeluaran: 0,
          labaKotor: 0,
          kerugian: 0,
          laba: 0,
        };
      }

      if (period === "daily") {
        cursor.setDate(cursor.getDate() + 1);
      } else if (period === "monthly") {
        cursor.setMonth(cursor.getMonth() + 1);
      } else {
        cursor.setFullYear(cursor.getFullYear() + 1);
      }
    }

    // Isi data penjualan
    for (const h of penjualanEntries) {
      const key = getKey(h.tanggal);
      if (!dataMap[key]) {
        dataMap[key] = {
          penjualan: 0,
          piutang: 0,
          pembelian: 0,
          pengeluaran: 0,
          labaKotor: 0,
          kerugian: 0,
          laba: 0,
        };
      }
      dataMap[key].penjualan += h.nominal;
    }

    // Isi data total piutang
    for (const h of piutangOutstandingEntries) {
      const key = getKey(h.tanggal);
      if (!dataMap[key]) {
        dataMap[key] = {
          penjualan: 0,
          piutang: 0,
          pembelian: 0,
          pengeluaran: 0,
          labaKotor: 0,
          kerugian: 0,
          laba: 0,
        };
      }
      dataMap[key].piutang += h.nominal;
    }

    // Isi data pembelian
    for (const p of pembelianHeaders) {
      const key = getKey(p.createdAt);
      if (!dataMap[key]) {
        dataMap[key] = {
          penjualan: 0,
          piutang: 0,
          pembelian: 0,
          pengeluaran: 0,
          labaKotor: 0,
          kerugian: 0,
          laba: 0,
        };
      }
      dataMap[key].pembelian += Number(p.totalHarga);
    }

    // Isi data pengeluaran
    for (const e of pengeluaran) {
      const key = getKey(e.tanggalInput);
      if (!dataMap[key]) {
        dataMap[key] = {
          penjualan: 0,
          piutang: 0,
          pembelian: 0,
          pengeluaran: 0,
          labaKotor: 0,
          kerugian: 0,
          laba: 0,
        };
      }
      dataMap[key].pengeluaran += Number(e.jumlah);
    }

    // ✅ Isi data kerugian dari pengembalian barang rusak/kadaluarsa
    for (const item of pengembalianRusak) {
      const key = getKey(item.tanggalPengembalian);
      if (!dataMap[key]) {
        dataMap[key] = {
          penjualan: 0,
          piutang: 0,
          pembelian: 0,
          pengeluaran: 0,
          labaKotor: 0,
          kerugian: 0,
          laba: 0,
        };
      }

      const hargaBeli = Number(item.barang.hargaBeli);
      const jumlahPerKemasan = Number(item.barang.jumlahPerKemasan);
      const modalDus = hargaBeli * Number(item.jumlahDus);
      const modalPcs =
        jumlahPerKemasan > 0
          ? Math.round((hargaBeli / jumlahPerKemasan) * Number(item.jumlahPcs))
          : 0;
      dataMap[key].kerugian += modalDus + modalPcs;
    }

    // ✅ Isi data laba kotor
    for (const item of labaItems) {
      const key = getKey(item.penjualan.tanggalTransaksi);
      if (!dataMap[key]) {
        dataMap[key] = {
          penjualan: 0,
          piutang: 0,
          pembelian: 0,
          pengeluaran: 0,
          labaKotor: 0,
          kerugian: 0,
          laba: 0,
        };
      }

      // Laba Kotor = (hargaJual - hargaBeli) * total quantity
      const jumlahPerKemasan = Number(item.barang?.jumlahPerKemasan || 1);
      const totalPcs = getTotalItemPcs(item, jumlahPerKemasan);
      const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
        totalPcs,
        jumlahPerKemasan
      );
      const totalQty = jumlahDus + jumlahPcs;
      const labaKotorPerItem =
        (Number(item.hargaJual) - Number(item.hargaBeli)) * totalQty;
      dataMap[key].labaKotor += labaKotorPerItem;
    }

    // ✅ HITUNG LABA BERSIH = Laba Kotor - Pengeluaran - Kerugian
    // (setelah semua data terkumpul)
    for (const key in dataMap) {
      dataMap[key].laba =
        dataMap[key].labaKotor -
        dataMap[key].pengeluaran -
        dataMap[key].kerugian;
    }

    // Convert ke array & sort
    const data = Object.entries(dataMap)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, value]) => ({
        date,
        penjualan: value.penjualan,
        piutang: value.piutang,
        pembelian: value.pembelian,
        pengeluaran: value.pengeluaran,
        labaKotor: value.labaKotor,
        kerugian: value.kerugian,
        laba: value.laba, // ✅ Sudah dikurangi pengeluaran
      }));

    const totalPembayaranPenjualan = pembayaranPenjualanEntries.reduce(
      (sum, item) => sum + item.nominal,
      0
    );
    const totalPembayaranPiutang = piutangEntries.reduce(
      (sum, item) => sum + item.nominal,
      0
    );
    const totalPiutangOutstanding = piutangOutstandingEntries.reduce(
      (sum, item) => sum + item.nominal,
      0
    );

    return NextResponse.json(
      deepSerialize({
        success: true,
        data,
        period,
        range,
        paymentTotals: {
          penjualan: totalPembayaranPenjualan,
          piutang: totalPembayaranPiutang,
        },
        totalPiutang: totalPiutangOutstanding,
      })
    );
  } catch (error) {
    console.error("Error summary:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
