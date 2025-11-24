import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - Mengambil semua pengeluaran
export async function GET() {
  try {
    const pengeluaran = await prisma.pengeluaran.findMany({
      orderBy: { id: "desc" },
      include: {
        user: true,
      },
    });

    return NextResponse.json(
      { success: true, data: pengeluaran },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching pengeluaran:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mengambil data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST - Menambah pengeluaran baru
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jenis, jumlah, keterangan, userId } = body;

    // Validasi input
    if (!jenis || !jumlah || !userId) {
      return NextResponse.json(
        { success: false, error: "Jenis, jumlah, dan userId harus diisi" },
        { status: 400 }
      );
    }

    // Validasi enum JenisPengeluaran
    const validJenis = ["BAHAN_BAKAR", "UPAH_KULI", "LAINNYA"];
    if (!validJenis.includes(jenis)) {
      return NextResponse.json(
        { success: false, error: "Jenis pengeluaran tidak valid" },
        { status: 400 }
      );
    }

    const pengeluaran = await prisma.pengeluaran.create({
      data: {
        jenis,
        jumlah: parseInt(jumlah),
        keterangan: keterangan || null,
        userId: parseInt(userId),
      },
      include: {
        user: true,
      },
    });

    return NextResponse.json(
      { success: true, data: pengeluaran },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating pengeluaran:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat menambahkan data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
