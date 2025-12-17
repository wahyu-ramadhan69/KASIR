// app/api/penjualan-luar-kota/[id]/rekonsiliasi/route.ts

import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/penjualan-luar-kota/[id]/rekonsiliasi
 * Get rekonsiliasi barang (manifest vs terjual vs kembali)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const perjalananId = parseInt(id);

    if (isNaN(perjalananId)) {
      return Response.json(
        {
          success: false,
          message: "ID perjalanan tidak valid",
        },
        { status: 400 }
      );
    }

    // Get perjalanan detail
    const perjalanan = await prisma.perjalananSales.findUnique({
      where: { id: perjalananId },
      include: {
        manifestBarang: {
          include: {
            barang: {
              select: {
                id: true,
                namaBarang: true,
                satuan: true,
                jumlahPerKemasan: true,
              },
            },
          },
        },
        penjualanHeaders: {
          include: {
            items: {
              include: {
                barang: {
                  select: {
                    jumlahPerKemasan: true,
                  },
                },
              },
            },
          },
        },
        pengembalianBarang: {
          include: {
            barang: {
              select: {
                jumlahPerKemasan: true,
              },
            },
          },
        },
      },
    });

    if (!perjalanan) {
      return Response.json(
        {
          success: false,
          message: "Perjalanan tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // Hitung rekonsiliasi per barang
    const rekonsiliasi = [];

    for (const manifest of perjalanan.manifestBarang) {
      // Hitung total terjual dari semua penjualan
      let totalTerjualPcs = 0;
      for (const penjualan of perjalanan.penjualanHeaders) {
        for (const item of penjualan.items) {
          if (item.barangId === manifest.barangId) {
            const pcs =
              Number(item.jumlahDus) * Number(item.barang.jumlahPerKemasan) +
              Number(item.jumlahPcs);
            totalTerjualPcs += pcs;
          }
        }
      }

      // Hitung total kembali
      let totalKembaliPcs = 0;
      for (const pengembalian of perjalanan.pengembalianBarang) {
        if (pengembalian.barangId === manifest.barangId) {
          const pcs =
            Number(pengembalian.jumlahDus) *
              Number(pengembalian.barang.jumlahPerKemasan) +
            Number(pengembalian.jumlahPcs);
          totalKembaliPcs += pcs;
        }
      }

      const totalDibawaPcs = Number(manifest.jumlahDibawa);
      const selisihPcs = totalDibawaPcs - totalTerjualPcs - totalKembaliPcs;

      // Convert ke dus dan pcs
      const jumlahPerKemasan = Number(manifest.barang.jumlahPerKemasan);
      const dibawaDus = jumlahPerKemasan
        ? Math.floor(totalDibawaPcs / jumlahPerKemasan)
        : 0;
      const dibawaPcs = jumlahPerKemasan
        ? totalDibawaPcs % jumlahPerKemasan
        : totalDibawaPcs;

      const terjualDus = Math.floor(totalTerjualPcs / jumlahPerKemasan);
      const terjualPcs = totalTerjualPcs % jumlahPerKemasan;

      const kembaliDus = Math.floor(totalKembaliPcs / jumlahPerKemasan);
      const kembaliPcs = totalKembaliPcs % jumlahPerKemasan;

      const selisihDus = Math.floor(Math.abs(selisihPcs) / jumlahPerKemasan);
      const selisihPcsRemainder = Math.abs(selisihPcs) % jumlahPerKemasan;

      rekonsiliasi.push({
        barangId: manifest.barangId,
        namaBarang: manifest.barang.namaBarang,
        dibawa: {
          dus: dibawaDus,
          pcs: dibawaPcs,
          total: totalDibawaPcs,
        },
        terjual: {
          dus: terjualDus,
          pcs: terjualPcs,
          total: totalTerjualPcs,
        },
        kembali: {
          dus: kembaliDus,
          pcs: kembaliPcs,
          total: totalKembaliPcs,
        },
        selisih: {
          dus: selisihPcs < 0 ? -selisihDus : selisihDus,
          pcs: selisihPcs < 0 ? -selisihPcsRemainder : selisihPcsRemainder,
          total: selisihPcs,
        },
        status: selisihPcs === 0 ? "COCOK" : "SELISIH",
      });
    }

    // Hitung summary
    const totalSelisih = rekonsiliasi.filter(
      (r) => r.status === "SELISIH"
    ).length;
    const totalCocok = rekonsiliasi.filter((r) => r.status === "COCOK").length;

    const summary = {
      totalBarang: rekonsiliasi.length,
      totalCocok,
      totalSelisih,
      statusRekonsiliasi: totalSelisih === 0 ? "COCOK" : "ADA_SELISIH",
      persentaseCocok:
        rekonsiliasi.length > 0
          ? Math.round((totalCocok / rekonsiliasi.length) * 100)
          : 0,
    };

    return Response.json(
      {
        success: true,
        data: {
          perjalanan: {
            id: perjalanan.id,
            kodePerjalanan: perjalanan.kodePerjalanan,
            kotaTujuan: perjalanan.kotaTujuan,
            statusPerjalanan: perjalanan.statusPerjalanan,
          },
          rekonsiliasi,
          summary,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error fetching rekonsiliasi:", error);
    return Response.json(
      {
        success: false,
        message: "Gagal mengambil data rekonsiliasi",
      },
      { status: 500 }
    );
  }
}
