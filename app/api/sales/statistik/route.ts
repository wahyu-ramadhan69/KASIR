import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData, isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const authData = await getAuthData();
    if (!authData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = Number(authData.userId);
    if (Number.isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: "User tidak valid" },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const dateFilter =
      startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate
                ? { lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) }
                : {}),
            },
          }
        : {};

    const baseWhere = { createdById: userId, ...dateFilter };

    const approvedWhere = { ...baseWhere, statusApproval: "APPROVED" };

    const [approved, rejected, pending, totalAggregate, setoranAggregate] = await Promise.all([
      prisma.penjualanHeader.count({ where: approvedWhere }),
      prisma.penjualanHeader.count({ where: { ...baseWhere, statusApproval: "REJECTED" } }),
      prisma.penjualanHeader.count({ where: { ...baseWhere, statusApproval: "PENDING" } }),
      prisma.penjualanHeader.aggregate({
        where: approvedWhere,
        _sum: { totalHarga: true },
      }),
      prisma.penjualanHeader.aggregate({
        where: approvedWhere,
        _sum: { jumlahDibayar: true },
      }),
    ]);

    const totalNominal = Number(totalAggregate._sum.totalHarga ?? 0);
    const totalSetoran = Number(setoranAggregate._sum.jumlahDibayar ?? 0);

    return NextResponse.json({
      success: true,
      data: {
        approved,
        rejected,
        pending,
        totalNominal,
        totalSetoran,
      },
    });
  } catch (err: any) {
    console.error("Error fetching statistik sales:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil statistik sales" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
