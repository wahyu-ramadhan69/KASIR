import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function toNumber(v: any): number {
  if (typeof v === "bigint") return Number(v);
  return Number(v || 0);
}

// GET /api/hutang-lain/pembayaran
// Query: search, startDate, endDate, page, limit
export async function GET(req: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "20"));

    const where: any = {};

    if (search) {
      where.hutangLain = {
        OR: [
          { namaHutang: { contains: search, mode: "insensitive" } },
          { kreditur: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    if (startDate || endDate) {
      where.tanggalBayar = {};
      if (startDate) where.tanggalBayar.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.tanggalBayar.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const [totalCount, data] = await Promise.all([
      prisma.hutangLainPembayaran.count({ where }),
      prisma.hutangLainPembayaran.findMany({
        where,
        orderBy: { tanggalBayar: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          hutangLain: {
            select: {
              id: true,
              namaHutang: true,
              jenisHutang: true,
              kreditur: true,
              jumlahPokok: true,
              jumlahDibayar: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    const serialized = data.map((p) => ({
      ...p,
      jumlahBayar: toNumber(p.jumlahBayar),
      hutangLain: {
        ...p.hutangLain,
        jumlahPokok: toNumber(p.hutangLain.jumlahPokok),
        jumlahDibayar: toNumber(p.hutangLain.jumlahDibayar),
      },
    }));

    return NextResponse.json({
      success: true,
      data: serialized,
      pagination: { page, limit, totalCount, totalPages, hasMore: page < totalPages },
    });
  } catch (error) {
    console.error("[GET /api/hutang-lain/pembayaran]", error);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
