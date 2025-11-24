// =====================================================
// PATH: app/api/penjualan/[id]/route.ts
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
      penjualan.diskonNota
    );

    return NextResponse.json({
      success: true,
      data: {
        ...penjualan,
        calculation,
      },
    });
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
      updateData.diskonNota = body.diskonNota;
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
      body.diskonNota ?? penjualan.diskonNota
    );

    updateData.subtotal = calculation.ringkasan.subtotal;
    updateData.totalHarga = calculation.ringkasan.totalHarga;

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

    return NextResponse.json({
      success: true,
      message: "Penjualan berhasil diupdate",
      data: {
        ...updated,
        calculation: calculatePenjualan(updated.items, updated.diskonNota),
      },
    });
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
          const totalPcs =
            item.jumlahDus * (item.barang?.jumlahPerkardus || 1) +
            (item.jumlahPcs || 0);
          await tx.barang.update({
            where: { id: item.barangId },
            data: {
              stok: { increment: totalPcs },
            },
          });
        }

        // =====================================================
        // KURANGI PIUTANG CUSTOMER JIKA TRANSAKSI HUTANG
        // =====================================================
        if (penjualan.statusPembayaran === "HUTANG" && penjualan.customerId) {
          // Hitung sisa hutang yang belum dibayar
          const sisaHutang = penjualan.totalHarga - penjualan.jumlahDibayar;

          if (sisaHutang > 0) {
            await tx.customer.update({
              where: { id: penjualan.customerId },
              data: {
                piutang: { decrement: sisaHutang },
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
