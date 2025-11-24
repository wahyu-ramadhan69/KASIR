import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper: Update totals di header
async function updatePembelianTotals(pembelianId: number) {
  const items = await prisma.pembelianItem.findMany({
    where: { pembelianId },
  });

  const subtotal = items.reduce((total, item) => {
    const totalHarga = item.hargaPokok * item.jumlahDus;
    const totalDiskon = item.diskonPerItem * item.jumlahDus;
    return total + (totalHarga - totalDiskon);
  }, 0);

  const pembelian = await prisma.pembelianHeader.findUnique({
    where: { id: pembelianId },
  });

  const diskonNota = pembelian?.diskonNota || 0;
  const totalHarga = subtotal - diskonNota;

  await prisma.pembelianHeader.update({
    where: { id: pembelianId },
    data: { subtotal, totalHarga },
  });
}

// PUT: Update item (jumlah, harga, diskon)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params;
    const pembelianId = parseInt(id);
    const pembelianItemId = parseInt(itemId);
    const body = await request.json();
    const { jumlahDus, hargaPokok, diskonPerItem } = body;

    // Cek pembelian
    const pembelian = await prisma.pembelianHeader.findUnique({
      where: { id: pembelianId },
    });

    if (!pembelian) {
      return NextResponse.json(
        { success: false, error: "Pembelian tidak ditemukan" },
        { status: 404 }
      );
    }

    if (pembelian.statusTransaksi !== "KERANJANG") {
      return NextResponse.json(
        {
          success: false,
          error: "Tidak bisa mengubah item, pembelian sudah tidak aktif",
        },
        { status: 400 }
      );
    }

    // Cek item
    const existingItem = await prisma.pembelianItem.findFirst({
      where: { id: pembelianItemId, pembelianId },
    });

    if (!existingItem) {
      return NextResponse.json(
        { success: false, error: "Item tidak ditemukan" },
        { status: 404 }
      );
    }

    // Update item
    const updateData: any = {};
    if (jumlahDus !== undefined) updateData.jumlahDus = jumlahDus;
    if (hargaPokok !== undefined) updateData.hargaPokok = hargaPokok;
    if (diskonPerItem !== undefined) updateData.diskonPerItem = diskonPerItem;

    const item = await prisma.pembelianItem.update({
      where: { id: pembelianItemId },
      data: updateData,
      include: { barang: true },
    });

    // Update totals
    await updatePembelianTotals(pembelianId);

    // Ambil pembelian updated
    const updatedPembelian = await prisma.pembelianHeader.findUnique({
      where: { id: pembelianId },
      include: {
        supplier: true,
        items: { include: { barang: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Item berhasil diupdate",
      data: { item, pembelian: updatedPembelian },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Gagal mengupdate item" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE: Hapus item dari keranjang
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params;
    const pembelianId = parseInt(id);
    const pembelianItemId = parseInt(itemId);

    // Cek pembelian
    const pembelian = await prisma.pembelianHeader.findUnique({
      where: { id: pembelianId },
    });

    if (!pembelian) {
      return NextResponse.json(
        { success: false, error: "Pembelian tidak ditemukan" },
        { status: 404 }
      );
    }

    if (pembelian.statusTransaksi !== "KERANJANG") {
      return NextResponse.json(
        {
          success: false,
          error: "Tidak bisa menghapus item, pembelian sudah tidak aktif",
        },
        { status: 400 }
      );
    }

    // Cek item
    const existingItem = await prisma.pembelianItem.findFirst({
      where: { id: pembelianItemId, pembelianId },
    });

    if (!existingItem) {
      return NextResponse.json(
        { success: false, error: "Item tidak ditemukan" },
        { status: 404 }
      );
    }

    // Hapus item
    await prisma.pembelianItem.delete({
      where: { id: pembelianItemId },
    });

    // Update totals
    await updatePembelianTotals(pembelianId);

    // Ambil pembelian updated
    const updatedPembelian = await prisma.pembelianHeader.findUnique({
      where: { id: pembelianId },
      include: {
        supplier: true,
        items: { include: { barang: true } },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Item berhasil dihapus dari keranjang",
      data: { pembelian: updatedPembelian },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Gagal menghapus item" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
