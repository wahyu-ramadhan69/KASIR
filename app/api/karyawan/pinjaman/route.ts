import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");

    const pinjaman = await prisma.pinjamanKaryawan.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        karyawan: {
          select: { id: true, nama: true, nik: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: pinjaman });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Gagal mengambil riwayat pinjaman" },
      { status: 500 }
    );
  }
}
