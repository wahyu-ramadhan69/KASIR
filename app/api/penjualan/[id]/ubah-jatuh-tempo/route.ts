// app/api/penjualan/[id]/ubah-jatuh-tempo/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData, isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Deep serialize to handle all BigInt in nested objects
function deepSerialize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(deepSerialize);
  if (typeof obj === "object") {
    const serialized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        serialized[key] = deepSerialize(obj[key]);
      }
    }
    return serialized;
  }
  return obj;
}

// PUT: Ubah tanggal jatuh tempo penjualan (hanya ADMIN)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Cek autentikasi dan role
  const authData = await getAuthData();

  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cek apakah user adalah ADMIN
  if (authData.role !== "ADMIN") {
    return NextResponse.json(
      {
        success: false,
        error:
          "Forbidden - Hanya ADMIN yang dapat mengubah tanggal jatuh tempo",
      },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const penjualanId = parseInt(id);
    const body = await request.json();
    const { tanggalJatuhTempo } = body;

    // Validasi input
    if (isNaN(penjualanId)) {
      return NextResponse.json(
        { success: false, error: "ID penjualan tidak valid" },
        { status: 400 }
      );
    }

    if (!tanggalJatuhTempo) {
      return NextResponse.json(
        { success: false, error: "Tanggal jatuh tempo harus diisi" },
        { status: 400 }
      );
    }

    // Validasi format tanggal
    const newDate = new Date(tanggalJatuhTempo);
    if (isNaN(newDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "Format tanggal tidak valid" },
        { status: 400 }
      );
    }

    // Validasi penjualan exists
    const penjualan = await prisma.penjualanHeader.findUnique({
      where: { id: penjualanId },
      include: { customer: true },
    });

    if (!penjualan) {
      return NextResponse.json(
        { success: false, error: "Penjualan tidak ditemukan" },
        { status: 404 }
      );
    }

    // Validasi status - hanya bisa ubah jatuh tempo jika masih ada hutang
    if (penjualan.statusPembayaran === "LUNAS") {
      return NextResponse.json(
        {
          success: false,
          error: "Tidak dapat mengubah jatuh tempo penjualan yang sudah lunas",
        },
        { status: 400 }
      );
    }

    if (penjualan.statusTransaksi === "KERANJANG") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tidak dapat mengubah jatuh tempo penjualan yang masih dalam keranjang",
        },
        { status: 400 }
      );
    }

    if (penjualan.statusTransaksi === "DIBATALKAN") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tidak dapat mengubah jatuh tempo penjualan yang sudah dibatalkan",
        },
        { status: 400 }
      );
    }

    // Update tanggal jatuh tempo
    const updatedPenjualan = await prisma.penjualanHeader.update({
      where: { id: penjualanId },
      data: {
        tanggalJatuhTempo: newDate,
      },
      include: {
        customer: true,
        items: {
          include: {
            barang: true,
          },
        },
      },
    });

    return NextResponse.json(
      deepSerialize({
        success: true,
        message: "Tanggal jatuh tempo berhasil diubah",
        data: {
          penjualan: updatedPenjualan,
          tanggalJatuhTempoLama: penjualan.tanggalJatuhTempo,
          tanggalJatuhTempoBaru: newDate,
          updatedBy: authData.username,
        },
      })
    );
  } catch (err) {
    console.error("Error updating jatuh tempo:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengubah tanggal jatuh tempo" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
