// app/api/barang/search/[nama]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Konversi semua BigInt (termasuk relasi) ke number agar bisa di-JSON-kan.
// Sebelumnya field seperti `berat` & `limitStok` tidak dikonversi sehingga
// JSON.stringify gagal dan endpoint selalu error 500.
function serializeBigInt(value: any): any {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(serializeBigInt);
  if (value && typeof value === "object") {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serializeBigInt(val);
    }
    return result;
  }
  return value;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ nama: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { nama: rawNama } = await params;
  const nama = (rawNama || "").trim();

  if (!nama) {
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
    const serializedBarang = barang.map(serializeBigInt);

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
