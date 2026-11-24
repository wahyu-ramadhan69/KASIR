// =====================================================
// PATH: app/api/permintaan-edit-penjualan/route.ts
// GET daftar permintaan edit penjualan
//   ADMIN : semua permintaan
//   KASIR : hanya permintaan miliknya
// Query: status=PENDING|APPROVED|REJECTED|all, page, limit
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

    const [list, totalCount, pendingCount] = await Promise.all([
      prisma.permintaanEditPenjualan.findMany({
        where,
        // PENDING: paling lama dulu (antrian); lainnya: terbaru dulu
        orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
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
