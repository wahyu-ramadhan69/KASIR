import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const pembayaranId = parseInt(id);
    const body = await request.json();
    const jumlahBayar = parseInt(body.jumlahBayar);

    if (!pembayaranId || Number.isNaN(pembayaranId)) {
      return NextResponse.json(
        { success: false, error: "ID pembayaran tidak valid" },
        { status: 400 }
      );
    }

    if (!jumlahBayar || jumlahBayar <= 0) {
      return NextResponse.json(
        { success: false, error: "Jumlah pembayaran harus lebih dari 0" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const pembayaran = await tx.pembayaranHutangKaryawan.findUnique({
        where: { id: pembayaranId },
      });

      if (!pembayaran) {
        throw new Error("Pembayaran tidak ditemukan");
      }

      const karyawan = await tx.karyawan.findUnique({
        where: { id: pembayaran.karyawanId },
      });

      if (!karyawan || !karyawan.isActive) {
        throw new Error("Karyawan tidak ditemukan");
      }

      const delta = pembayaran.jumlahbayar - jumlahBayar;
      const totalPinjamanBaru = karyawan.totalPinjaman + delta;

      if (totalPinjamanBaru < 0) {
        throw new Error("Total pinjaman tidak boleh kurang dari 0");
      }

      const updatedKaryawan = await tx.karyawan.update({
        where: { id: karyawan.id },
        data: { totalPinjaman: totalPinjamanBaru },
      });

      const updatedPembayaran = await tx.pembayaranHutangKaryawan.update({
        where: { id: pembayaranId },
        data: { jumlahbayar: jumlahBayar },
      });

      return { updatedKaryawan, updatedPembayaran };
    });

    return NextResponse.json({
      success: true,
      message: "Pembayaran berhasil diperbarui",
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memperbarui pembayaran";
    const status =
      message === "Pembayaran tidak ditemukan" ||
      message === "Karyawan tidak ditemukan"
        ? 404
        : message === "Total pinjaman tidak boleh kurang dari 0"
        ? 400
        : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
