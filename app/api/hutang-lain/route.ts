import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function toNumber(v: any): number {
  if (typeof v === "bigint") return Number(v);
  return Number(v || 0);
}

function serialize(h: any) {
  return {
    ...h,
    jumlahPokok: toNumber(h.jumlahPokok),
    jumlahDibayar: toNumber(h.jumlahDibayar),
    pembayaran: h.pembayaran?.map((p: any) => ({
      ...p,
      jumlahBayar: toNumber(p.jumlahBayar),
    })),
  };
}

// GET /api/hutang-lain
// Query: status, jenis, search, startDate, endDate, page, limit
export async function GET(req: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const jenis = searchParams.get("jenis");
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "20"));

    const where: any = {};

    if (status && status !== "all") where.status = status;
    if (jenis && jenis !== "all") where.jenisHutang = jenis;
    if (search) {
      where.OR = [
        { namaHutang: { contains: search, mode: "insensitive" } },
        { kreditur: { contains: search, mode: "insensitive" } },
      ];
    }
    if (startDate || endDate) {
      where.tanggalMulai = {};
      if (startDate) where.tanggalMulai.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.tanggalMulai.lte = new Date(`${endDate}T00:00:00.000Z`);
    }

    const [totalCount, data] = await Promise.all([
      prisma.hutangLain.count({ where }),
      prisma.hutangLain.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { pembayaran: { orderBy: { tanggalBayar: "desc" } } },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      data: data.map(serialize),
      pagination: { page, limit, totalCount, totalPages, hasMore: page < totalPages },
    });
  } catch (error) {
    console.error("[GET /api/hutang-lain]", error);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/hutang-lain
export async function POST(req: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { namaHutang, jenisHutang, kreditur, jumlahPokok, tanggalMulai, tanggalJatuhTempo, keterangan } = body;

    if (!namaHutang || !jenisHutang || !kreditur || !jumlahPokok || !tanggalMulai) {
      return NextResponse.json(
        { success: false, error: "Field namaHutang, jenisHutang, kreditur, jumlahPokok, tanggalMulai wajib diisi" },
        { status: 400 }
      );
    }

    const hutang = await prisma.hutangLain.create({
      data: {
        namaHutang,
        jenisHutang,
        kreditur,
        jumlahPokok: BigInt(jumlahPokok),
        tanggalMulai: new Date(`${tanggalMulai}T00:00:00.000Z`),
        tanggalJatuhTempo: tanggalJatuhTempo
          ? new Date(`${tanggalJatuhTempo}T00:00:00.000Z`)
          : null,
        keterangan: keterangan || null,
      },
      include: { pembayaran: true },
    });

    return NextResponse.json({ success: true, data: serialize(hutang) }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/hutang-lain]", error);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
