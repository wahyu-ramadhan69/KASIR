import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Utility functions
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

function toNumber(value: any): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value || 0);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");
    const statusPembayaran = searchParams.get("statusPembayaran");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      statusTransaksi: "SELESAI", // Only completed transactions
    };

    // Date filter - Use tanggalTransaksi
    if (startDate || endDate) {
      where.tanggalTransaksi = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.tanggalTransaksi.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.tanggalTransaksi.lte = end;
      }
    }

    // Search filter
    if (search) {
      where.OR = [
        { kodePenjualan: { contains: search, mode: "insensitive" } },
        { namaCustomer: { contains: search, mode: "insensitive" } },
        {
          customer: {
            nama: { contains: search, mode: "insensitive" },
          },
        },
        {
          sales: {
            namaSales: { contains: search, mode: "insensitive" },
          },
        },
        { namaSales: { contains: search, mode: "insensitive" } },
      ];
    }

    // Status pembayaran filter
    if (statusPembayaran && statusPembayaran !== "all") {
      where.statusPembayaran = statusPembayaran;
    }

    // Get total count
    const totalCount = await prisma.penjualanHeader.count({ where });

    // Get paginated data
    const penjualanList = await prisma.penjualanHeader.findMany({
      where,
      skip,
      take: limit,
      orderBy: { tanggalTransaksi: "desc" },
      include: {
        customer: {
          select: {
            id: true,
            nama: true,
            namaToko: true,
          },
        },
        sales: {
          select: {
            id: true,
            namaSales: true,
          },
        },
        items: {
          include: {
            barang: {
              select: {
                id: true,
                namaBarang: true,
                ukuran: true,
                satuan: true,
                jumlahPerkardus: true,
              },
            },
          },
        },
      },
    });

    // Calculate stats for current page
    let totalPenjualan = 0;
    let totalModal = 0;
    let totalLaba = 0;
    let jumlahItem = 0;
    let totalDus = 0;
    let totalPcs = 0;

    penjualanList.forEach((penjualan) => {
      totalPenjualan += toNumber(penjualan.totalHarga);

      penjualan.items.forEach((item) => {
        const jumlahDus = toNumber(item.jumlahDus);
        const jumlahPcs = toNumber(item.jumlahPcs);
        const hargaBeli = toNumber(item.hargaBeli);
        const laba = toNumber(item.laba);
        const jumlahPerkardus = toNumber(item.barang.jumlahPerkardus);

        // Calculate modal
        const modalDus = hargaBeli * jumlahDus;
        const modalPcs =
          jumlahPcs > 0
            ? Math.round((hargaBeli / jumlahPerkardus) * jumlahPcs)
            : 0;
        totalModal += modalDus + modalPcs;

        // Sum laba
        totalLaba += laba;

        // Count items
        jumlahItem++;
        totalDus += jumlahDus;
        totalPcs += jumlahDus * jumlahPerkardus + jumlahPcs;
      });
    });

    // Calculate stats for all data (filtered)
    const allPenjualan = await prisma.penjualanHeader.findMany({
      where,
      include: {
        items: {
          include: {
            barang: {
              select: {
                jumlahPerkardus: true,
              },
            },
          },
        },
        sales: {
          select: {
            id: true,
            namaSales: true,
          },
        },
        customer: {
          select: {
            id: true,
            nama: true,
            namaToko: true,
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
      totalPenjualanAll += toNumber(penjualan.totalHarga);

      penjualan.items.forEach((item) => {
        const jumlahDus = toNumber(item.jumlahDus);
        const jumlahPcs = toNumber(item.jumlahPcs);
        const hargaBeli = toNumber(item.hargaBeli);
        const laba = toNumber(item.laba);
        const jumlahPerkardus = toNumber(item.barang.jumlahPerkardus);

        const modalDus = hargaBeli * jumlahDus;
        const modalPcs =
          jumlahPcs > 0
            ? Math.round((hargaBeli / jumlahPerkardus) * jumlahPcs)
            : 0;
        totalModalAll += modalDus + modalPcs;

        totalLabaAll += laba;

        jumlahItemAll++;
        totalDusAll += jumlahDus;
        totalPcsAll += jumlahDus * jumlahPerkardus + jumlahPcs;
      });
    });

    const marginPersen =
      totalPenjualanAll > 0 ? (totalLabaAll / totalPenjualanAll) * 100 : 0;

    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return NextResponse.json(
      deepSerialize({
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
            marginPersen:
              totalPenjualan > 0 ? (totalLaba / totalPenjualan) * 100 : 0,
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
      })
    );
  } catch (error) {
    console.error("Error fetching penjualan:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch penjualan data" },
      { status: 500 }
    );
  }
}
