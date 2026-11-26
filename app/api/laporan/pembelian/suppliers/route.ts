// =====================================================
// PATH: app/api/laporan/pembelian/suppliers/route.ts
// Daftar supplier untuk filter laporan pembelian.
// Termasuk supplier nonaktif yang pernah punya pembelian.
// =====================================================
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

export async function GET() {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const suppliers = await prisma.supplier.findMany({
      where: {
        OR: [{ isActive: true }, { pembelian: { some: {} } }],
      },
      select: { id: true, namaSupplier: true, isActive: true },
      orderBy: { namaSupplier: "asc" },
    });
    return NextResponse.json({ success: true, data: suppliers });
  } catch (error) {
    console.error("Error fetching supplier laporan pembelian:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil daftar supplier" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
