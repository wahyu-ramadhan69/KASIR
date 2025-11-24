// =====================================================
// PATH: app/api/laporan/transaksi/route.ts
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET: Ambil laporan transaksi dengan pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");
    const statusPembayaran = searchParams.get("statusPembayaran");

    // Build where clause
    const where: any = {
      statusTransaksi: "SELESAI",
    };

    // Filter tanggal
    if (startDate || endDate) {
      where.tanggalTransaksi = {};
      if (startDate) {
        where.tanggalTransaksi.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.tanggalTransaksi.lte = end;
      }
    }

    // Filter status pembayaran
    if (statusPembayaran && statusPembayaran !== "all") {
      where.statusPembayaran = statusPembayaran;
    }

    // Search
    if (search) {
      where.OR = [
        { kodePenjualan: { contains: search, mode: "insensitive" } },
        { namaCustomer: { contains: search, mode: "insensitive" } },
        { customer: { nama: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Get total count
    const totalCount = await prisma.penjualanHeader.count({ where });

    // Get paginated data
    const skip = (page - 1) * limit;
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
      skip,
      take: limit,
    });

    // Hitung statistik untuk page ini
    let totalPenjualan = 0;
    let totalModal = 0;
    let totalLaba = 0;
    let jumlahItem = 0;
    let totalDus = 0;
    let totalPcs = 0;

    penjualanList.forEach((penjualan) => {
      totalPenjualan += penjualan.totalHarga;

      penjualan.items.forEach((item) => {
        jumlahItem += item.jumlahDus + (item.jumlahPcs > 0 ? 1 : 0);
        totalDus += item.jumlahDus;
        totalPcs += item.jumlahPcs;

        // Hitung modal
        const modalDus = item.hargaBeli * item.jumlahDus;
        const modalPcs =
          item.jumlahPcs > 0
            ? Math.round(
                (item.hargaBeli / item.barang.jumlahPerkardus) * item.jumlahPcs
              )
            : 0;
        totalModal += modalDus + modalPcs;

        // Ambil laba
        totalLaba += item.laba;
      });
    });

    // Hitung statistik keseluruhan (untuk filter yang aktif)
    const allPenjualan = await prisma.penjualanHeader.findMany({
      where,
      include: {
        items: {
          include: {
            barang: true,
          },
        },
      },
    });

    let totalPenjualanAll = 0;
    let totalModalAll = 0;
    let totalLabaAll = 0;
    let jumlahItemAll = 0;
    let totalDusAll = 0;
    let totalPcsAll = 0;

    allPenjualan.forEach((penjualan) => {
      totalPenjualanAll += penjualan.totalHarga;

      penjualan.items.forEach((item) => {
        jumlahItemAll += item.jumlahDus;
        totalDusAll += item.jumlahDus;
        totalPcsAll += item.jumlahPcs;

        const modalDus = item.hargaBeli * item.jumlahDus;
        const modalPcs =
          item.jumlahPcs > 0
            ? Math.round(
                (item.hargaBeli / item.barang.jumlahPerkardus) * item.jumlahPcs
              )
            : 0;
        totalModalAll += modalDus + modalPcs;
        totalLabaAll += item.laba;
      });
    });

    const marginPersen =
      totalPenjualanAll > 0 ? (totalLabaAll / totalPenjualanAll) * 100 : 0;

    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return NextResponse.json({
      success: true,
      data: penjualanList,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore,
      },
      stats: {
        // Stats untuk page ini
        currentPage: {
          totalPenjualan,
          totalModal,
          totalLaba,
          jumlahItem,
          totalDus,
          totalPcs,
        },
        // Stats keseluruhan (filtered)
        overall: {
          totalPenjualan: totalPenjualanAll,
          totalModal: totalModalAll,
          totalLaba: totalLabaAll,
          marginPersen,
          jumlahTransaksi: allPenjualan.length,
          jumlahItem: jumlahItemAll,
          totalDus: totalDusAll,
          totalPcs: totalPcsAll,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching laporan transaksi:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data laporan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
