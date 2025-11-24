import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

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

// GET: Ambil semua items dalam keranjang
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

    const items = await prisma.pembelianItem.findMany({
      where: { pembelianId },
      include: { barang: true },
      orderBy: { id: "asc" },
    });

    const itemsWithCalc = items.map((item) => {
      const totalHarga = item.hargaPokok * item.jumlahDus;
      const totalDiskon = item.diskonPerItem * item.jumlahDus;
      return {
        ...item,
        totalHarga,
        totalDiskon,
        subtotal: totalHarga - totalDiskon,
      };
    });

    return NextResponse.json({ success: true, data: itemsWithCalc });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data items" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST: Tambah barang ke keranjang
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
    const pembelianId = parseInt(id);
    const body = await request.json();
    const { barangId, jumlahDus, hargaPokok, diskonPerItem = 0 } = body;

    // Validasi input
    if (!barangId || !jumlahDus || hargaPokok === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: "barangId, jumlahDus, dan hargaPokok wajib diisi",
        },
        { status: 400 }
      );
    }

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
          error: "Tidak bisa menambah item, pembelian sudah tidak aktif",
        },
        { status: 400 }
      );
    }

    // Cek barang dan pastikan dari supplier yang sama
    const barang = await prisma.barang.findUnique({
      where: { id: barangId },
    });

    if (!barang) {
      return NextResponse.json(
        { success: false, error: "Barang tidak ditemukan" },
        { status: 404 }
      );
    }

    if (barang.supplierId !== pembelian.supplierId) {
      return NextResponse.json(
        { success: false, error: "Barang bukan dari supplier yang dipilih" },
        { status: 400 }
      );
    }

    // Cek apakah barang sudah ada di keranjang
    const existingItem = await prisma.pembelianItem.findFirst({
      where: { pembelianId, barangId },
    });

    let item;
    let message;

    if (existingItem) {
      // Update jumlah jika sudah ada
      item = await prisma.pembelianItem.update({
        where: { id: existingItem.id },
        data: {
          jumlahDus: existingItem.jumlahDus + jumlahDus,
          hargaPokok,
          diskonPerItem,
        },
        include: { barang: true },
      });
      message = "Jumlah barang berhasil ditambah";
    } else {
      // Buat item baru
      item = await prisma.pembelianItem.create({
        data: {
          pembelianId,
          barangId,
          jumlahDus,
          hargaPokok,
          diskonPerItem,
        },
        include: { barang: true },
      });
      message = "Barang berhasil ditambahkan ke keranjang";
    }

    // Update totals
    await updatePembelianTotals(pembelianId);

    // Ambil pembelian updated
    const updatedPembelian = await prisma.pembelianHeader.findUnique({
      where: { id: pembelianId },
      include: {
        supplier: true,
        items: {
          include: { barang: true },
          orderBy: { id: "asc" },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message,
        data: { item, pembelian: updatedPembelian },
      },
      { status: existingItem ? 200 : 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Gagal menambahkan barang" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
