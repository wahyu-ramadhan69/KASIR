// =====================================================
// PATH: app/api/penjualan/[id]/items/route.ts
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

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

// POST: Tambah item ke penjualan
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // PENTING: await params dulu sebelum digunakan
    const { id } = await params;
    const penjualanId = parseInt(id);

    const body = await request.json();
    const {
      barangId,
      jumlahDus = 1,
      jumlahPcs = 0,
      hargaJual,
      diskonPerItem = 0,
    } = body;

    // Validasi penjualan
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
        { success: false, error: "Penjualan sudah selesai" },
        { status: 400 }
      );
    }

    // Validasi barang
    const barang = await prisma.barang.findUnique({
      where: { id: barangId },
    });

    if (!barang) {
      return NextResponse.json(
        { success: false, error: "Barang tidak ditemukan" },
        { status: 404 }
      );
    }

    // Cek stok
    const totalPcsNeeded = jumlahDus * barang.jumlahPerkardus + jumlahPcs;
    if (barang.stok < totalPcsNeeded) {
      return NextResponse.json(
        {
          success: false,
          error: `Stok tidak cukup. Tersedia: ${barang.stok} pcs, Dibutuhkan: ${totalPcsNeeded} pcs`,
        },
        { status: 400 }
      );
    }

    // Cek apakah barang sudah ada di keranjang
    const existingItem = await prisma.penjualanItem.findFirst({
      where: {
        penjualanId,
        barangId,
      },
    });

    if (existingItem) {
      return NextResponse.json(
        { success: false, error: "Barang sudah ada di keranjang" },
        { status: 400 }
      );
    }

    // Hitung laba
    // Laba = (hargaJual - diskon - hargaBeli) * jumlahDus + (hargaJualPerPcs - hargaBeliPerPcs) * jumlahPcs
    const hargaBeliPerPcs = Math.round(
      barang.hargaBeli / barang.jumlahPerkardus
    );
    const hargaJualPerPcs = Math.round(
      (hargaJual || barang.hargaJual) / barang.jumlahPerkardus
    );

    const labaPerDus =
      (hargaJual || barang.hargaJual) - diskonPerItem - barang.hargaBeli;
    const labaFromDus = labaPerDus * jumlahDus;

    const labaPerPcs = hargaJualPerPcs - hargaBeliPerPcs;
    const labaFromPcs = labaPerPcs * jumlahPcs;

    const totalLaba = labaFromDus + labaFromPcs;

    // Tambah item
    const item = await prisma.penjualanItem.create({
      data: {
        penjualanId,
        barangId,
        jumlahDus,
        jumlahPcs,
        hargaJual: hargaJual || barang.hargaJual,
        hargaBeli: barang.hargaBeli, // Simpan harga beli dari master barang
        diskonPerItem,
        laba: totalLaba, // Simpan total laba
      },
      include: { barang: true },
    });

    // Update total penjualan
    const allItems = await prisma.penjualanItem.findMany({
      where: { penjualanId },
      include: { barang: true },
    });

    const calculation = calculatePenjualan(allItems, penjualan.diskonNota);

    await prisma.penjualanHeader.update({
      where: { id: penjualanId },
      data: {
        subtotal: calculation.ringkasan.subtotal,
        totalHarga: calculation.ringkasan.totalHarga,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Item berhasil ditambahkan",
      data: item,
    });
  } catch (err) {
    console.error("Error adding item:", err);
    return NextResponse.json(
      { success: false, error: "Gagal menambahkan item" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
