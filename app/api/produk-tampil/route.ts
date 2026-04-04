import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function bigIntToNumber(value: bigint | number): number {
  return typeof value === "bigint" ? Number(value) : value;
}

export async function GET() {
  try {
    const barang = await prisma.barang.findMany({
      where: { isActive: true, tampilDiHalaman: true },
      orderBy: { namaBarang: "asc" },
      select: {
        id: true,
        namaBarang: true,
        hargaJual: true,
        jenisKemasan: true,
        jumlahPerKemasan: true,
        gambar: true,
        kategori: { select: { id: true, namaKategori: true } },
      },
    });

    const data = barang.map((item) => ({
      ...item,
      hargaJual: bigIntToNumber(item.hargaJual),
      jumlahPerKemasan: bigIntToNumber(item.jumlahPerKemasan),
    }));

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error("Error fetching produk tampil:", error);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
