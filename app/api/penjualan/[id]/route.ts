// =====================================================
// PATH: app/api/penjualan/[id]/route.ts
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Deep serialize to handle all BigInt in nested objects
function deepSerialize(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "bigint") {
    return Number(obj);
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepSerialize);
  }

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

const calculatePenjualan = (items: any[], diskonNota: number = 0) => {
  let subtotal = 0;
  let totalDiskonItem = 0;

  const calculatedItems = items.map((item) => {
    const jumlahDus =
      typeof item.jumlahDus === "bigint"
        ? Number(item.jumlahDus)
        : item.jumlahDus;
    const jumlahPcs =
      typeof item.jumlahPcs === "bigint"
        ? Number(item.jumlahPcs)
        : item.jumlahPcs;
    const hargaJual =
      typeof item.hargaJual === "bigint"
        ? Number(item.hargaJual)
        : item.hargaJual;
    const diskonPerItem =
      typeof item.diskonPerItem === "bigint"
        ? Number(item.diskonPerItem)
        : item.diskonPerItem;
    const jumlahPerkardus =
      typeof item.barang?.jumlahPerkardus === "bigint"
        ? Number(item.barang.jumlahPerkardus)
        : item.barang?.jumlahPerkardus || 1;

    const totalPcs = jumlahDus * jumlahPerkardus + (jumlahPcs || 0);
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

    const calculation = calculatePenjualan(
      penjualan.items,
      Number(penjualan.diskonNota)
    );

    return NextResponse.json(
      deepSerialize({
        success: true,
        data: {
          ...penjualan,
          calculation,
        },
      })
    );
  } catch (err) {
    console.error("Error fetching penjualan:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data penjualan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT: Update penjualan
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
      include: { items: { include: { barang: true } } },
    });

    if (!penjualan) {
      return NextResponse.json(
        { success: false, error: "Penjualan tidak ditemukan" },
        { status: 404 }
      );
    }

    if (penjualan.statusTransaksi !== "KERANJANG") {
      return NextResponse.json(
        { success: false, error: "Penjualan sudah selesai, tidak bisa diubah" },
        { status: 400 }
      );
    }

    const updateData: any = {};

    if (body.customerId !== undefined) {
      if (body.customerId === null) {
        updateData.customerId = null;
      } else {
        updateData.customerId = body.customerId;
        updateData.namaCustomer = null;
      }
    }

    if (body.namaCustomer !== undefined) {
      updateData.namaCustomer = body.namaCustomer;
      if (body.namaCustomer) {
        updateData.customerId = null;
      }
    }

    if (body.diskonNota !== undefined) {
      updateData.diskonNota = BigInt(body.diskonNota);
    }

    if (body.tanggalTransaksi !== undefined) {
      updateData.tanggalTransaksi = new Date(body.tanggalTransaksi);
    }

    if (body.tanggalJatuhTempo !== undefined) {
      updateData.tanggalJatuhTempo = new Date(body.tanggalJatuhTempo);
    }

    if (body.metodePembayaran !== undefined) {
      updateData.metodePembayaran = body.metodePembayaran;
    }

    const calculation = calculatePenjualan(
      penjualan.items,
      body.diskonNota ?? Number(penjualan.diskonNota)
    );

    updateData.subtotal = BigInt(calculation.ringkasan.subtotal);
    updateData.totalHarga = BigInt(calculation.ringkasan.totalHarga);

    const updated = await prisma.penjualanHeader.update({
      where: { id: penjualanId },
      data: updateData,
      include: {
        customer: true,
        items: {
          include: { barang: true },
          orderBy: { id: "asc" },
        },
      },
    });

    return NextResponse.json(
      deepSerialize({
        success: true,
        message: "Penjualan berhasil diupdate",
        data: {
          ...updated,
          calculation: calculatePenjualan(
            updated.items,
            Number(updated.diskonNota)
          ),
        },
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

// DELETE: Batalkan penjualan
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
      include: {
        items: { include: { barang: true } },
        customer: true,
      },
    });

    if (!penjualan) {
      return NextResponse.json(
        { success: false, error: "Penjualan tidak ditemukan" },
        { status: 404 }
      );
    }

    // Tidak bisa membatalkan transaksi yang sudah dibatalkan
    if (penjualan.statusTransaksi === "DIBATALKAN") {
      return NextResponse.json(
        { success: false, error: "Penjualan sudah dibatalkan sebelumnya" },
        { status: 400 }
      );
    }

    // Start transaction
    await prisma.$transaction(async (tx) => {
      // Jika transaksi sudah SELESAI
      if (penjualan.statusTransaksi === "SELESAI") {
        // Kembalikan stok barang
        for (const item of penjualan.items) {
          const jumlahDus = Number(item.jumlahDus);
          const jumlahPcs = Number(item.jumlahPcs);
          const jumlahPerkardus = Number(item.barang?.jumlahPerkardus || 1);
          const totalPcs = jumlahDus * jumlahPerkardus + jumlahPcs;

          await tx.barang.update({
            where: { id: item.barangId },
            data: {
              stok: { increment: BigInt(totalPcs) },
            },
          });
        }

        // Kurangi piutang customer jika transaksi hutang
        if (penjualan.statusPembayaran === "HUTANG" && penjualan.customerId) {
          const totalHarga = Number(penjualan.totalHarga);
          const jumlahDibayar = Number(penjualan.jumlahDibayar);
          const sisaHutang = totalHarga - jumlahDibayar;

          if (sisaHutang > 0) {
            await tx.customer.update({
              where: { id: penjualan.customerId },
              data: {
                piutang: { decrement: BigInt(sisaHutang) },
              },
            });
          }
        }
      }

      // Update status to DIBATALKAN
      await tx.penjualanHeader.update({
        where: { id: penjualanId },
        data: { statusTransaksi: "DIBATALKAN" },
      });
    });

    return NextResponse.json({
      success: true,
      message:
        "Penjualan berhasil dibatalkan. Stok barang dan piutang customer telah dikembalikan.",
    });
  } catch (err) {
    console.error("Error canceling penjualan:", err);
    return NextResponse.json(
      { success: false, error: "Gagal membatalkan penjualan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
