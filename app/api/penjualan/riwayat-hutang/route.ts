import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData, isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Deep serialize to handle BigInt in nested objects
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

export async function GET(req: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const authData = await getAuthData();
    const isAdmin = authData?.role === "ADMIN";
    const { searchParams } = req.nextUrl;

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "20", 10));
    const skip = (page - 1) * limit;

    const search = searchParams.get("search") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const summary = searchParams.get("summary") === "1";

    const where: any = {
      jenisPembayaran: { in: ["PIUTANG", "HUTANG"] },
      penjualan: { isDeleted: false },
    };

    if (!isAdmin && authData?.userId) {
      where.userId = parseInt(authData.userId, 10);
    }

    if (startDate || endDate) {
      where.tanggalBayar = {};
      if (startDate) {
        where.tanggalBayar.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.tanggalBayar.lte = end;
      }
    }

    if (search) {
      where.OR = [
        { kodePembayaran: { contains: search, mode: "insensitive" } },
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
            customer: {
              nama: { contains: search, mode: "insensitive" },
            },
          },
        },
      ];
    }

    if (summary) {
      const totalTransaksi = await prisma.pembayaranPenjualan.count({ where });
      const agg = await prisma.pembayaranPenjualan.aggregate({
        where,
        _sum: { nominal: true, totalCash: true, totalTransfer: true },
      });

      return NextResponse.json(
        deepSerialize({
          success: true,
          summary: {
            totalTransaksi,
            totalPembayaran: Number(agg._sum.nominal || 0),
            totalCash: Number(agg._sum.totalCash || 0),
            totalTransfer: Number(agg._sum.totalTransfer || 0),
          },
        })
      );
    }

    const totalCount = await prisma.pembayaranPenjualan.count({ where });
    const pembayaranList = await prisma.pembayaranPenjualan.findMany({
      where,
      include: {
        penjualan: {
          include: {
            customer: true,
            karyawan: true,
            items: {
              include: { barang: true },
              orderBy: { id: "asc" },
            },
          },
        },
      },
      orderBy: { tanggalBayar: "desc" },
      skip,
      take: limit,
    });

    const data = pembayaranList.map((pembayaran) => ({
      ...pembayaran.penjualan,
      pembayaranId: pembayaran.id,
      kodePembayaran: pembayaran.kodePembayaran,
      tanggalBayar: pembayaran.tanggalBayar,
      nominal: Number(pembayaran.nominal || 0),
      totalCash: Number(pembayaran.totalCash || 0),
      totalTransfer: Number(pembayaran.totalTransfer || 0),
      jenisPembayaran: pembayaran.jenisPembayaran,
      catatan: pembayaran.catatan,
      metodePembayaran: pembayaran.metode,
    }));

    return NextResponse.json(
      deepSerialize({
        success: true,
        data,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: skip + limit < totalCount,
        },
      })
    );
  } catch (error: any) {
    console.error("Error fetching riwayat pembayaran hutang:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
