// app/api/barang/search/[nama]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ nama: string }> }
) {
  const { nama } = await params; // <- WAJIB await

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
      },
      orderBy: {
        id: "desc",
      },
    });

    return NextResponse.json(
      {
        success: true,
        keyword: nama,
        count: barang.length,
        data: barang,
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
