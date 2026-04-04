import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

type RouteCtx = { params: Promise<{ id: string }> };

function parseId(id: string | undefined) {
  const num = Number(id);
  return !id || Number.isNaN(num) ? null : num;
}

// PUT update kategori
export async function PUT(request: NextRequest, { params }: RouteCtx) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const idNum = parseId(id);
  if (idNum === null) {
    return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });
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

    const data = await prisma.kategoriBarang.update({
      where: { id: idNum },
      data: {
        namaKategori: String(namaKategori).trim(),
        deskripsi: deskripsi ? String(deskripsi).trim() : null,
      },
    });

    return NextResponse.json(
      { success: true, message: "Kategori berhasil diupdate", data },
      { status: 200 }
    );
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Nama kategori sudah ada" },
        { status: 409 }
      );
    }
    console.error("Error updating kategori:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE kategori
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const idNum = parseId(id);
  if (idNum === null) {
    return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });
  }

  try {
    // Lepaskan relasi barang sebelum hapus (set kategoriId = null)
    await prisma.barang.updateMany({
      where: { kategoriId: idNum },
      data: { kategoriId: null },
    });

    await prisma.kategoriBarang.delete({ where: { id: idNum } });

    return NextResponse.json(
      { success: true, message: "Kategori berhasil dihapus" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting kategori:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
