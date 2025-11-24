import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper: Hitung detail pembelian
function calculatePurchase(pembelian: any) {
  const items = pembelian.items.map((item: any) => {
    const totalHarga = item.hargaPokok * item.jumlahDus;
    const totalDiskon = item.diskonPerItem * item.jumlahDus;
    const subtotal = totalHarga - totalDiskon;

    return {
      id: item.id,
      barangId: item.barangId,
      namaBarang: item.barang.namaBarang,
      jumlahDus: item.jumlahDus,
      hargaPokok: item.hargaPokok,
      totalHarga,
      diskonPerItem: item.diskonPerItem,
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
  const diskonNota = pembelian.diskonNota || 0;
  const totalHarga = subtotal - diskonNota;
  const jumlahDibayar = pembelian.jumlahDibayar || 0;

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

    return NextResponse.json({
      success: true,
      data: {
        ...pembelian,
        calculation,
      },
    });
  } catch (err) {
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

    // Hitung subtotal
    const subtotal = pembelian.items.reduce((total, item) => {
      const totalHarga = item.hargaPokok * item.jumlahDus;
      const totalDiskon = item.diskonPerItem * item.jumlahDus;
      return total + (totalHarga - totalDiskon);
    }, 0);

    const newDiskonNota =
      diskonNota !== undefined ? diskonNota : pembelian.diskonNota;
    const totalHarga = subtotal - newDiskonNota;

    const updated = await prisma.pembelianHeader.update({
      where: { id: pembelianId },
      data: {
        subtotal,
        diskonNota: newDiskonNota,
        totalHarga,
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

    return NextResponse.json({
      success: true,
      message: "Diskon nota berhasil diupdate",
      data: { ...updated, calculation },
    });
  } catch (err) {
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
    return NextResponse.json(
      { success: false, error: "Gagal membatalkan pembelian" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
