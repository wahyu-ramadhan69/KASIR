// =====================================================
// PATH: app/api/permintaan-edit-penjualan/[id]/batal/route.ts
// KASIR membatalkan permintaan edit miliknya yang masih PENDING.
// Permintaan dihapus (belum pernah diterapkan).
// =====================================================
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData } from "@/app/AuthGuard";

const prisma = new PrismaClient();

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const permintaanId = parseInt(id, 10);
    const userId = parseInt(authData.userId, 10);

    const res = await prisma.permintaanEditPenjualan.deleteMany({
      where: {
        id: permintaanId,
        status: "PENDING",
        // Kasir hanya bisa membatalkan miliknya sendiri; admin bebas
        ...(authData.role === "ADMIN" ? {} : { diajukanOlehId: userId }),
      },
    });

    if (res.count === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Permintaan tidak ditemukan atau sudah diproses",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Permintaan edit dibatalkan",
    });
  } catch (error) {
    console.error("Error membatalkan permintaan edit:", error);
    return NextResponse.json(
      { success: false, error: "Gagal membatalkan permintaan edit" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
