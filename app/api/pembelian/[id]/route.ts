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

// Helper to serialize pembelian data
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
    items: pembelian.items?.map((item: any) => ({
      ...item,
      hargaPokok: bigIntToNumber(item.hargaPokok),
      diskonPerItem: bigIntToNumber(item.diskonPerItem),
      totalItem: bigIntToNumber(item.totalItem),
      jumlahDus:
        item.barang && bigIntToNumber(item.barang.jumlahPerKemasan) > 0
          ? bigIntToNumber(item.totalItem) /
            bigIntToNumber(item.barang.jumlahPerKemasan)
          : 0,
      barang: item.barang
        ? {
            ...item.barang,
            hargaBeli: bigIntToNumber(item.barang.hargaBeli),
            hargaJual: bigIntToNumber(item.barang.hargaJual),
            stok: bigIntToNumber(item.barang.stok),
            jumlahPerKemasan: bigIntToNumber(item.barang.jumlahPerKemasan),
            berat: bigIntToNumber(item.barang.berat),
            limitStok: bigIntToNumber(item.barang.limitStok),
            ukuran: bigIntToNumber(item.barang.ukuran),
            limitPenjualan: bigIntToNumber(item.barang.limitPenjualan),
          }
        : undefined,
    })),
  };
}

// Helper: Hitung detail pembelian
function calculatePurchase(pembelian: any) {
  const items = pembelian.items.map((item: any) => {
    const hargaPokok = bigIntToNumber(item.hargaPokok);
    const totalItem = bigIntToNumber(item.totalItem);
    const jumlahPerKemasan = bigIntToNumber(item.barang.jumlahPerKemasan);
    const jumlahDus =
      jumlahPerKemasan > 0 ? totalItem / jumlahPerKemasan : 0;
    const diskonPerItem = bigIntToNumber(item.diskonPerItem);

    const totalHarga = hargaPokok * jumlahDus;
    const totalDiskon = diskonPerItem * jumlahDus;
    const subtotal = totalHarga - totalDiskon;

    return {
      id: item.id,
      barangId: item.barangId,
      namaBarang: item.barang.namaBarang,
      jumlahDus,
      hargaPokok,
      totalHarga,
      diskonPerItem,
      totalDiskon,
      subtotal,
    };
  });

  const totalSebelumDiskon = items.reduce(
    (sum: number, item: any) => sum + item.totalHarga,
    0
  );
  const totalDiskonItem = items.reduce(
    (sum: number, item: any) => sum + item.totalDiskon,
    0
  );
  const subtotal = items.reduce(
    (sum: number, item: any) => sum + item.subtotal,
    0
  );
  const diskonNota = bigIntToNumber(pembelian.diskonNota) || 0;
  const totalHarga = subtotal - diskonNota;
  const jumlahDibayar = bigIntToNumber(pembelian.jumlahDibayar) || 0;

  // Kembalian jika bayar lebih, sisaHutang jika bayar kurang
  const kembalian = jumlahDibayar > totalHarga ? jumlahDibayar - totalHarga : 0;
  const sisaHutang =
    jumlahDibayar < totalHarga ? totalHarga - jumlahDibayar : 0;

  return {
    items,
    ringkasan: {
      totalSebelumDiskon,
      totalDiskonItem,
      subtotal,
      diskonNota,
      totalHarga,
      jumlahDibayar,
      kembalian,
      sisaHutang,
      statusPembayaran:
        jumlahDibayar >= totalHarga && totalHarga > 0 ? "LUNAS" : "HUTANG",
    },
  };
}

// GET: Detail pembelian dengan perhitungan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const pembelianId = parseInt(id);

    const pembelian = await prisma.pembelianHeader.findUnique({
      where: { id: pembelianId },
      include: {
        supplier: true,
        items: {
          include: {
            barang: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!pembelian) {
      return NextResponse.json(
        { success: false, error: "Pembelian tidak ditemukan" },
        { status: 404 }
      );
    }

    const calculation = calculatePurchase(pembelian);
    const serialized = serializePembelian(pembelian);

    return NextResponse.json({
      success: true,
      data: {
        ...serialized,
        calculation,
      },
    });
  } catch (err) {
    console.error("Error fetching pembelian:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data pembelian" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT: Update diskon nota
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const pembelianId = parseInt(id);
    const body = await request.json();
    const { diskonNota } = body;

    const pembelian = await prisma.pembelianHeader.findUnique({
      where: { id: pembelianId },
      include: {
        items: {
          include: { barang: true },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!pembelian) {
      return NextResponse.json(
        { success: false, error: "Pembelian tidak ditemukan" },
        { status: 404 }
      );
    }

    if (pembelian.statusTransaksi !== "KERANJANG") {
      return NextResponse.json(
        { success: false, error: "Pembelian sudah tidak bisa diubah" },
        { status: 400 }
      );
    }

    // Hitung subtotal dengan BigInt conversion
    const subtotal = pembelian.items.reduce((total, item) => {
      const hargaPokok = bigIntToNumber(item.hargaPokok);
      const totalItem = bigIntToNumber(item.totalItem);
      const jumlahPerKemasan = bigIntToNumber(item.barang.jumlahPerKemasan);
      const jumlahDus =
        jumlahPerKemasan > 0 ? totalItem / jumlahPerKemasan : 0;
      const diskonPerItem = bigIntToNumber(item.diskonPerItem);
      const totalHarga = hargaPokok * jumlahDus;
      const totalDiskon = diskonPerItem * jumlahDus;
      return total + (totalHarga - totalDiskon);
    }, 0);

    const newDiskonNota =
      diskonNota !== undefined
        ? diskonNota
        : bigIntToNumber(pembelian.diskonNota);
    const totalHarga = subtotal - newDiskonNota;

    const updated = await prisma.pembelianHeader.update({
      where: { id: pembelianId },
      data: {
        subtotal: BigInt(subtotal),
        diskonNota: BigInt(newDiskonNota),
        totalHarga: BigInt(totalHarga),
      },
      include: {
        supplier: true,
        items: {
          include: { barang: true },
          orderBy: { id: "asc" },
        },
      },
    });

    const calculation = calculatePurchase(updated);
    const serialized = serializePembelian(updated);

    return NextResponse.json({
      success: true,
      message: "Diskon nota berhasil diupdate",
      data: { ...serialized, calculation },
    });
  } catch (err) {
    console.error("Error updating pembelian:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengupdate pembelian" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE: Batalkan pembelian
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const pembelianId = parseInt(id);

    const pembelian = await prisma.pembelianHeader.findUnique({
      where: { id: pembelianId },
    });

    if (!pembelian) {
      return NextResponse.json(
        { success: false, error: "Pembelian tidak ditemukan" },
        { status: 404 }
      );
    }

    if (pembelian.statusTransaksi === "SELESAI") {
      return NextResponse.json(
        {
          success: false,
          error: "Pembelian yang sudah selesai tidak bisa dibatalkan",
        },
        { status: 400 }
      );
    }

    await prisma.pembelianHeader.update({
      where: { id: pembelianId },
      data: { statusTransaksi: "DIBATALKAN" },
    });

    return NextResponse.json({
      success: true,
      message: "Pembelian berhasil dibatalkan",
    });
  } catch (err) {
    console.error("Error canceling pembelian:", err);
    return NextResponse.json(
      { success: false, error: "Gagal membatalkan pembelian" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
