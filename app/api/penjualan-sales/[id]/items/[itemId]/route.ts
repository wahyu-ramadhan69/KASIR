import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

// DELETE - Hapus item dari keranjang
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId: itemIdStr } = await params;
    const penjualanId = parseInt(id);
    const itemId = parseInt(itemIdStr);

    // Validasi penjualan harus masih dalam status KERANJANG
    const penjualan = await prisma.penjualanHeader.findUnique({
      where: { id: penjualanId },
    });

    if (penjualan?.statusTransaksi !== "KERANJANG") {
      return NextResponse.json(
        {
          success: false,
          error: "Transaksi sudah diproses, tidak bisa diubah",
        },
        { status: 400 }
      );
    }

    await prisma.penjualanItem.delete({
      where: { id: itemId },
    });

    // Update totals
    await updatePenjualanTotals(penjualanId);

    return NextResponse.json({
      success: true,
      message: "Item berhasil dihapus",
    });
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
