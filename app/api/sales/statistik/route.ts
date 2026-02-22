import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData, isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

export async function GET() {
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

    const baseWhere = { createdById: userId };

    const [approved, rejected, pending] = await Promise.all([
      prisma.penjualanHeader.count({
        where: { ...baseWhere, statusApproval: "APPROVED" },
      }),
      prisma.penjualanHeader.count({
        where: { ...baseWhere, statusApproval: "REJECTED" },
      }),
      prisma.penjualanHeader.count({
        where: { ...baseWhere, statusApproval: "PENDING" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        approved,
        rejected,
        pending,
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
