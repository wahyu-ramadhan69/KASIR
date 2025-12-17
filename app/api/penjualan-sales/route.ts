// =====================================================
// PATH: app/api/penjualan-sales/route.ts
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

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

// Helper function untuk menghitung total penjualan
const calculatePenjualan = (items: any[], diskonNota: number = 0) => {
  let subtotal = 0;
  let totalDiskonItem = 0;

  const calculatedItems = items.map((item) => {
    const jumlahDus =
      typeof item.jumlahDus === "bigint"
        ? Number(item.jumlahDus)
        : item.jumlahDus;
    const jumlahPcs =
      typeof item.jumlahPcs === "bigint"
        ? Number(item.jumlahPcs)
        : item.jumlahPcs;
    const hargaJual =
      typeof item.hargaJual === "bigint"
        ? Number(item.hargaJual)
        : item.hargaJual;
    const diskonPerItem =
      typeof item.diskonPerItem === "bigint"
        ? Number(item.diskonPerItem)
        : item.diskonPerItem;
    const jumlahPerKemasan =
      typeof item.barang?.jumlahPerKemasan === "bigint"
        ? Number(item.barang.jumlahPerKemasan)
        : item.barang?.jumlahPerKemasan || 1;

    const totalPcs = jumlahDus * jumlahPerKemasan + (jumlahPcs || 0);
    const hargaTotal = hargaJual * jumlahDus;
    const hargaPcs =
      jumlahPcs > 0 ? Math.round((hargaJual / jumlahPerKemasan) * jumlahPcs) : 0;
    const totalHargaSebelumDiskon = hargaTotal + hargaPcs;
    const diskon = diskonPerItem * jumlahDus;

    subtotal += totalHargaSebelumDiskon;
    totalDiskonItem += diskon;

    return {
      ...item,
      totalPcs,
      totalHargaSebelumDiskon,
      totalDiskon: diskon,
      subtotalItem: totalHargaSebelumDiskon - diskon,
    };
  });

  const totalHarga = subtotal - totalDiskonItem - diskonNota;

  return {
    items: calculatedItems,
    ringkasan: {
      subtotal,
      totalDiskonItem,
      diskonNota,
      totalHarga: Math.max(0, totalHarga),
    },
  };
};

// GET: Ambil penjualan sales (dengan karyawan jenis SALES) dengan filter dan pagination
export async function GET(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const status = searchParams.get("status");
    const pembayaran = searchParams.get("pembayaran");
    const karyawanId = searchParams.get("karyawanId");
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = {
      // Filter hanya penjualan dengan karyawan jenis SALES
      karyawan: {
        jenis: "SALES",
      },
    };

    if (status && status !== "all") {
      where.statusTransaksi = status;
    }

    if (pembayaran && pembayaran !== "all") {
      where.statusPembayaran = pembayaran;
    }

    if (karyawanId) {
      where.karyawanId = parseInt(karyawanId);
    }

    if (search) {
      where.OR = [
        { kodePenjualan: { contains: search, mode: "insensitive" } },
        { namaCustomer: { contains: search, mode: "insensitive" } },
        { namaSales: { contains: search, mode: "insensitive" } },
        { customer: { nama: { contains: search, mode: "insensitive" } } },
        { customer: { namaToko: { contains: search, mode: "insensitive" } } },
        { karyawan: { nama: { contains: search, mode: "insensitive" } } },
      ];
    }

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

    const totalCount = await prisma.penjualanHeader.count({ where });

    let orderBy: any;
    if (pembayaran === "HUTANG") {
      // Sort by tanggalJatuhTempo, nulls last, then by tanggalTransaksi desc
      orderBy = [
        { tanggalJatuhTempo: { sort: "asc", nulls: "last" } },
        { tanggalTransaksi: "desc" },
      ];
    } else {
      orderBy = { tanggalTransaksi: "desc" };
    }

    const penjualan = await prisma.penjualanHeader.findMany({
      where,
      include: {
        customer: true,
        karyawan: true,
        perjalananSales: {
          include: {
            karyawan: true,
          },
        },
        items: {
          include: {
            barang: true,
          },
          orderBy: { id: "asc" },
        },
      },
      orderBy,
      skip,
      take: limit,
    });

    const penjualanWithCalculation = penjualan.map((p) => ({
      ...p,
      calculation: calculatePenjualan(p.items, Number(p.diskonNota)),
    }));

    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return NextResponse.json(
      deepSerialize({
        success: true,
        data: penjualanWithCalculation,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasMore,
        },
      })
    );
  } catch (err) {
    console.error("Error fetching penjualan sales:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data penjualan sales" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
