import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    const pembayaran = await prisma.pembayaranHutangKaryawan.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        karyawan: {
          select: { id: true, nama: true, nik: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: pembayaran });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Gagal mengambil riwayat pembayaran" },
      { status: 500 }
    );
  }
}
