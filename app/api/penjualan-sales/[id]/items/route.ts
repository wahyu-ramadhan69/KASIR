import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Deep serialize to handle all BigInt in nested objects
function deepSerialize(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "bigint") {
    return Number(obj);
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepSerialize);
  }

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

// Helper function untuk update totals
async function updatePenjualanTotals(penjualanId: number) {
  const items = await prisma.penjualanItem.findMany({
    where: { penjualanId },
  });

  const subtotal = items.reduce((sum, item) => sum + item.hargaJual, BigInt(0));

  const penjualan = await prisma.penjualanHeader.findUnique({
    where: { id: penjualanId },
  });

  const totalHarga = subtotal - (penjualan?.diskonNota || BigInt(0));
  const kembalian = (penjualan?.jumlahDibayar || BigInt(0)) - totalHarga;

  await prisma.penjualanHeader.update({
    where: { id: penjualanId },
    data: {
      subtotal,
      totalHarga,
      kembalian: kembalian > 0 ? kembalian : BigInt(0),
    },
  });
}

// POST - Tambah item ke keranjang
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const penjualanId = parseInt(id);
    const body = await request.json();
    const { barangId, jumlahDus, jumlahPcs, diskonPerItem } = body;

    // Validasi penjualan harus masih dalam status KERANJANG
    const penjualan = await prisma.penjualanHeader.findUnique({
      where: { id: penjualanId },
    });

    if (!penjualan) {
      return NextResponse.json(
        { success: false, error: "Penjualan tidak ditemukan" },
        { status: 404 }
      );
    }

    if (penjualan.statusTransaksi !== "KERANJANG") {
      return NextResponse.json(
        {
          success: false,
          error: "Transaksi sudah diproses, tidak bisa diubah",
        },
        { status: 400 }
      );
    }

    // Ambil data barang
    const barang = await prisma.barang.findUnique({
      where: { id: barangId },
    });

    if (!barang) {
      return NextResponse.json(
        { success: false, error: "Barang tidak ditemukan" },
        { status: 404 }
      );
    }

    // Hitung total quantity
    const totalPcs =
      BigInt(jumlahDus) * barang.jumlahPerKemasan + BigInt(jumlahPcs);

    // Cek stok
    if (totalPcs > barang.stok) {
      return NextResponse.json(
        { success: false, error: "Stok tidak mencukupi" },
        { status: 400 }
      );
    }

    // Hitung harga dan laba
    const hargaJual = barang.hargaJual * totalPcs - BigInt(diskonPerItem || 0);
    const hargaBeli = barang.hargaBeli * totalPcs;
    const laba = hargaJual - hargaBeli;

    // Cek apakah item sudah ada
    const existingItem = await prisma.penjualanItem.findFirst({
      where: {
        penjualanId,
        barangId,
      },
    });

    let item;
    if (existingItem) {
      // Update existing item
      item = await prisma.penjualanItem.update({
        where: { id: existingItem.id },
        data: {
          jumlahDus: BigInt(jumlahDus),
          jumlahPcs: BigInt(jumlahPcs),
          hargaJual,
          hargaBeli,
          diskonPerItem: BigInt(diskonPerItem || 0),
          laba,
        },
        include: {
          barang: true,
        },
      });
    } else {
      // Create new item
      item = await prisma.penjualanItem.create({
        data: {
          penjualanId,
          barangId,
          jumlahDus: BigInt(jumlahDus),
          jumlahPcs: BigInt(jumlahPcs),
          hargaJual,
          hargaBeli,
          diskonPerItem: BigInt(diskonPerItem || 0),
          laba,
        },
        include: {
          barang: true,
        },
      });
    }

    // Update subtotal dan total di header
    await updatePenjualanTotals(penjualanId);

    return NextResponse.json(
      deepSerialize({
        success: true,
        data: item,
      }),
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
