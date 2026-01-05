import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const karyawanId = parseInt(id);
    const body = await request.json();
    const jumlahBayar = parseInt(body.jumlahBayar);

    if (!jumlahBayar || jumlahBayar <= 0) {
      return NextResponse.json(
        { success: false, error: "Jumlah pembayaran harus lebih dari 0" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const karyawan = await tx.karyawan.findUnique({
        where: { id: karyawanId },
      });

      if (!karyawan || !karyawan.isActive) {
        throw new Error("Karyawan tidak ditemukan");
      }

      const sisaHutang = Math.max(0, karyawan.totalPinjaman);
      if (sisaHutang <= 0) {
        throw new Error("Karyawan tidak memiliki hutang");
      }

      const pembayaranEfektif = Math.min(jumlahBayar, sisaHutang);
      const kembalian = Math.max(0, jumlahBayar - sisaHutang);

      const updatedKaryawan = await tx.karyawan.update({
        where: { id: karyawanId },
        data: {
          totalPinjaman: sisaHutang - pembayaranEfektif,
        },
      });

      const pembayaran = await tx.pembayaranHutangKaryawan.create({
        data: {
          karyawanId,
          jumlahbayar: pembayaranEfektif,
        },
      });

      return {
        karyawan: updatedKaryawan,
        pembayaran,
        pembayaranEfektif,
        kembalian,
        sisaHutangSebelum: sisaHutang,
        sisaHutangSesudah: sisaHutang - pembayaranEfektif,
      };
    });

    return NextResponse.json({
      success: true,
      message:
        result.sisaHutangSesudah <= 0
          ? "Hutang karyawan berhasil dilunasi"
          : "Pembayaran hutang berhasil",
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal melakukan pembayaran";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
