import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function bigIntToNumber(value: bigint | number | null): number {
  if (typeof value === "bigint") {
    return Number(value);
  }
  return value ?? 0;
}

export async function GET() {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await prisma.customer.aggregate({
      _sum: {
        piutang: true,
        limit_piutang: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        totalPiutang: bigIntToNumber(summary._sum.piutang),
        totalLimitPiutang: bigIntToNumber(summary._sum.limit_piutang),
      },
    });
  } catch (err) {
    console.error("Error fetching customer summary:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mengambil summary" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
