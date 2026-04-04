// app/api/barang/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function bigIntToNumber(value: bigint | number): number {
  return typeof value === "bigint" ? Number(value) : value;
}

function serializeBarang(barang: any) {
  return {
    ...barang,
    hargaBeli: bigIntToNumber(barang.hargaBeli),
    hargaJual: bigIntToNumber(barang.hargaJual),
    stok: bigIntToNumber(barang.stok),
    jumlahPerKemasan: bigIntToNumber(barang.jumlahPerKemasan),
    berat: bigIntToNumber(barang.berat),
    limitStok: bigIntToNumber(barang.limitStok),
    limitPenjualan: bigIntToNumber(barang.limitPenjualan),
    supplier: barang.supplier
      ? {
          ...barang.supplier,
          limitHutang: bigIntToNumber(barang.supplier.limitHutang),
          hutang: bigIntToNumber(barang.supplier.hutang),
        }
      : undefined,
  };
}

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
      jenisKemasan,
      jumlahPerKemasan,
      supplierId,
      berat,
      limitPenjualan,
      kategoriId,
      gambar,
      tampilDiHalaman,
    } = body;

    if (
      !namaBarang ||
      hargaBeli == null ||
      hargaJual == null ||
      !jenisKemasan ||
      jumlahPerKemasan == null ||
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
        hargaBeli: BigInt(hargaBeli),
        hargaJual: BigInt(hargaJual),
        stok: stok != null ? BigInt(stok) : BigInt(0),
        jenisKemasan: String(jenisKemasan).trim(),
        jumlahPerKemasan: BigInt(jumlahPerKemasan),
        supplierId: Number(supplierId),
        berat: berat != null ? BigInt(berat) : BigInt(0),
        limitPenjualan: limitPenjualan != null ? BigInt(limitPenjualan) : BigInt(0),
        kategoriId: kategoriId ? Number(kategoriId) : null,
        gambar: gambar ? String(gambar).trim() : null,
        tampilDiHalaman: tampilDiHalaman === true,
      },
      include: { supplier: true, kategori: true },
    });

    return NextResponse.json(
      { success: true, message: "Barang berhasil ditambahkan", data: serializeBarang(barang) },
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

// GET semua barang
export async function GET() {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const barang = await prisma.barang.findMany({
      orderBy: { id: "desc" },
      include: { supplier: true, kategori: true },
      where: { isActive: true },
    });

    return NextResponse.json(
      { success: true, data: barang.map(serializeBarang) },
      { status: 200 }
    );
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
