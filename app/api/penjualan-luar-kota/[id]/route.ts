// app/api/penjualan-luar-kota/[id]/route.ts

import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/penjualan-luar-kota/[id]
 * Get detail perjalanan by ID dengan rekonsiliasi
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return Response.json(
        {
          success: false,
          message: "ID tidak valid",
        },
        { status: 400 }
      );
    }

    const perjalanan = await prisma.perjalananSales.findUnique({
      where: { id },
      include: {
        karyawan: {
          select: {
            id: true,
            nama: true,
            nik: true,
          },
        },
        manifestBarang: {
          include: {
            barang: {
              select: {
                id: true,
                namaBarang: true,
                satuan: true,
                ukuran: true,
                jumlahPerKemasan: true,
                jenisKemasan: true,
                hargaBeli: true,
                hargaJual: true,
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
            customer: {
              select: {
                id: true,
                nama: true,
                namaToko: true,
              },
            },
          },
          orderBy: {
            tanggalTransaksi: "asc",
          },
        },
        pengembalianBarang: {
          include: {
            barang: {
              select: {
                id: true,
                namaBarang: true,
                satuan: true,
                ukuran: true,
                jumlahPerKemasan: true,
                jenisKemasan: true,
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

    // Convert BigInt to string
    const result = JSON.parse(
      JSON.stringify(perjalanan, (_, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return Response.json(
      {
        success: true,
        data: {
          ...result,
          rekonsiliasi,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error fetching perjalanan detail:", error);
    return Response.json(
      {
        success: false,
        message: "Gagal mengambil detail perjalanan",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/penjualan-luar-kota/[id]
 * Update perjalanan
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const body = await request.json();

    if (isNaN(id)) {
      return Response.json(
        {
          success: false,
          message: "ID tidak valid",
        },
        { status: 400 }
      );
    }

    // Cek perjalanan exists
    const perjalanan = await prisma.perjalananSales.findUnique({
      where: { id },
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

    // Tidak bisa update jika sudah selesai
    if (perjalanan.statusPerjalanan === "SELESAI") {
      return Response.json(
        {
          success: false,
          message: "Tidak bisa update perjalanan yang sudah selesai",
        },
        { status: 400 }
      );
    }

    // Update perjalanan
    const updated = await prisma.perjalananSales.update({
      where: { id },
      data: {
        kotaTujuan: body.kotaTujuan || undefined,
        tanggalBerangkat: body.tanggalBerangkat
          ? new Date(body.tanggalBerangkat)
          : undefined,
        tanggalKembali: body.tanggalKembali
          ? new Date(body.tanggalKembali)
          : undefined,
        keterangan: body.keterangan !== undefined ? body.keterangan : undefined,
      },
      include: {
        karyawan: {
          select: {
            id: true,
            nama: true,
            nik: true,
          },
        },
        manifestBarang: {
          include: {
            barang: {
              select: {
                id: true,
                namaBarang: true,
                satuan: true,
                ukuran: true,
                jumlahPerKemasan: true,
                jenisKemasan: true,
              },
            },
          },
        },
      },
    });

    // Convert BigInt to string
    const result = JSON.parse(
      JSON.stringify(updated, (_, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return Response.json(
      {
        success: true,
        message: "Perjalanan berhasil diupdate",
        data: result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating perjalanan:", error);
    return Response.json(
      {
        success: false,
        message: "Gagal update perjalanan",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return Response.json(
        {
          success: false,
          message: "ID tidak valid",
        },
        { status: 400 }
      );
    }

    // Cek perjalanan exists + manifest untuk restore stok
    const perjalanan = await prisma.perjalananSales.findUnique({
      where: { id },
      include: {
        manifestBarang: true,
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
    await prisma.$transaction(async (tx) => {
      // Kembalikan stok barang berdasarkan jumlahDibawa di manifest (disimpan dalam pcs)
      // Gunakan jumlahDibawa karena ini adalah jumlah awal yang diambil dari stok
      for (const manifest of perjalanan.manifestBarang) {
        const restorePcs = Number(manifest.jumlahDibawa);
        if (restorePcs > 0) {
          await tx.barang.update({
            where: { id: manifest.barangId },
            data: {
              stok: {
                increment: BigInt(restorePcs),
              },
            },
          });
        }
      }

      await tx.perjalananSales.delete({
        where: { id },
      });
    });

    return Response.json(
      {
        success: true,
        message: "Perjalanan berhasil dihapus",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting perjalanan:", error);
    return Response.json(
      {
        success: false,
        message: "Gagal menghapus perjalanan",
      },
      { status: 500 }
    );
  }
}
