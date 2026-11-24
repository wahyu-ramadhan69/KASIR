// =====================================================
// PATH: app/api/penjualan/[id]/permintaan-edit/route.ts
// KASIR  : ajukan permintaan edit (menunggu approval admin)
// ADMIN  : edit langsung diterapkan (tanpa approval)
// =====================================================
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData } from "@/app/AuthGuard";
import { isBeforeTodayWIB } from "@/app/lib/tanggal";
import {
  deepSerialize,
  editPenjualan,
  EditPenjualanError,
} from "@/app/lib/penjualanEdit";
import {
  buildRingkasanUsulan,
  buildSnapshotSebelum,
  PermintaanPayload,
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

  try {
    const { id } = await params;
    const penjualanId = parseInt(id, 10);
    if (Number.isNaN(penjualanId)) {
      throw new EditPenjualanError("ID penjualan tidak valid", 400);
    }

    const userId = parseInt(authData.userId, 10);
    const body = await request.json();
    const { alasan, ...editBody } = body ?? {};

    // ADMIN: langsung terapkan edit
    if (authData.role === "ADMIN") {
      const result = await editPenjualan(prisma, penjualanId, editBody, {
        actorUserId: userId,
      });
      return NextResponse.json(
        deepSerialize({
          success: true,
          applied: true,
          message: "Penjualan berhasil diupdate",
          data: { penjualan: result?.updated, receipt: result?.receipt },
        }),
      );
    }

    if (authData.role !== "KASIR") {
      return NextResponse.json(
        { success: false, error: "Tidak memiliki akses" },
        { status: 403 },
      );
    }

    // KASIR: buat permintaan edit
    const alasanTrim = typeof alasan === "string" ? alasan.trim() : "";
    if (alasanTrim.length < 5) {
      throw new EditPenjualanError(
        "Alasan edit wajib diisi (minimal 5 karakter)",
        400,
      );
    }

    const pending = await prisma.permintaanEditPenjualan.findFirst({
      where: { penjualanId, status: "PENDING" },
      select: { id: true },
    });
    if (pending) {
      throw new EditPenjualanError(
        "Transaksi ini masih punya permintaan edit yang menunggu approval admin",
        409,
      );
    }

    // Validasi penuh tanpa menyimpan (stok, limit piutang, dll.)
    await editPenjualan(prisma, penjualanId, editBody, {
      dryRun: true,
      actorUserId: userId,
      assertPenjualan: (penjualan) => {
        // Penjualan luar kota (perjalanan sales) punya alur edit sendiri
        if (penjualan.perjalananSalesId) {
          throw new EditPenjualanError(
            "Penjualan luar kota tidak bisa diedit dari sini",
            400,
          );
        }
        if (isBeforeTodayWIB(penjualan.tanggalTransaksi)) {
          throw new EditPenjualanError(
            "Transaksi tanggal sebelumnya tidak bisa diedit",
            403,
          );
        }
        if (
          editBody.tanggalTransaksi &&
          isBeforeTodayWIB(editBody.tanggalTransaksi)
        ) {
          throw new EditPenjualanError(
            "Tanggal transaksi tidak boleh diubah ke tanggal sebelumnya",
            403,
          );
        }
      },
    });

    const [snapshotSebelum, sesudah] = await Promise.all([
      buildSnapshotSebelum(prisma, penjualanId),
      buildRingkasanUsulan(prisma, penjualanId, editBody),
    ]);

    const payload: PermintaanPayload = { data: editBody, sesudah };

    const permintaan = await prisma.permintaanEditPenjualan.create({
      data: {
        penjualanId,
        diajukanOlehId: userId,
        alasan: alasanTrim,
        payload: payload as any,
        snapshotSebelum: snapshotSebelum as any,
      },
      select: { id: true, status: true, createdAt: true },
    });

    return NextResponse.json({
      success: true,
      applied: false,
      message:
        "Permintaan edit terkirim. Perubahan akan diterapkan setelah disetujui admin.",
      data: permintaan,
    });
  } catch (err: any) {
    if (err instanceof EditPenjualanError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.status },
      );
    }
    console.error("Error permintaan edit penjualan:", err);
    return NextResponse.json(
      { success: false, error: "Gagal memproses permintaan edit" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
