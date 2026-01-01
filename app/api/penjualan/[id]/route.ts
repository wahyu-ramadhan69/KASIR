// app/api/penjualan/[id]/route.ts
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

function deriveDusPcsFromTotal(totalItem: number, jumlahPerKemasan: number) {
  const perKemasan = Math.max(1, jumlahPerKemasan);
  const jumlahDus = Math.floor(totalItem / perKemasan);
  const jumlahPcs = totalItem % perKemasan;
  return { jumlahDus, jumlahPcs };
}

function getTotalItemPcs(item: any, jumlahPerKemasan: number): number {
  if (item.totalItem !== undefined && item.totalItem !== null) {
    return toNumber(item.totalItem);
  }
  const jumlahDus = toNumber(item.jumlahDus);
  const jumlahPcs = toNumber(item.jumlahPcs);
  return jumlahDus * jumlahPerKemasan + jumlahPcs;
}

// Helper function untuk menghitung total penjualan
const calculatePenjualan = (items: any[], diskonNota: number = 0) => {
  let subtotal = 0;
  let totalDiskonItem = 0;

  const calculatedItems = items.map((item) => {
    const hargaJual = toNumber(item.hargaJual);
    const diskonPerItem = toNumber(item.diskonPerItem);
    const jumlahPerKemasan = toNumber(item.barang?.jumlahPerKemasan || 1);

    const totalPcs = getTotalItemPcs(item, jumlahPerKemasan);
    const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
      totalPcs,
      jumlahPerKemasan
    );
    const hargaTotal = hargaJual * jumlahDus;
    const hargaPcs =
      jumlahPcs > 0 ? Math.round((hargaJual / jumlahPerKemasan) * jumlahPcs) : 0;
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

// GET: Ambil detail penjualan by ID
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
    const penjualanId = parseInt(id);

    const penjualan = await prisma.penjualanHeader.findUnique({
      where: { id: penjualanId },
      include: {
        customer: true,
        karyawan: true,
        pembayaran: {
          orderBy: { tanggalBayar: "desc" },
        },
        items: {
          include: {
            barang: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!penjualan) {
      return NextResponse.json(
        { success: false, error: "Penjualan tidak ditemukan" },
        { status: 404 }
      );
    }

    // Add calculation
    const penjualanWithCalculation = {
      ...penjualan,
      calculation: calculatePenjualan(
        penjualan.items,
        Number(penjualan.diskonNota)
      ),
    };

    return NextResponse.json(
      deepSerialize({
        success: true,
        data: penjualanWithCalculation,
      })
    );
  } catch (err) {
    console.error("Error fetching penjualan detail:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil detail penjualan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT: Update penjualan (untuk update diskon nota, dll)
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
    const penjualanId = parseInt(id);
    const body = await request.json();

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

    // Build update data
    const updateData: any = {};

    if (body.diskonNota !== undefined) {
      updateData.diskonNota = BigInt(body.diskonNota);
    }

    // Update penjualan
    const updated = await prisma.penjualanHeader.update({
      where: { id: penjualanId },
      data: updateData,
      include: {
        customer: true,
        items: {
          include: { barang: true },
        },
      },
    });

    // Recalculate total
    const items = await prisma.penjualanItem.findMany({
      where: { penjualanId },
      include: { barang: true },
    });

    const diskonNota = toNumber(updated.diskonNota || 0);
    const calculation = calculatePenjualan(items, diskonNota);

    // Update total harga
    await prisma.penjualanHeader.update({
      where: { id: penjualanId },
      data: {
        totalHarga: BigInt(calculation.ringkasan.totalHarga),
      },
    });

    // Fetch updated data
    const finalData = await prisma.penjualanHeader.findUnique({
      where: { id: penjualanId },
      include: {
        customer: true,
        items: {
          include: { barang: true },
        },
      },
    });

    return NextResponse.json(
      deepSerialize({
        success: true,
        message: "Penjualan berhasil diupdate",
        data: finalData,
      })
    );
  } catch (err) {
    console.error("Error updating penjualan:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengupdate penjualan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PATCH: Update customer dan karyawan
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const penjualanId = parseInt(id);
    const body = await request.json();

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

    // Build update data
    const updateData: any = {};

    if (body.customerId !== undefined && body.customerId !== null) {
      updateData.customerId = parseInt(body.customerId);
    }

    if (body.karyawanId !== undefined && body.karyawanId !== null) {
      updateData.karyawanId = parseInt(body.karyawanId);
    }

    if (body.namaCustomer !== undefined) {
      updateData.namaCustomer = body.namaCustomer;
    }

    if (body.namaSales !== undefined) {
      updateData.namaSales = body.namaSales;
    }

    // Validasi minimal ada data yang di-update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada data yang di-update" },
        { status: 400 }
      );
    }

    // Update penjualan
    const updated = await prisma.penjualanHeader.update({
      where: { id: penjualanId },
      data: updateData,
      include: {
        customer: true,
        karyawan: true,
        items: {
          include: { barang: true },
        },
      },
    });

    return NextResponse.json(
      deepSerialize({
        success: true,
        message: "Customer dan karyawan berhasil diupdate",
        data: updated,
      })
    );
  } catch (err) {
    console.error("Error updating customer/karyawan:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengupdate customer/karyawan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE: Cancel/batalkan penjualan
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
    const penjualanId = parseInt(id);

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
        {
          success: false,
          error: "Hanya penjualan dengan status KERANJANG yang bisa dibatalkan",
        },
        { status: 400 }
      );
    }

    // Delete penjualan (items will be cascade deleted)
    await prisma.penjualanHeader.delete({
      where: { id: penjualanId },
    });

    return NextResponse.json({
      success: true,
      message: "Penjualan berhasil dibatalkan",
    });
  } catch (err) {
    console.error("Error deleting penjualan:", err);
    return NextResponse.json(
      { success: false, error: "Gagal membatalkan penjualan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
