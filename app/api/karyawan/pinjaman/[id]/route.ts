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
    const pinjamanId = parseInt(id);
    const body = await request.json();
    const jumlahPinjaman = parseInt(body.jumlahPinjaman);

    if (!pinjamanId || Number.isNaN(pinjamanId)) {
      return NextResponse.json(
        { success: false, error: "ID pinjaman tidak valid" },
        { status: 400 }
      );
    }

    if (!jumlahPinjaman || jumlahPinjaman <= 0) {
      return NextResponse.json(
        { success: false, error: "Jumlah pinjaman harus lebih dari 0" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const pinjaman = await tx.pinjamanKaryawan.findUnique({
        where: { id: pinjamanId },
      });

      if (!pinjaman) {
        throw new Error("Pinjaman tidak ditemukan");
      }

      const karyawan = await tx.karyawan.findUnique({
        where: { id: pinjaman.karyawanId },
      });

      if (!karyawan || !karyawan.isActive) {
        throw new Error("Karyawan tidak ditemukan");
      }

      const delta = jumlahPinjaman - pinjaman.jumlahPinjaman;
      const totalPinjamanBaru = karyawan.totalPinjaman + delta;

      if (totalPinjamanBaru < 0) {
        throw new Error("Total pinjaman tidak boleh kurang dari 0");
      }

      const updatedKaryawan = await tx.karyawan.update({
        where: { id: karyawan.id },
        data: { totalPinjaman: totalPinjamanBaru },
      });

      const updatedPinjaman = await tx.pinjamanKaryawan.update({
        where: { id: pinjamanId },
        data: { jumlahPinjaman },
      });

      return { updatedKaryawan, updatedPinjaman };
    });

    return NextResponse.json({
      success: true,
      message: "Pinjaman berhasil diperbarui",
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memperbarui pinjaman";
    const status =
      message === "Pinjaman tidak ditemukan" ||
      message === "Karyawan tidak ditemukan"
        ? 404
        : message === "Total pinjaman tidak boleh kurang dari 0"
        ? 400
        : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
