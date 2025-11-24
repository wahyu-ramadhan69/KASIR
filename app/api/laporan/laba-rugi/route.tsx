// =====================================================
// PATH: app/api/laporan/laba-rugi/route.ts
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET: Ambil laporan laba/rugi
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build where clause
    const where: any = {
      statusTransaksi: "SELESAI",
    };

    if (startDate || endDate) {
      where.tanggalTransaksi = {};
      if (startDate) {
        where.tanggalTransaksi.gte = new Date(startDate);
      }
      if (endDate) {
        // Set ke akhir hari
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.tanggalTransaksi.lte = end;
      }
    }

    // Ambil data penjualan dengan items
    const penjualanList = await prisma.penjualanHeader.findMany({
      where,
      include: {
        customer: true,
        items: {
          include: {
            barang: true,
          },
        },
      },
      orderBy: {
        tanggalTransaksi: "desc",
      },
    });

    // Hitung statistik
    let totalPenjualan = 0;
    let totalModal = 0;
    let totalLaba = 0;
    let jumlahItem = 0;

    penjualanList.forEach((penjualan) => {
      totalPenjualan += penjualan.totalHarga;

      penjualan.items.forEach((item) => {
        jumlahItem += item.jumlahDus + (item.jumlahPcs > 0 ? 1 : 0);

        // Hitung modal
        const modalDus = item.hargaBeli * item.jumlahDus;
        const modalPcs =
          item.jumlahPcs > 0
            ? Math.round(
                (item.hargaBeli / item.barang.jumlahPerkardus) * item.jumlahPcs
              )
            : 0;
        totalModal += modalDus + modalPcs;

        // Ambil laba yang sudah tersimpan
        totalLaba += item.laba;
      });
    });

    const marginPersen =
      totalPenjualan > 0 ? (totalLaba / totalPenjualan) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: penjualanList,
      stats: {
        totalPenjualan,
        totalModal,
        totalLaba,
        marginPersen,
        jumlahTransaksi: penjualanList.length,
        jumlahItem,
      },
    });
  } catch (error) {
    console.error("Error fetching laporan laba/rugi:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data laporan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
