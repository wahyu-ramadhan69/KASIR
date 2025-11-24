import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// PUT - Update pengeluaran
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { jenis, jumlah, keterangan } = body;

    // Validasi enum JenisPengeluaran
    const validJenis = ["BAHAN_BAKAR", "UPAH_KULI", "LAINNYA"];
    if (jenis && !validJenis.includes(jenis)) {
      return NextResponse.json(
        { success: false, error: "Jenis pengeluaran tidak valid" },
        { status: 400 }
      );
    }

    const pengeluaran = await prisma.pengeluaran.update({
      where: { id: parseInt(params.id) },
      data: {
        jenis,
        jumlah: parseInt(jumlah),
        keterangan: keterangan || null,
      },
      include: {
        user: true,
      },
    });

    return NextResponse.json(
      { success: true, data: pengeluaran },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating pengeluaran:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mengupdate data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE - Hapus pengeluaran
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.pengeluaran.delete({
      where: { id: parseInt(params.id) },
    });

    return NextResponse.json(
      { success: true, message: "Pengeluaran berhasil dihapus" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting pengeluaran:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat menghapus data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
