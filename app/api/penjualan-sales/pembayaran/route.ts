// =====================================================
// PATH: app/api/penjualan-sales/pembayaran/route.ts
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData } from "@/app/AuthGuard";

const prisma = new PrismaClient();

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

// GET: Ambil data pembayaran penjualan sales (dari tabel PembayaranPenjualan)
export async function GET(request: NextRequest) {
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Default: hari ini jika tidak ada filter tanggal
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const tanggalBayarFilter: any = {};
    if (startDate) {
      tanggalBayarFilter.gte = new Date(startDate);
    } else {
      tanggalBayarFilter.gte = todayStart;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      tanggalBayarFilter.lte = end;
    } else if (!startDate) {
      tanggalBayarFilter.lte = todayEnd;
    }

    // Base filter: hanya pembayaran untuk penjualan sales yang tidak dihapus
    const whereClause: any = {
      tanggalBayar: tanggalBayarFilter,
      penjualan: {
        karyawan: { jenis: "SALES" },
        isDeleted: false,
        statusTransaksi: "SELESAI",
      },
    };

    if (search) {
      whereClause.OR = [
        {
          penjualan: {
            kodePenjualan: { contains: search, mode: "insensitive" },
          },
        },
        {
          penjualan: {
            namaCustomer: { contains: search, mode: "insensitive" },
          },
        },
        {
          penjualan: {
            namaSales: { contains: search, mode: "insensitive" },
          },
        },
        {
          penjualan: {
            customer: { nama: { contains: search, mode: "insensitive" } },
          },
        },
        {
          penjualan: {
            karyawan: { nama: { contains: search, mode: "insensitive" } },
          },
        },
      ];
    }

    const [totalCount, totalAgg, pembayaranList] = await Promise.all([
      prisma.pembayaranPenjualan.count({ where: whereClause }),
      prisma.pembayaranPenjualan.aggregate({
        where: whereClause,
        _sum: { nominal: true },
      }),
      prisma.pembayaranPenjualan.findMany({
        where: whereClause,
        include: {
          penjualan: {
            select: {
              id: true,
              kodePenjualan: true,
              tanggalTransaksi: true,
              totalHarga: true,
              jumlahDibayar: true,
              statusPembayaran: true,
              namaCustomer: true,
              customer: {
                select: { id: true, nama: true, namaToko: true },
              },
              karyawan: {
                select: { id: true, nama: true, noHp: true },
              },
            },
          },
        },
        orderBy: { tanggalBayar: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const totalNominal = Number(totalAgg._sum.nominal || 0);
    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return NextResponse.json(
      deepSerialize({
        success: true,
        data: pembayaranList,
        summary: {
          totalPembayaran: totalCount,
          totalNominal,
        },
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
    console.error("Error fetching pembayaran penjualan sales:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil data pembayaran penjualan sales",
      },
      { status: 500 }
    );
  }
}
