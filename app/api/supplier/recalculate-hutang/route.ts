import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// POST: Recalculate hutang untuk semua supplier berdasarkan transaksi
export async function POST(request: NextRequest) {
  try {
    // Ambil semua supplier
    const suppliers = await prisma.supplier.findMany();

    const results = [];

    for (const supplier of suppliers) {
      // Hitung total hutang dari pembelian yang status HUTANG dan SELESAI
      const pembelianHutang = await prisma.pembelianHeader.findMany({
        where: {
          supplierId: supplier.id,
          statusPembayaran: "HUTANG",
          statusTransaksi: "SELESAI",
        },
        select: {
          id: true,
          kodePembelian: true,
          totalHarga: true,
          jumlahDibayar: true,
        },
      });

      // Hitung total sisa hutang
      const totalHutang = pembelianHutang.reduce((sum, pb) => {
        return sum + (pb.totalHarga - pb.jumlahDibayar);
      }, 0);

      // Pastikan tidak minus
      const hutangFinal = Math.max(0, totalHutang);

      // Update hutang di supplier
      await prisma.supplier.update({
        where: { id: supplier.id },
        data: { hutang: hutangFinal },
      });

      results.push({
        supplierId: supplier.id,
        namaSupplier: supplier.namaSupplier,
        hutangSebelum: supplier.hutang,
        hutangSesudah: hutangFinal,
        jumlahTransaksiHutang: pembelianHutang.length,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Recalculate hutang supplier berhasil",
      data: results,
    });
  } catch (err) {
    console.error("Error recalculating hutang:", err);
    return NextResponse.json(
      { success: false, error: "Gagal recalculate hutang" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET: Lihat summary hutang per supplier
export async function GET(request: NextRequest) {
  try {
    const suppliers = await prisma.supplier.findMany({
      select: {
        id: true,
        namaSupplier: true,
        hutang: true,
        limitHutang: true,
      },
    });

    const summary = [];

    for (const supplier of suppliers) {
      // Hitung hutang dari transaksi
      const pembelianHutang = await prisma.pembelianHeader.findMany({
        where: {
          supplierId: supplier.id,
          statusPembayaran: "HUTANG",
          statusTransaksi: "SELESAI",
        },
        select: {
          kodePembelian: true,
          totalHarga: true,
          jumlahDibayar: true,
          createdAt: true,
        },
      });

      const totalHutangDariTransaksi = pembelianHutang.reduce((sum, pb) => {
        return sum + (pb.totalHarga - pb.jumlahDibayar);
      }, 0);

      summary.push({
        supplier: {
          id: supplier.id,
          nama: supplier.namaSupplier,
          limitHutang: supplier.limitHutang,
        },
        hutangDiDatabase: supplier.hutang,
        hutangDariTransaksi: totalHutangDariTransaksi,
        selisih: supplier.hutang - totalHutangDariTransaksi,
        perluFix: supplier.hutang !== totalHutangDariTransaksi,
        transaksiHutang: pembelianHutang,
      });
    }

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    console.error("Error getting hutang summary:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil summary hutang" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
