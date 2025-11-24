// =====================================================
// PATH: app/api/laporan/per-item/route.ts
// UPDATE: Tambah totalDus dan totalPcs di stats
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET: Laporan penjualan per item
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") || "totalTerjual";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const whereHeader: any = {
      statusTransaksi: "SELESAI",
    };

    if (startDate || endDate) {
      whereHeader.tanggalTransaksi = {};
      if (startDate) {
        whereHeader.tanggalTransaksi.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereHeader.tanggalTransaksi.lte = end;
      }
    }

    const allItems = await prisma.penjualanItem.findMany({
      where: {
        penjualan: whereHeader,
      },
      include: {
        barang: true,
        penjualan: {
          select: {
            tanggalTransaksi: true,
          },
        },
      },
    });

    const groupedData = new Map();

    allItems.forEach((item) => {
      const barangId = item.barangId;

      if (!groupedData.has(barangId)) {
        groupedData.set(barangId, {
          barangId: barangId,
          namaBarang: item.barang.namaBarang,
          ukuran: item.barang.ukuran,
          satuan: item.barang.satuan,
          jumlahPerkardus: item.barang.jumlahPerkardus,
          hargaBeliTerakhir: item.hargaBeli,
          hargaJualTerakhir: item.hargaJual,
          totalDusTerjual: 0,
          totalPcsTerjual: 0,
          totalQtyTerjual: 0,
          totalPenjualan: 0,
          totalModal: 0,
          totalLaba: 0,
          totalDiskon: 0,
          jumlahTransaksi: 0,
          transaksiIds: new Set(),
        });
      }

      const data = groupedData.get(barangId);

      data.totalDusTerjual += item.jumlahDus;
      data.totalPcsTerjual += item.jumlahPcs;
      data.totalQtyTerjual +=
        item.jumlahDus * item.barang.jumlahPerkardus + item.jumlahPcs;

      const penjualanDus = item.hargaJual * item.jumlahDus;
      const penjualanPcs =
        item.jumlahPcs > 0
          ? Math.round(
              (item.hargaJual / item.barang.jumlahPerkardus) * item.jumlahPcs
            )
          : 0;
      const totalPenjualanItem = penjualanDus + penjualanPcs;

      const modalDus = item.hargaBeli * item.jumlahDus;
      const modalPcs =
        item.jumlahPcs > 0
          ? Math.round(
              (item.hargaBeli / item.barang.jumlahPerkardus) * item.jumlahPcs
            )
          : 0;
      const totalModalItem = modalDus + modalPcs;

      data.totalPenjualan += totalPenjualanItem;
      data.totalModal += totalModalItem;
      data.totalLaba += item.laba;
      data.totalDiskon += item.diskonPerItem * item.jumlahDus;

      data.hargaBeliTerakhir = item.hargaBeli;
      data.hargaJualTerakhir = item.hargaJual;

      if (!data.transaksiIds.has(item.penjualanId)) {
        data.transaksiIds.add(item.penjualanId);
        data.jumlahTransaksi++;
      }
    });

    let itemList = Array.from(groupedData.values()).map((item) => {
      const margin =
        item.totalPenjualan > 0
          ? (item.totalLaba / item.totalPenjualan) * 100
          : 0;

      return {
        ...item,
        margin: parseFloat(margin.toFixed(2)),
        transaksiIds: undefined,
      };
    });

    if (search) {
      itemList = itemList.filter((item) =>
        item.namaBarang.toLowerCase().includes(search.toLowerCase())
      );
    }

    itemList.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case "totalLaba":
          aVal = a.totalLaba;
          bVal = b.totalLaba;
          break;
        case "margin":
          aVal = a.margin;
          bVal = b.margin;
          break;
        case "totalPenjualan":
          aVal = a.totalPenjualan;
          bVal = b.totalPenjualan;
          break;
        case "totalTerjual":
        default:
          aVal = a.totalQtyTerjual;
          bVal = b.totalQtyTerjual;
          break;
      }

      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });

    const totalItems = itemList.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = itemList.slice(startIndex, endIndex);

    // Hitung total keseluruhan
    let grandTotalDus = 0;
    let grandTotalPcs = 0;
    let grandTotalPenjualan = 0;
    let grandTotalModal = 0;
    let grandTotalLaba = 0;
    let grandTotalDiskon = 0;

    itemList.forEach((item) => {
      grandTotalDus += item.totalDusTerjual;
      grandTotalPcs += item.totalPcsTerjual;
      grandTotalPenjualan += item.totalPenjualan;
      grandTotalModal += item.totalModal;
      grandTotalLaba += item.totalLaba;
      grandTotalDiskon += item.totalDiskon;
    });

    const grandMargin =
      grandTotalPenjualan > 0
        ? (grandTotalLaba / grandTotalPenjualan) * 100
        : 0;

    return NextResponse.json({
      success: true,
      data: paginatedItems,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
      },
      summary: {
        totalDus: grandTotalDus,
        totalPcs: grandTotalPcs,
        totalPenjualan: grandTotalPenjualan,
        totalModal: grandTotalModal,
        totalLaba: grandTotalLaba,
        totalDiskon: grandTotalDiskon,
        margin: parseFloat(grandMargin.toFixed(2)),
        jumlahBarang: totalItems,
      },
    });
  } catch (error) {
    console.error("Error fetching item report:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data laporan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
