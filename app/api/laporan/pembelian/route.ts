// =====================================================
// PATH: app/api/laporan/pembelian/route.ts
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Deep serialize to handle all BigInt in nested objects
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

// Helper to convert BigInt to number safely
function toNumber(value: any): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value || 0);
}

// GET: Ambil laporan pembelian dengan pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");
    const statusPembayaran = searchParams.get("statusPembayaran");
    const supplierId = searchParams.get("supplierId");

    // Build where clause
    const where: any = {
      statusTransaksi: "SELESAI",
    };

    // Filter tanggal - Use createdAt (PembelianHeader doesn't have tanggalTransaksi field)
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Filter status pembayaran
    if (statusPembayaran && statusPembayaran !== "all") {
      where.statusPembayaran = statusPembayaran;
    }

    // Filter supplier
    if (supplierId) {
      where.supplierId = parseInt(supplierId);
    }

    // Search
    if (search) {
      where.OR = [
        { kodePembelian: { contains: search, mode: "insensitive" } },
        {
          supplier: { namaSupplier: { contains: search, mode: "insensitive" } },
        },
      ];
    }

    // Get total count
    const totalCount = await prisma.pembelianHeader.count({ where });

    // Get paginated data
    const skip = (page - 1) * limit;
    const pembelianList = await prisma.pembelianHeader.findMany({
      where,
      include: {
        supplier: true,
        items: {
          include: {
            barang: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    });

    // Hitung statistik untuk page ini
    let totalPembelian = 0;
    let totalDiskon = 0;
    let jumlahItem = 0;
    let totalDus = 0;

    pembelianList.forEach((pembelian) => {
      const totalHarga = toNumber(pembelian.totalHarga);
      const diskonNota = toNumber(pembelian.diskonNota);

      totalPembelian += totalHarga;
      totalDiskon += diskonNota;

      pembelian.items.forEach((item) => {
        const totalItem = toNumber(item.totalItem);
        const jumlahPerKemasan = toNumber(item.barang?.jumlahPerKemasan);
        const jumlahDus =
          jumlahPerKemasan > 0 ? totalItem / jumlahPerKemasan : 0;
        jumlahItem += 1;
        totalDus += jumlahDus;
      });
    });

    // Hitung statistik keseluruhan (untuk filter yang aktif)
    const allPembelian = await prisma.pembelianHeader.findMany({
      where,
      include: {
        items: {
          include: {
            barang: true,
          },
        },
      },
    });

    let totalPembelianAll = 0;
    let totalDiskonAll = 0;
    let jumlahItemAll = 0;
    let totalDusAll = 0;

    allPembelian.forEach((pembelian) => {
      totalPembelianAll += toNumber(pembelian.totalHarga);
      totalDiskonAll += toNumber(pembelian.diskonNota);

      pembelian.items.forEach((item) => {
        jumlahItemAll += 1;
        const totalItem = toNumber(item.totalItem);
        const jumlahPerKemasan = toNumber(item.barang?.jumlahPerKemasan);
        const jumlahDus =
          jumlahPerKemasan > 0 ? totalItem / jumlahPerKemasan : 0;
        totalDusAll += jumlahDus;
      });
    });

    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    const serializedPembelian = pembelianList.map((pembelian) => ({
      ...pembelian,
      items: pembelian.items.map((item: any) => {
        const totalItem = toNumber(item.totalItem);
        const jumlahPerKemasan = toNumber(item.barang?.jumlahPerKemasan);
        const jumlahDus =
          jumlahPerKemasan > 0 ? totalItem / jumlahPerKemasan : 0;

        return {
          ...item,
          totalItem,
          jumlahDus,
          hargaPokok: toNumber(item.hargaPokok),
          diskonPerItem: toNumber(item.diskonPerItem),
        };
      }),
    }));

    return NextResponse.json(
      deepSerialize({
        success: true,
        data: serializedPembelian,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasMore,
        },
        stats: {
          // Stats untuk page ini
          currentPage: {
            totalPembelian,
            totalDiskon,
            jumlahItem,
            totalDus,
          },
          // Stats keseluruhan (filtered)
          overall: {
            totalPembelian: totalPembelianAll,
            totalDiskon: totalDiskonAll,
            jumlahTransaksi: allPembelian.length,
            jumlahItem: jumlahItemAll,
            totalDus: totalDusAll,
          },
        },
      })
    );
  } catch (error) {
    console.error("Error fetching laporan pembelian:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data laporan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
