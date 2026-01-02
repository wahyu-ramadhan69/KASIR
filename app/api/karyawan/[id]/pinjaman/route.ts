import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const karyawanId = parseInt(id);
    const body = await request.json();
    const jumlahPinjaman = parseInt(body.jumlahPinjaman);

    if (!jumlahPinjaman || jumlahPinjaman <= 0) {
      return NextResponse.json(
        { success: false, error: "Jumlah pinjaman harus lebih dari 0" },
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

      const updatedKaryawan = await tx.karyawan.update({
        where: { id: karyawanId },
        data: {
          totalPinjaman: karyawan.totalPinjaman + jumlahPinjaman,
        },
      });

      const pinjaman = await tx.pinjamanKaryawan.create({
        data: {
          karyawanId,
          jumlahPinjaman,
        },
      });

      return { karyawan: updatedKaryawan, pinjaman };
    });

    return NextResponse.json({
      success: true,
      message: "Pinjaman karyawan berhasil ditambahkan",
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menambahkan pinjaman";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const karyawanId = parseInt(id);

    if (!karyawanId || Number.isNaN(karyawanId)) {
      return NextResponse.json(
        { success: false, error: "ID karyawan tidak valid" },
        { status: 400 }
      );
    }

    const pinjaman = await prisma.pinjamanKaryawan.findMany({
      where: { karyawanId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: pinjaman });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Gagal mengambil riwayat pinjaman" },
      { status: 500 }
    );
  }
}
