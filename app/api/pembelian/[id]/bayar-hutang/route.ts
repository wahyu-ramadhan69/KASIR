import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Helper: Hitung ulang total hutang supplier dari semua transaksi
async function recalculateSupplierHutang(tx: any, supplierId: number) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pembelianHutang = await tx.pembelianHeader.findMany({
    where: {
      supplierId: supplierId,
      statusTransaksi: "SELESAI",
      statusPembayaran: "HUTANG",
    },
    select: {
      totalHarga: true,
      jumlahDibayar: true,
    },
  });

  const totalHutang = pembelianHutang.reduce((sum: number, pb: any) => {
    return sum + (pb.totalHarga - pb.jumlahDibayar);
  }, 0);

  await tx.supplier.update({
    where: { id: supplierId },
    data: { hutang: Math.max(0, totalHutang) }, // Pastikan tidak minus
  });

  return totalHutang;
}

// POST: Lunasi hutang pada pembelian tertentu
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
    const { jumlahBayar } = body;

    // Validasi
    if (!jumlahBayar || jumlahBayar <= 0) {
      return NextResponse.json(
        { success: false, error: "Jumlah pembayaran harus lebih dari 0" },
        { status: 400 }
      );
    }

    // Ambil pembelian
    const pembelian = await prisma.pembelianHeader.findUnique({
      where: { id: pembelianId },
      include: { supplier: true },
    });

    if (!pembelian) {
      return NextResponse.json(
        { success: false, error: "Pembelian tidak ditemukan" },
        { status: 404 }
      );
    }

    if (pembelian.statusTransaksi !== "SELESAI") {
      return NextResponse.json(
        {
          success: false,
          error: "Hanya pembelian yang sudah selesai yang bisa dilunasi",
        },
        { status: 400 }
      );
    }

    if (pembelian.statusPembayaran === "LUNAS") {
      return NextResponse.json(
        { success: false, error: "Pembelian sudah lunas" },
        { status: 400 }
      );
    }

    // Hitung sisa hutang saat ini
    const sisaHutangSekarang = pembelian.totalHarga - pembelian.jumlahDibayar;

    if (sisaHutangSekarang <= 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada hutang pada pembelian ini" },
        { status: 400 }
      );
    }

    // Hitung pembayaran
    const jumlahBayarInt = parseInt(jumlahBayar);
    const pembayaranEfektif = Math.min(jumlahBayarInt, sisaHutangSekarang);
    const kembalian =
      jumlahBayarInt > sisaHutangSekarang
        ? jumlahBayarInt - sisaHutangSekarang
        : 0;
    const sisaHutangBaru = sisaHutangSekarang - pembayaranEfektif;
    const jumlahDibayarBaru = pembelian.jumlahDibayar + pembayaranEfektif;
    const statusPembayaranBaru = sisaHutangBaru <= 0 ? "LUNAS" : "HUTANG";

    // Transaction: Update pembelian dan hitung ulang hutang supplier
    const result = await prisma.$transaction(async (tx) => {
      // Update pembelian
      const updatedPembelian = await tx.pembelianHeader.update({
        where: { id: pembelianId },
        data: {
          jumlahDibayar: jumlahDibayarBaru,
          kembalian: kembalian,
          statusPembayaran: statusPembayaranBaru,
        },
        include: {
          supplier: true,
          items: {
            include: { barang: true },
          },
        },
      });

      // Hitung ulang hutang supplier (bukan decrement)
      await recalculateSupplierHutang(tx, pembelian.supplierId);

      return updatedPembelian;
    });

    return NextResponse.json({
      success: true,
      message:
        statusPembayaranBaru === "LUNAS"
          ? "Hutang berhasil dilunasi"
          : `Pembayaran berhasil, sisa hutang: Rp ${sisaHutangBaru.toLocaleString(
              "id-ID"
            )}`,
      data: {
        pembelian: result,
        pembayaran: {
          jumlahBayar: jumlahBayarInt,
          pembayaranEfektif,
          kembalian,
          sisaHutangSebelum: sisaHutangSekarang,
          sisaHutangSesudah: sisaHutangBaru,
          statusPembayaran: statusPembayaranBaru,
        },
      },
    });
  } catch (err) {
    console.error("Error paying debt:", err);
    return NextResponse.json(
      { success: false, error: "Gagal melakukan pembayaran hutang" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
