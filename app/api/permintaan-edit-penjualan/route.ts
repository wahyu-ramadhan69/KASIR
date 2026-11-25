// =====================================================
// PATH: app/api/permintaan-edit-penjualan/route.ts
// GET daftar permintaan edit penjualan
//   ADMIN : semua permintaan
//   KASIR : hanya permintaan miliknya
// Query: status=PENDING|APPROVED|REJECTED|all, page, limit,
//        tipe=TOKO|SALES, startDate & endDate (YYYY-MM-DD, WIB)
//        Tanggal memfilter: PENDING -> createdAt (diajukan),
//                           APPROVED/REJECTED -> diprosesAt (diproses admin)
// =====================================================
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { getAuthData } from "@/app/AuthGuard";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (authData.role !== "ADMIN" && authData.role !== "KASIR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "PENDING";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20")),
    );
    const skip = (page - 1) * limit;

    const where: Prisma.PermintaanEditPenjualanWhereInput = {};
    if (status === "PENDING" || status === "APPROVED" || status === "REJECTED") {
      where.status = status;
    }
    if (authData.role === "KASIR") {
      where.diajukanOlehId = parseInt(authData.userId, 10);
    }

    // Filter tipe penjualan: toko (tanpa sales) / sales
    const tipe = searchParams.get("tipe");
    if (tipe === "TOKO") {
      where.penjualan = { karyawanId: null };
    } else if (tipe === "SALES") {
      where.penjualan = { karyawanId: { not: null } };
    }

    // Filter tanggal (WIB)
    const isYmd = (v: string | null): v is string =>
      !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    if (isYmd(startDate) || isYmd(endDate)) {
      const range: Prisma.DateTimeFilter = {};
      if (isYmd(startDate)) range.gte = new Date(`${startDate}T00:00:00+07:00`);
      if (isYmd(endDate)) range.lte = new Date(`${endDate}T23:59:59.999+07:00`);
      if (status === "APPROVED" || status === "REJECTED") {
        where.diprosesAt = range;
      } else {
        where.createdAt = range;
      }
    }

    const [list, totalCount, pendingCount] = await Promise.all([
      prisma.permintaanEditPenjualan.findMany({
        where,
        // PENDING: paling lama dulu (antrian); lainnya: terbaru diproses dulu
        orderBy:
          status === "PENDING"
            ? [{ createdAt: "asc" }, { id: "asc" }]
            : status === "APPROVED" || status === "REJECTED"
              ? [{ diprosesAt: "desc" }, { id: "desc" }]
              : [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
        include: {
          penjualan: {
            select: {
              id: true,
              kodePenjualan: true,
              tanggalTransaksi: true,
              isDeleted: true,
            },
          },
          diajukanOleh: { select: { id: true, username: true } },
          diprosesOleh: { select: { id: true, username: true } },
        },
      }),
      prisma.permintaanEditPenjualan.count({ where }),
      prisma.permintaanEditPenjualan.count({
        where: {
          status: "PENDING",
          ...(authData.role === "KASIR"
            ? { diajukanOlehId: parseInt(authData.userId, 10) }
            : {}),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: list,
      pendingCount,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + list.length < totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching permintaan edit:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil permintaan edit" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
