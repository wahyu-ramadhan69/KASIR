// =====================================================
// PATH: app/api/penjualan/[id]/bayar-hutang/route.ts
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// POST: Bayar hutang penjualan
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // PENTING: await params dulu sebelum digunakan
    const { id } = await params;
    const penjualanId = parseInt(id);
    const body = await request.json();
    const { jumlahBayar } = body;

    if (!jumlahBayar || jumlahBayar <= 0) {
      return NextResponse.json(
        { success: false, error: "Jumlah pembayaran tidak valid" },
        { status: 400 }
      );
    }

    // Validasi penjualan
    const penjualan = await prisma.penjualanHeader.findUnique({
      where: { id: penjualanId },
      include: { customer: true },
    });

    if (!penjualan) {
      return NextResponse.json(
        { success: false, error: "Penjualan tidak ditemukan" },
        { status: 404 }
      );
    }

    if (penjualan.statusTransaksi !== "SELESAI") {
      return NextResponse.json(
        { success: false, error: "Penjualan belum selesai" },
        { status: 400 }
      );
    }

    if (penjualan.statusPembayaran === "LUNAS") {
      return NextResponse.json(
        { success: false, error: "Penjualan sudah lunas" },
        { status: 400 }
      );
    }

    // Hitung sisa hutang
    const sisaHutang = penjualan.totalHarga - penjualan.jumlahDibayar;
    const jumlahDibayarBaru = penjualan.jumlahDibayar + jumlahBayar;

    // Determine new status and kembalian
    const isLunas = jumlahDibayarBaru >= penjualan.totalHarga;
    const kembalian = isLunas ? jumlahDibayarBaru - penjualan.totalHarga : 0;

    // Hitung berapa yang benar-benar mengurangi piutang
    // Jika bayar lebih dari sisa hutang, yang mengurangi piutang hanya sebesar sisa hutang
    const penguranganPiutang = Math.min(jumlahBayar, sisaHutang);

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // =====================================================
      // KURANGI PIUTANG CUSTOMER JIKA ADA
      // =====================================================
      if (penjualan.customerId && penguranganPiutang > 0) {
        await tx.customer.update({
          where: { id: penjualan.customerId },
          data: {
            piutang: { decrement: penguranganPiutang },
          },
        });
      }

      // Update penjualan
      const updated = await tx.penjualanHeader.update({
        where: { id: penjualanId },
        data: {
          jumlahDibayar: Math.min(
            jumlahDibayarBaru,
            penjualan.totalHarga + kembalian
          ),
          kembalian: penjualan.kembalian + kembalian,
          statusPembayaran: isLunas ? "LUNAS" : "HUTANG",
        },
        include: { customer: true },
      });

      return updated;
    });

    const sisaHutangBaru = isLunas
      ? 0
      : penjualan.totalHarga - jumlahDibayarBaru;

    return NextResponse.json({
      success: true,
      message: isLunas
        ? `Pembayaran berhasil - LUNAS${
            kembalian > 0
              ? ` (Kembalian: Rp ${kembalian.toLocaleString("id-ID")})`
              : ""
          }`
        : `Pembayaran berhasil - Sisa hutang: Rp ${sisaHutangBaru.toLocaleString(
            "id-ID"
          )}`,
      data: {
        penjualan: result,
        pembayaran: {
          jumlahBayar,
          penguranganPiutang,
          sisaHutangSebelum: sisaHutang,
          sisaHutangSesudah: sisaHutangBaru,
          kembalian,
          statusPembayaran: result.statusPembayaran,
          piutangCustomer: result.customer?.piutang || 0,
        },
      },
    });
  } catch (err) {
    console.error("Error paying debt:", err);
    return NextResponse.json(
      { success: false, error: "Gagal melakukan pembayaran" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
