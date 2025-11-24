// app/api/penjualan/summary-30-hari/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const today = new Date();
    const startDate = new Date();
    // 30 hari terakhir (hari ini + 29 ke belakang)
    startDate.setDate(startDate.getDate() - 29);

    // 1) Penjualan per hari (PenjualanHeader)
    const penjualanHeaders = await prisma.penjualanHeader.findMany({
      where: {
        tanggalTransaksi: {
          gte: startDate,
          lte: today,
        },
        // kalau mau filter statusTransaksi SELESAI bisa pakai:
        // statusTransaksi: "SELESAI",
      },
      select: {
        id: true,
        tanggalTransaksi: true,
        totalHarga: true,
      },
    });

    // 2) Pengeluaran per hari (Pengeluaran)
    const pengeluaran = await prisma.pengeluaran.findMany({
      where: {
        tanggalInput: {
          gte: startDate,
          lte: today,
        },
      },
      select: {
        tanggalInput: true,
        jumlah: true,
      },
    });

    // 3) Laba per hari dari PenjualanItem.laba
    //    Filter berdasarkan tanggalTransaksi PenjualanHeader
    const labaItems = await prisma.penjualanItem.findMany({
      where: {
        penjualan: {
          tanggalTransaksi: {
            gte: startDate,
            lte: today,
          },
        },
      },
      select: {
        laba: true,
        penjualan: {
          select: { tanggalTransaksi: true },
        },
      },
    });

    // Map tanggal → { penjualan, pengeluaran, laba }
    type DailyValue = {
      penjualan: number;
      pengeluaran: number;
      laba: number;
    };

    const dataMap: Record<string, DailyValue> = {};

    // Inisialisasi semua hari dalam range dengan 0
    const cursor = new Date(startDate);
    while (cursor <= today) {
      const key = cursor.toISOString().slice(0, 10); // YYYY-MM-DD
      dataMap[key] = { penjualan: 0, pengeluaran: 0, laba: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }

    // Isi penjualan (totalHarga) per hari
    for (const h of penjualanHeaders) {
      const key = h.tanggalTransaksi.toISOString().slice(0, 10);
      if (!dataMap[key]) {
        dataMap[key] = { penjualan: 0, pengeluaran: 0, laba: 0 };
      }
      dataMap[key].penjualan += h.totalHarga;
    }

    // Isi pengeluaran per hari
    for (const e of pengeluaran) {
      const key = e.tanggalInput.toISOString().slice(0, 10);
      if (!dataMap[key]) {
        dataMap[key] = { penjualan: 0, pengeluaran: 0, laba: 0 };
      }
      dataMap[key].pengeluaran += e.jumlah;
    }

    // Isi laba per hari dari PenjualanItem.laba
    for (const item of labaItems) {
      const key = item.penjualan.tanggalTransaksi.toISOString().slice(0, 10);
      if (!dataMap[key]) {
        dataMap[key] = { penjualan: 0, pengeluaran: 0, laba: 0 };
      }
      dataMap[key].laba += item.laba;
    }

    // Convert ke array & sort berdasarkan tanggal
    const data = Object.entries(dataMap)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, value]) => ({
        date,
        penjualan: value.penjualan,
        pengeluaran: value.pengeluaran,
        laba: value.laba,
      }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error summary 30 hari:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data" },
      { status: 500 }
    );
  }
}
