// app/api/penjualan/[id]/items/route.ts
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
    const { id } = await params;
    console.log(id);
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
    const jumlahPerkardus = toNumber(barang.jumlahPerkardus);
    const stokTersedia = toNumber(barang.stok);
    const totalPcsNeeded = jumlahDus * jumlahPerkardus + jumlahPcs;

    if (stokTersedia < totalPcsNeeded) {
      return NextResponse.json(
        {
          success: false,
          error: `Stok tidak cukup. Tersedia: ${stokTersedia} pcs, Dibutuhkan: ${totalPcsNeeded} pcs`,
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
    const hargaBeliBarang = toNumber(barang.hargaBeli);
    const hargaJualFinal = hargaJual || toNumber(barang.hargaJual);

    const hargaBeliPerPcs = Math.round(hargaBeliBarang / jumlahPerkardus);
    const hargaJualPerPcs = Math.round(hargaJualFinal / jumlahPerkardus);

    const labaPerDus = hargaJualFinal - diskonPerItem - hargaBeliBarang;
    const labaFromDus = labaPerDus * jumlahDus;

    const labaPerPcs = hargaJualPerPcs - hargaBeliPerPcs;
    const labaFromPcs = labaPerPcs * jumlahPcs;

    const totalLaba = labaFromDus + labaFromPcs;

    // Tambah item
    const item = await prisma.penjualanItem.create({
      data: {
        penjualanId,
        barangId,
        jumlahDus: BigInt(jumlahDus),
        jumlahPcs: BigInt(jumlahPcs),
        hargaJual: BigInt(hargaJualFinal),
        hargaBeli: barang.hargaBeli, // Simpan harga beli dari master barang
        diskonPerItem: BigInt(diskonPerItem),
        laba: BigInt(totalLaba), // Simpan total laba
      },
      include: { barang: true },
    });

    // Update total penjualan
    const allItems = await prisma.penjualanItem.findMany({
      where: { penjualanId },
      include: { barang: true },
    });

    const diskonNotaPenjualan = toNumber(penjualan.diskonNota);
    const calculation = calculatePenjualan(allItems, diskonNotaPenjualan);

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
        message: "Item berhasil ditambahkan",
        data: item,
      })
    );
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
