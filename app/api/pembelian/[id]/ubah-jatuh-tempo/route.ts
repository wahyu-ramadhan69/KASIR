// app/api/pembelian/[id]/ubah-jatuh-tempo/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData } from "@/app/AuthGuard";

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

// PUT: Ubah tanggal jatuh tempo pembelian (hanya ADMIN)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const pembelianId = parseInt(id);
    const body = await request.json();
    const { tanggalJatuhTempo } = body;

    // Validasi input
    if (isNaN(pembelianId)) {
      return NextResponse.json(
        { success: false, error: "ID pembelian tidak valid" },
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

    // Validasi pembelian exists
    const pembelian = await prisma.pembelianHeader.findUnique({
      where: { id: pembelianId },
      include: { supplier: true },
    });

    if (!pembelian) {
      return NextResponse.json(
        { success: false, error: "Pembelian tidak ditemukan" },
        { status: 404 }
      );
    }

    // Validasi status - hanya bisa ubah jatuh tempo jika masih ada hutang
    if (pembelian.statusPembayaran === "LUNAS") {
      return NextResponse.json(
        {
          success: false,
          error: "Tidak dapat mengubah jatuh tempo pembelian yang sudah lunas",
        },
        { status: 400 }
      );
    }

    if (pembelian.statusTransaksi === "KERANJANG") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tidak dapat mengubah jatuh tempo pembelian yang masih dalam keranjang",
        },
        { status: 400 }
      );
    }

    if (pembelian.statusTransaksi === "DIBATALKAN") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tidak dapat mengubah jatuh tempo pembelian yang sudah dibatalkan",
        },
        { status: 400 }
      );
    }

    // Update tanggal jatuh tempo
    const updatedPembelian = await prisma.pembelianHeader.update({
      where: { id: pembelianId },
      data: {
        tanggalJatuhTempo: newDate,
      },
      include: {
        supplier: true,
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
          pembelian: updatedPembelian,
          tanggalJatuhTempoLama: pembelian.tanggalJatuhTempo,
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
