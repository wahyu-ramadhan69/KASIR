// =====================================================
// PATH: app/api/penjualan/[id]/items/[itemId]/route.ts
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const calculatePenjualan = (items: any[], diskonNota: number = 0) => {
  let subtotal = 0;
  let totalDiskonItem = 0;

  const calculatedItems = items.map((item) => {
    const totalPcs =
      item.jumlahDus * (item.barang?.jumlahPerkardus || 1) +
      (item.jumlahPcs || 0);
    const hargaTotal = item.hargaJual * item.jumlahDus;
    const hargaPcs =
      item.jumlahPcs > 0
        ? Math.round(
            (item.hargaJual / (item.barang?.jumlahPerkardus || 1)) *
              item.jumlahPcs
          )
        : 0;
    const totalHargaSebelumDiskon = hargaTotal + hargaPcs;
    const diskon = item.diskonPerItem * item.jumlahDus;

    subtotal += totalHargaSebelumDiskon;
    totalDiskonItem += diskon;

    return {
      ...item,
      totalPcs,
      totalHargaSebelumDiskon,
      totalDiskon: diskon,
      subtotalItem: totalHargaSebelumDiskon - diskon,
    };
  });

  const totalHarga = subtotal - totalDiskonItem - diskonNota;

  return {
    items: calculatedItems,
    ringkasan: {
      subtotal,
      totalDiskonItem,
      diskonNota,
      totalHarga: Math.max(0, totalHarga),
    },
  };
};

// PUT: Update item penjualan
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    // PENTING: await params dulu sebelum digunakan
    const { id, itemId } = await params;
    const penjualanId = parseInt(id);
    const itemIdInt = parseInt(itemId);
    const body = await request.json();

    // Validasi item
    const item = await prisma.penjualanItem.findFirst({
      where: { id: itemIdInt, penjualanId },
      include: { barang: true, penjualan: true },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Item tidak ditemukan" },
        { status: 404 }
      );
    }

    if (item.penjualan.statusTransaksi !== "KERANJANG") {
      return NextResponse.json(
        { success: false, error: "Penjualan sudah selesai" },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: any = {};

    if (body.jumlahDus !== undefined) {
      updateData.jumlahDus = body.jumlahDus;
    }

    if (body.jumlahPcs !== undefined) {
      updateData.jumlahPcs = body.jumlahPcs;
    }

    if (body.hargaJual !== undefined) {
      updateData.hargaJual = body.hargaJual;
    }

    if (body.diskonPerItem !== undefined) {
      updateData.diskonPerItem = body.diskonPerItem;
    }

    // Validasi stok jika jumlah berubah
    const newJumlahDus = body.jumlahDus ?? item.jumlahDus;
    const newJumlahPcs = body.jumlahPcs ?? item.jumlahPcs;
    const totalPcsNeeded =
      newJumlahDus * item.barang.jumlahPerkardus + newJumlahPcs;

    if (item.barang.stok < totalPcsNeeded) {
      return NextResponse.json(
        {
          success: false,
          error: `Stok tidak cukup. Tersedia: ${item.barang.stok} pcs`,
        },
        { status: 400 }
      );
    }

    // Hitung ulang laba dengan nilai terbaru
    const newHargaJual = body.hargaJual ?? item.hargaJual;
    const newDiskonPerItem = body.diskonPerItem ?? item.diskonPerItem;

    const hargaBeliPerPcs = Math.round(
      item.hargaBeli / item.barang.jumlahPerkardus
    );
    const hargaJualPerPcs = Math.round(
      newHargaJual / item.barang.jumlahPerkardus
    );

    const labaPerDus = newHargaJual - newDiskonPerItem - item.hargaBeli;
    const labaFromDus = labaPerDus * newJumlahDus;

    const labaPerPcs = hargaJualPerPcs - hargaBeliPerPcs;
    const labaFromPcs = labaPerPcs * newJumlahPcs;

    const totalLaba = labaFromDus + labaFromPcs;

    // Tambahkan laba ke updateData
    updateData.laba = totalLaba;

    // Update item
    await prisma.penjualanItem.update({
      where: { id: itemIdInt },
      data: updateData,
    });

    // Recalculate totals
    const allItems = await prisma.penjualanItem.findMany({
      where: { penjualanId },
      include: { barang: true },
    });

    const penjualan = await prisma.penjualanHeader.findUnique({
      where: { id: penjualanId },
    });

    const calculation = calculatePenjualan(
      allItems,
      penjualan?.diskonNota || 0
    );

    await prisma.penjualanHeader.update({
      where: { id: penjualanId },
      data: {
        subtotal: calculation.ringkasan.subtotal,
        totalHarga: calculation.ringkasan.totalHarga,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Item berhasil diupdate",
    });
  } catch (err) {
    console.error("Error updating item:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengupdate item" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE: Hapus item penjualan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    // PENTING: await params dulu sebelum digunakan
    const { id, itemId } = await params;
    const penjualanId = parseInt(id);
    const itemIdInt = parseInt(itemId);

    // Validasi item
    const item = await prisma.penjualanItem.findFirst({
      where: { id: itemIdInt, penjualanId },
      include: { penjualan: true },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Item tidak ditemukan" },
        { status: 404 }
      );
    }

    if (item.penjualan.statusTransaksi !== "KERANJANG") {
      return NextResponse.json(
        { success: false, error: "Penjualan sudah selesai" },
        { status: 400 }
      );
    }

    // Hapus item
    await prisma.penjualanItem.delete({
      where: { id: itemIdInt },
    });

    // Recalculate totals
    const allItems = await prisma.penjualanItem.findMany({
      where: { penjualanId },
      include: { barang: true },
    });

    const penjualan = await prisma.penjualanHeader.findUnique({
      where: { id: penjualanId },
    });

    const calculation = calculatePenjualan(
      allItems,
      penjualan?.diskonNota || 0
    );

    await prisma.penjualanHeader.update({
      where: { id: penjualanId },
      data: {
        subtotal: calculation.ringkasan.subtotal,
        totalHarga: calculation.ringkasan.totalHarga,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Item berhasil dihapus",
    });
  } catch (err) {
    console.error("Error deleting item:", err);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus item" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
