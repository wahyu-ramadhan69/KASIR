import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// GET semua kategori
export async function GET() {
  try {
    const data = await prisma.kategoriBarang.findMany({
      orderBy: { namaKategori: "asc" },
      include: { _count: { select: { barang: true } } },
    });
    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error("Error fetching kategori:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST buat kategori baru
export async function POST(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { namaKategori, deskripsi } = body;

    if (!namaKategori?.trim()) {
      return NextResponse.json(
        { success: false, error: "Nama kategori wajib diisi" },
        { status: 400 }
      );
    }

    const data = await prisma.kategoriBarang.create({
      data: {
        namaKategori: String(namaKategori).trim(),
        deskripsi: deskripsi ? String(deskripsi).trim() : null,
      },
    });

    return NextResponse.json(
      { success: true, message: "Kategori berhasil dibuat", data },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Nama kategori sudah ada" },
        { status: 409 }
      );
    }
    console.error("Error creating kategori:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
