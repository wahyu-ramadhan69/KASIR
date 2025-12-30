// app/api/barang/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Helper function to convert BigInt to number safely
function bigIntToNumber(value: bigint | number): number {
  if (typeof value === "bigint") {
    return Number(value);
  }
  return value;
}

// Helper to serialize barang data with BigInt conversion
function serializeBarang(barang: any) {
  return {
    ...barang,
    hargaBeli: bigIntToNumber(barang.hargaBeli),
    hargaJual: bigIntToNumber(barang.hargaJual),
    stok: bigIntToNumber(barang.stok),
    jumlahPerKemasan: bigIntToNumber(barang.jumlahPerKemasan),
    ukuran: bigIntToNumber(barang.ukuran),
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
      ukuran,
      satuan,
      supplierId,
      berat,
      limitPenjualan,
    } = body;

    if (
      !namaBarang ||
      hargaBeli == null ||
      hargaJual == null ||
      !jenisKemasan ||
      jumlahPerKemasan == null ||
      ukuran == null ||
      !satuan ||
      supplierId == null
    ) {
      return NextResponse.json(
        { success: false, error: "Semua field wajib diisi" },
        { status: 400 }
      );
    }

    // Convert to BigInt for database
    const barang = await prisma.barang.create({
      data: {
        namaBarang: String(namaBarang).trim(),
        hargaBeli: BigInt(hargaBeli),
        hargaJual: BigInt(hargaJual),
        stok: stok != null ? BigInt(stok) : BigInt(0),
        jenisKemasan: String(jenisKemasan).trim(),
        jumlahPerKemasan: BigInt(jumlahPerKemasan),
        ukuran: BigInt(ukuran),
        satuan: String(satuan).trim(),
        supplierId: Number(supplierId),
        berat: berat != null ? BigInt(berat) : BigInt(0),
        limitPenjualan: limitPenjualan != null ? BigInt(limitPenjualan) : BigInt(0),
      },
      include: {
        supplier: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Barang berhasil ditambahkan",
        data: serializeBarang(barang),
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

// GET semua barang
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
      where: { isActive: true },
    });

    // Serialize all barang to convert BigInt to number
    const serializedBarang = barang.map(serializeBarang);

    return NextResponse.json(
      { success: true, data: serializedBarang },
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
