// =====================================================
// PATH: app/api/permintaan-edit-penjualan/[id]/tolak/route.ts
// ADMIN menolak permintaan edit (catatan wajib). Transaksi tidak berubah.
// =====================================================
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData } from "@/app/AuthGuard";

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (authData.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Hanya admin yang bisa menolak" },
      { status: 403 },
    );
  }

  try {
    const { id } = await params;
    const permintaanId = parseInt(id, 10);
    const body = await request.json().catch(() => ({}));
    const catatan = typeof body?.catatan === "string" ? body.catatan.trim() : "";

    if (catatan.length < 3) {
      return NextResponse.json(
        { success: false, error: "Alasan penolakan wajib diisi" },
        { status: 400 },
      );
    }

    const res = await prisma.permintaanEditPenjualan.updateMany({
      where: { id: permintaanId, status: "PENDING" },
      data: {
        status: "REJECTED",
        diprosesOlehId: parseInt(authData.userId, 10),
        diprosesAt: new Date(),
        catatanAdmin: catatan,
      },
    });

    if (res.count === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Permintaan edit tidak ditemukan atau sudah diproses",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Permintaan edit ditolak",
    });
  } catch (error) {
    console.error("Error menolak permintaan edit:", error);
    return NextResponse.json(
      { success: false, error: "Gagal menolak permintaan edit" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
