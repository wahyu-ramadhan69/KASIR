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

// Helper to serialize data
function serializeItem(item: any) {
  return {
    ...item,
    hargaPokok: bigIntToNumber(item.hargaPokok),
    diskonPerItem: bigIntToNumber(item.diskonPerItem),
    jumlahDus: bigIntToNumber(item.jumlahDus),
    barang: item.barang
      ? {
          ...item.barang,
          hargaBeli: bigIntToNumber(item.barang.hargaBeli),
          hargaJual: bigIntToNumber(item.barang.hargaJual),
          stok: bigIntToNumber(item.barang.stok),
          jumlahPerKemasan: bigIntToNumber(item.barang.jumlahPerKemasan),
          ukuran: bigIntToNumber(item.barang.ukuran),
          limitPenjualan: bigIntToNumber(item.barang.limitPenjualan),
        }
      : undefined,
  };
}

function serializePembelian(pembelian: any) {
  return {
    ...pembelian,
    subtotal: bigIntToNumber(pembelian.subtotal),
    diskonNota: bigIntToNumber(pembelian.diskonNota),
    totalHarga: bigIntToNumber(pembelian.totalHarga),
    jumlahDibayar: bigIntToNumber(pembelian.jumlahDibayar),
    kembalian: bigIntToNumber(pembelian.kembalian),
    supplier: pembelian.supplier
      ? {
          ...pembelian.supplier,
          limitHutang: bigIntToNumber(pembelian.supplier.limitHutang),
          hutang: bigIntToNumber(pembelian.supplier.hutang),
        }
      : undefined,
    items: pembelian.items?.map(serializeItem),
  };
}

// Helper: Update totals di header
async function updatePembelianTotals(pembelianId: number) {
  const items = await prisma.pembelianItem.findMany({
    where: { pembelianId },
  });

  const subtotal = items.reduce((total, item) => {
    const hargaPokok = bigIntToNumber(item.hargaPokok);
    const jumlahDus = bigIntToNumber(item.jumlahDus);
    const diskonPerItem = bigIntToNumber(item.diskonPerItem);
    const totalHarga = hargaPokok * jumlahDus;
    const totalDiskon = diskonPerItem * jumlahDus;
    return total + (totalHarga - totalDiskon);
  }, 0);

  const pembelian = await prisma.pembelianHeader.findUnique({
    where: { id: pembelianId },
  });

  const diskonNota = bigIntToNumber(pembelian?.diskonNota || BigInt(0));
  const totalHarga = subtotal - diskonNota;

  await prisma.pembelianHeader.update({
    where: { id: pembelianId },
    data: {
      subtotal: BigInt(subtotal),
      totalHarga: BigInt(totalHarga),
    },
  });
}

// PUT: Update item (jumlah, harga, diskon)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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

    // Update item dengan BigInt conversion
    const updateData: any = {};
    if (jumlahDus !== undefined) updateData.jumlahDus = BigInt(jumlahDus);
    if (hargaPokok !== undefined) updateData.hargaPokok = BigInt(hargaPokok);
    if (diskonPerItem !== undefined)
      updateData.diskonPerItem = BigInt(diskonPerItem);

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
        items: { include: { barang: true }, orderBy: { id: "asc" } },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Item berhasil diupdate",
      data: {
        item: serializeItem(item),
        pembelian: updatedPembelian
          ? serializePembelian(updatedPembelian)
          : null,
      },
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

// DELETE: Hapus item dari keranjang
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
        items: { include: { barang: true }, orderBy: { id: "asc" } },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Item berhasil dihapus dari keranjang",
      data: {
        pembelian: updatedPembelian
          ? serializePembelian(updatedPembelian)
          : null,
      },
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
