// app/api/barang/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// CREATE Barang
export async function POST(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const barang = await prisma.barang.create({
      data: {
        namaBarang: String(namaBarang).trim(),
        hargaBeli: Number(hargaBeli),
        hargaJual: Number(hargaJual),
        jumlahPerkardus: Number(jumlahPerkardus),
        ukuran: Number(ukuran),
        satuan: String(satuan).trim(),
        supplierId: Number(supplierId),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Barang berhasil ditambahkan",
        data: barang,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating barang:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat menambahkan barang" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET semua barang (opsional, sekalian dibuat)
export async function GET() {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const barang = await prisma.barang.findMany({
      orderBy: { id: "desc" },
      include: {
        supplier: true,
      },
    });

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
