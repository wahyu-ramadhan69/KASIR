// =====================================================
// PATH: app/api/permintaan-edit-penjualan/[id]/setujui/route.ts
// ADMIN menyetujui permintaan edit -> edit diterapkan.
// Edit & perubahan status dilakukan dalam SATU transaksi DB.
// =====================================================
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData } from "@/app/AuthGuard";
import {
  deepSerialize,
  editPenjualan,
  EditPenjualanError,
} from "@/app/lib/penjualanEdit";
import type {
  PermintaanPayload,
  PermintaanSnapshot,
} from "@/app/lib/permintaanEdit";

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
      { success: false, error: "Hanya admin yang bisa menyetujui" },
      { status: 403 },
    );
  }

  try {
    const { id } = await params;
    const permintaanId = parseInt(id, 10);
    const adminId = parseInt(authData.userId, 10);
    const body = await request.json().catch(() => ({}));
    const catatan =
      typeof body?.catatan === "string" && body.catatan.trim()
        ? body.catatan.trim()
        : null;

    const permintaan = await prisma.permintaanEditPenjualan.findUnique({
      where: { id: permintaanId },
    });
    if (!permintaan) {
      throw new EditPenjualanError("Permintaan edit tidak ditemukan", 404);
    }
    if (permintaan.status !== "PENDING") {
      throw new EditPenjualanError("Permintaan edit sudah diproses", 409);
    }

    const payload = permintaan.payload as unknown as PermintaanPayload;
    const snapshot = permintaan.snapshotSebelum as unknown as PermintaanSnapshot;

    const result = await editPenjualan(
      prisma,
      permintaan.penjualanId,
      payload.data,
      {
        // pembayaran tercatat atas nama kasir yang mengajukan
        actorUserId: permintaan.diajukanOlehId,
        expectedUpdatedAt: snapshot?.updatedAt
          ? new Date(snapshot.updatedAt)
          : undefined,
        onTransaction: async (tx) => {
          // updateMany + filter status mencegah approve ganda bersamaan
          const res = await tx.permintaanEditPenjualan.updateMany({
            where: { id: permintaanId, status: "PENDING" },
            data: {
              status: "APPROVED",
              diprosesOlehId: adminId,
              diprosesAt: new Date(),
              catatanAdmin: catatan,
            },
          });
          if (res.count === 0) {
            throw new EditPenjualanError("Permintaan edit sudah diproses", 409);
          }
        },
      },
    );

    return NextResponse.json(
      deepSerialize({
        success: true,
        message: "Permintaan edit disetujui dan perubahan sudah diterapkan",
        data: { penjualan: result?.updated, receipt: result?.receipt },
      }),
    );
  } catch (err: any) {
    if (err instanceof EditPenjualanError) {
      return NextResponse.json(
        { success: false, error: err.message, conflict: err.status === 409 },
        { status: err.status },
      );
    }
    console.error("Error menyetujui permintaan edit:", err);
    return NextResponse.json(
      { success: false, error: "Gagal menyetujui permintaan edit" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
