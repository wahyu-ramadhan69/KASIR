// app/api/barang/search/[nama]/route.ts
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ nama: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { nama } = await params;

  if (!nama || nama.trim() === "") {
    return NextResponse.json(
      { success: false, error: "Nama barang tidak boleh kosong" },
      { status: 400 }
    );
  }

  try {
    const barang = await prisma.barang.findMany({
      where: {
        namaBarang: {
          contains: nama,
          mode: "insensitive",
        },
        isActive: true,
      },
      include: {
        supplier: true,
      },
      orderBy: {
        id: "desc",
      },
    });

    // Serialize all barang to convert BigInt to number
    const serializedBarang = barang.map(serializeBarang);

    return NextResponse.json(
      {
        success: true,
        keyword: nama,
        count: barang.length,
        data: serializedBarang,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error searching barang:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mencari barang" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
