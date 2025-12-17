// =====================================================
// PATH: app/api/penjualan-sales/daily-summary/route.ts
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Deep serialize to handle all BigInt
function deepSerialize(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "bigint") {
    return Number(obj);
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepSerialize);
  }

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

// GET: Ambil ringkasan penjualan harian dari sales
export async function GET(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    if (!dateParam) {
      return NextResponse.json(
        { success: false, error: "Parameter date diperlukan" },
        { status: 400 }
      );
    }

    const startDate = new Date(dateParam);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(dateParam);
    endDate.setHours(23, 59, 59, 999);

    // Ambil semua penjualan sales hari ini yang sudah SELESAI
    const penjualan = await prisma.penjualanHeader.findMany({
      where: {
        tanggalTransaksi: {
          gte: startDate,
          lte: endDate,
        },
        statusTransaksi: "SELESAI",
        karyawan: {
          jenis: "SALES",
        },
      },
      include: {
        items: {
          include: {
            barang: true,
          },
        },
      },
    });

    // Aggregate total penjualan per barang
    const salesSummary: { [barangId: number]: number } = {};

    penjualan.forEach((p) => {
      p.items.forEach((item) => {
        const barangId = item.barangId;
        const jumlahDus = Number(item.jumlahDus);
        const jumlahPcs = Number(item.jumlahPcs);
        const jumlahPerKemasan = Number(item.barang.jumlahPerKemasan);

        // Total dalam pcs
        const totalPcs = jumlahDus * jumlahPerKemasan + jumlahPcs;

        if (salesSummary[barangId]) {
          salesSummary[barangId] += totalPcs;
        } else {
          salesSummary[barangId] = totalPcs;
        }
      });
    });

    // Convert ke array
    const summaryArray = Object.entries(salesSummary).map(
      ([barangId, totalTerjual]) => ({
        barangId: parseInt(barangId),
        totalTerjual,
      })
    );

    return NextResponse.json(
      deepSerialize({
        success: true,
        data: summaryArray,
      })
    );
  } catch (err) {
    console.error("Error fetching daily summary:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil ringkasan penjualan harian" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
