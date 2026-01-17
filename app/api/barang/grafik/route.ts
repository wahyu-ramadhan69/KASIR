// app/api/reports/top-products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const searchParams = request.nextUrl.searchParams;
    const periode = searchParams.get("periode") || "HARIAN";
    const rentangHari = parseInt(searchParams.get("rentangHari") || "30");
    const dateParam = searchParams.get("date") || searchParams.get("tanggal");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    let startDate = new Date();
    let endDate = new Date();

    if (dateParam) {
      startDate = new Date(dateParam);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(dateParam);
      endDate.setHours(23, 59, 59, 999);
    } else if (startDateParam || endDateParam) {
      if (startDateParam) {
        const s = new Date(startDateParam);
        s.setHours(0, 0, 0, 0);
        startDate = s;
      }
      if (endDateParam) {
        const e = new Date(endDateParam);
        e.setHours(23, 59, 59, 999);
        endDate = e;
      }
    } else {
      startDate = new Date();
      endDate = new Date();
      startDate.setDate(startDate.getDate() - rentangHari);
    }

    // Query untuk mendapatkan data penjualan
    const penjualanItems = await prisma.penjualanItem.findMany({
      where: {
        penjualan: {
          statusTransaksi: "SELESAI",
          isDeleted: false,
          tanggalTransaksi: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      include: {
        barang: {
          select: {
            namaBarang: true,
            stok: true,
          },
        },
        penjualan: {
          select: {
            tanggalTransaksi: true,
          },
        },
      },
    });

    // Grouping data berdasarkan periode
    const groupedData: Record<
      string,
      {
        namaBarang: string;
        totalTerjual: number;
        totalPenjualan: number;
        sisaStok: number;
      }
    > = {};

    penjualanItems.forEach((item) => {
      const barangKey = item.barang.namaBarang;

      if (!groupedData[barangKey]) {
        groupedData[barangKey] = {
          namaBarang: item.barang.namaBarang,
          totalTerjual: 0,
          totalPenjualan: 0,
          sisaStok: Number(item.barang.stok),
        };
      }

      // Total item terjual sudah tersimpan sebagai totalItem
      const totalPcs = Number(item.totalItem || 0);
      groupedData[barangKey].totalTerjual += totalPcs;

      // Hitung total penjualan dalam rupiah
      const subtotal = totalPcs * Number(item.hargaJual);
      const afterDiskon = subtotal - Number(item.diskonPerItem);
      groupedData[barangKey].totalPenjualan += afterDiskon;
    });

    // Convert ke array dan sort berdasarkan total terjual
    const sortedData = Object.values(groupedData)
      .sort((a, b) => b.totalTerjual - a.totalTerjual)
      .slice(0, 10); // Ambil 10 teratas

    return NextResponse.json(sortedData);
  } catch (error) {
    console.error("Error fetching top products:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
