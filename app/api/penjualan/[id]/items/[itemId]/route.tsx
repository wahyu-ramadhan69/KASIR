// app/api/penjualan/[id]/items/[itemId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

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

// Helper to convert BigInt to number safely
function toNumber(value: any): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value || 0);
}

// Helper function untuk menghitung total penjualan
const calculatePenjualan = (items: any[], diskonNota: number = 0) => {
  let subtotal = 0;
  let totalDiskonItem = 0;

  const calculatedItems = items.map((item) => {
    const jumlahDus = toNumber(item.jumlahDus);
    const jumlahPcs = toNumber(item.jumlahPcs);
    const hargaJual = toNumber(item.hargaJual);
    const diskonPerItem = toNumber(item.diskonPerItem);
    const jumlahPerkardus = toNumber(item.barang?.jumlahPerkardus || 1);

    const totalPcs = jumlahDus * jumlahPerkardus + jumlahPcs;
    const hargaTotal = hargaJual * jumlahDus;
    const hargaPcs =
      jumlahPcs > 0 ? Math.round((hargaJual / jumlahPerkardus) * jumlahPcs) : 0;
    const totalHargaSebelumDiskon = hargaTotal + hargaPcs;
    const diskon = diskonPerItem * jumlahDus;

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
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
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
      updateData.jumlahDus = BigInt(body.jumlahDus);
    }

    if (body.jumlahPcs !== undefined) {
      updateData.jumlahPcs = BigInt(body.jumlahPcs);
    }

    if (body.hargaJual !== undefined) {
      updateData.hargaJual = BigInt(body.hargaJual);
    }

    if (body.diskonPerItem !== undefined) {
      updateData.diskonPerItem = BigInt(body.diskonPerItem);
    }

    // Validasi stok jika jumlah berubah
    const newJumlahDus = body.jumlahDus ?? toNumber(item.jumlahDus);
    const newJumlahPcs = body.jumlahPcs ?? toNumber(item.jumlahPcs);
    const jumlahPerkardus = toNumber(item.barang.jumlahPerkardus);
    const stokTersedia = toNumber(item.barang.stok);
    const totalPcsNeeded = newJumlahDus * jumlahPerkardus + newJumlahPcs;

    if (stokTersedia < totalPcsNeeded) {
      return NextResponse.json(
        {
          success: false,
          error: `Stok tidak cukup. Tersedia: ${stokTersedia} pcs, Dibutuhkan: ${totalPcsNeeded} pcs`,
        },
        { status: 400 }
      );
    }

    // Hitung ulang laba dengan nilai terbaru
    const newHargaJual = body.hargaJual ?? toNumber(item.hargaJual);
    const newDiskonPerItem = body.diskonPerItem ?? toNumber(item.diskonPerItem);
    const hargaBeli = toNumber(item.hargaBeli);

    const hargaBeliPerPcs = Math.round(hargaBeli / jumlahPerkardus);
    const hargaJualPerPcs = Math.round(newHargaJual / jumlahPerkardus);

    const labaPerDus = newHargaJual - newDiskonPerItem - hargaBeli;
    const labaFromDus = labaPerDus * newJumlahDus;

    const labaPerPcs = hargaJualPerPcs - hargaBeliPerPcs;
    const labaFromPcs = labaPerPcs * newJumlahPcs;

    const totalLaba = labaFromDus + labaFromPcs;

    // Tambahkan laba ke updateData
    updateData.laba = BigInt(totalLaba);

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

    const diskonNota = toNumber(penjualan?.diskonNota || 0);
    const calculation = calculatePenjualan(allItems, diskonNota);

    await prisma.penjualanHeader.update({
      where: { id: penjualanId },
      data: {
        subtotal: BigInt(calculation.ringkasan.subtotal),
        totalHarga: BigInt(calculation.ringkasan.totalHarga),
      },
    });

    return NextResponse.json(
      deepSerialize({
        success: true,
        message: "Item berhasil diupdate",
      })
    );
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
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
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

    const diskonNota = toNumber(penjualan?.diskonNota || 0);
    const calculation = calculatePenjualan(allItems, diskonNota);

    await prisma.penjualanHeader.update({
      where: { id: penjualanId },
      data: {
        subtotal: BigInt(calculation.ringkasan.subtotal),
        totalHarga: BigInt(calculation.ringkasan.totalHarga),
      },
    });

    return NextResponse.json(
      deepSerialize({
        success: true,
        message: "Item berhasil dihapus",
      })
    );
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
