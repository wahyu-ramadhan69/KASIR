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
  const totalItem = bigIntToNumber(item.totalItem);
  const jumlahPerKemasan = item.barang
    ? bigIntToNumber(item.barang.jumlahPerKemasan)
    : 0;
  const jumlahDus =
    jumlahPerKemasan > 0 ? totalItem / jumlahPerKemasan : 0;

  return {
    ...item,
    id: Number(item.id),
    pembelianId: Number(item.pembelianId),
    barangId: Number(item.barangId),
    hargaPokok: bigIntToNumber(item.hargaPokok),
    diskonPerItem: bigIntToNumber(item.diskonPerItem),
    totalItem,
    jumlahDus,
    barang: item.barang
      ? {
          ...item.barang,
          id: Number(item.barang.id),
          hargaBeli: bigIntToNumber(item.barang.hargaBeli),
          hargaJual: bigIntToNumber(item.barang.hargaJual),
          stok: bigIntToNumber(item.barang.stok),
          jumlahPerKemasan: bigIntToNumber(item.barang.jumlahPerKemasan),
          ukuran: bigIntToNumber(item.barang.ukuran),
          berat: bigIntToNumber(item.barang.berat),
          limitStok: bigIntToNumber(item.barang.limitStok),
          limitPenjualan: bigIntToNumber(item.barang.limitPenjualan),
        }
      : undefined,
  };
}

function serializePembelian(p: any) {
  return {
    ...p,
    id: Number(p.id),
    supplierId: Number(p.supplierId),
    subtotal: bigIntToNumber(p.subtotal),
    diskonNota: bigIntToNumber(p.diskonNota),
    totalHarga: bigIntToNumber(p.totalHarga),
    jumlahDibayar: bigIntToNumber(p.jumlahDibayar),
    kembalian: bigIntToNumber(p.kembalian),

    supplier: p.supplier
      ? {
          ...p.supplier,
          id: Number(p.supplier.id),
          limitHutang: bigIntToNumber(p.supplier.limitHutang),
          hutang: bigIntToNumber(p.supplier.hutang),
        }
      : undefined,

    items: p.items?.map(serializeItem),
  };
}

// Helper: Update totals di header
async function updatePembelianTotals(pembelianId: number) {
  const items = await prisma.pembelianItem.findMany({
    where: { pembelianId },
    include: { barang: true },
  });

  const subtotal = items.reduce((total, item) => {
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
      const hargaPokok = bigIntToNumber(item.hargaPokok);
      const totalItem = bigIntToNumber(item.totalItem);
      const jumlahPerKemasan = bigIntToNumber(item.barang.jumlahPerKemasan);
      const jumlahDus =
        jumlahPerKemasan > 0 ? totalItem / jumlahPerKemasan : 0;
      const diskonPerItem = bigIntToNumber(item.diskonPerItem);
      const totalHarga = hargaPokok * jumlahDus;
      const totalDiskon = diskonPerItem * jumlahDus;

      return {
        ...serializeItem(item),
        totalHarga,
        totalDiskon,
        subtotal: totalHarga - totalDiskon,
      };
    });

    return NextResponse.json({ success: true, data: itemsWithCalc });
  } catch (err) {
    console.error("Error fetching items:", err);
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
    const { barangId, jumlahDus, totalItem, hargaPokok, diskonPerItem = 0 } =
      body;

    // Validasi input
    if (!barangId || (jumlahDus === undefined && totalItem === undefined) || hargaPokok === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: "barangId, totalItem/jumlahDus, dan hargaPokok wajib diisi",
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

    const jumlahPerKemasan = bigIntToNumber(barang.jumlahPerKemasan);
    const normalizedTotalItem =
      totalItem !== undefined
        ? Number(totalItem)
        : Number(jumlahDus) * jumlahPerKemasan;

    // Cek apakah barang sudah ada di keranjang
    const existingItem = await prisma.pembelianItem.findFirst({
      where: { pembelianId, barangId },
    });

    let item;
    let message;

    if (existingItem) {
      // Update jumlah jika sudah ada
      const newTotalItem =
        bigIntToNumber(existingItem.totalItem) + normalizedTotalItem;
      item = await prisma.pembelianItem.update({
        where: { id: existingItem.id },
        data: {
          totalItem: BigInt(newTotalItem),
          hargaPokok: BigInt(hargaPokok),
          diskonPerItem: BigInt(diskonPerItem),
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
          totalItem: BigInt(normalizedTotalItem),
          hargaPokok: BigInt(hargaPokok),
          diskonPerItem: BigInt(diskonPerItem),
        },
        include: { barang: true },
      });
      message = "Barang berhasil ditambahkan ke keranjang";
    }

    // Update totals
    await updatePembelianTotals(pembelianId);

    // Ambil pembelian updated dengan calculation
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

    // Hitung calculation
    let pembelianWithCalc = null;
    if (updatedPembelian) {
      const items = updatedPembelian.items.map((item: any) => {
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
          totalItem,
          hargaPokok,
          totalHarga,
          diskonPerItem,
          totalDiskon,
          subtotal,
        };
      });

      const totalSebelumDiskon = items.reduce(
        (sum, item) => sum + item.totalHarga,
        0
      );
      const totalDiskonItem = items.reduce(
        (sum, item) => sum + item.totalDiskon,
        0
      );
      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      const diskonNota = bigIntToNumber(updatedPembelian.diskonNota) || 0;
      const totalHarga = subtotal - diskonNota;
      const jumlahDibayar = bigIntToNumber(updatedPembelian.jumlahDibayar) || 0;
      const kembalian =
        jumlahDibayar > totalHarga ? jumlahDibayar - totalHarga : 0;
      const sisaHutang =
        jumlahDibayar < totalHarga ? totalHarga - jumlahDibayar : 0;

      pembelianWithCalc = {
        ...serializePembelian(updatedPembelian),
        calculation: {
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
              sisaHutang > 0 ? "HUTANG" : kembalian >= 0 ? "LUNAS" : "KURANG",
          },
        },
      };
    }

    return NextResponse.json(
      {
        success: true,
        message,
        data: {
          item: serializeItem(item),
          pembelian: pembelianWithCalc,
        },
      },
      { status: existingItem ? 200 : 201 }
    );
  } catch (err) {
    console.error("Error adding item:", err);
    return NextResponse.json(
      { success: false, error: "Gagal menambahkan barang" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
