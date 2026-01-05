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

    // Hitung tanggal mulai berdasarkan rentang hari
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - rentangHari);

    // Query untuk mendapatkan data penjualan
    const penjualanItems = await prisma.penjualanItem.findMany({
      where: {
        penjualan: {
          statusTransaksi: "SELESAI",
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
