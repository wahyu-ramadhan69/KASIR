// app/api/barang/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type RouteCtx = {
  params: Promise<{ id: string }>;
};

function parseId(id: string | undefined) {
  const num = Number(id);
  if (!id || Number.isNaN(num)) return null;
  return num;
}

// (opsional) GET detail barang per ID
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const idNum = parseId(id);

  if (idNum === null) {
    return NextResponse.json(
      { success: false, error: "ID tidak valid" },
      { status: 400 }
    );
  }

  try {
    const barang = await prisma.barang.findUnique({
      where: { id: idNum },
      include: { supplier: true },
    });

    if (!barang) {
      return NextResponse.json(
        { success: false, error: "Barang tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: barang }, { status: 200 });
  } catch (error) {
    console.error("Error fetching barang:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mengambil data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// UPDATE / EDIT Barang
export async function PUT(request: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const idNum = parseId(id);

  if (idNum === null) {
    return NextResponse.json(
      { success: false, error: "ID tidak valid" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const {
      namaBarang,
      hargaBeli,
      hargaJual,
      stok,
      jumlahPerkardus,
      ukuran,
      satuan,
      supplierId,
    } = body;

    if (
      !namaBarang ||
      hargaBeli == null ||
      hargaJual == null ||
      jumlahPerkardus == null ||
      ukuran == null ||
      !satuan ||
      supplierId == null
    ) {
      return NextResponse.json(
        { success: false, error: "Semua field wajib diisi" },
        { status: 400 }
      );
    }

    const barang = await prisma.barang.update({
      where: { id: idNum },
      data: {
        namaBarang: String(namaBarang).trim(),
        hargaBeli: Number(hargaBeli),
        hargaJual: Number(hargaJual),
        stok: stok == null ? 0 : Number(stok),
        jumlahPerkardus: Number(jumlahPerkardus),
        ukuran: Number(ukuran),
        satuan: String(satuan).trim(),
        supplierId: Number(supplierId),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Barang berhasil diperbarui",
        data: barang,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating barang:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat memperbarui barang" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
