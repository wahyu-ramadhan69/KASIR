// app/api/penjualan-luar-kota/[id]/manifest/route.ts

import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * PATCH /api/penjualan-luar-kota/[id]/manifest
 * Update manifest barang perjalanan
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

    const { manifestBarang } = body;

    if (!manifestBarang || !Array.isArray(manifestBarang)) {
      return Response.json(
        {
          success: false,
          message: "Data manifest tidak valid",
        },
        { status: 400 }
      );
    }

    // Cek perjalanan exists
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

    // Hanya bisa edit jika status DI_PERJALANAN
    if (perjalanan.statusPerjalanan !== "DI_PERJALANAN") {
      return Response.json(
        {
          success: false,
          message: `Tidak bisa edit manifest pada status ${perjalanan.statusPerjalanan}`,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Kembalikan stok lama terlebih dahulu (menggunakan jumlahDibawa yang belum dikurangi transaksi/pengembalian)
      for (const oldManifest of perjalanan.manifestBarang) {
        await tx.barang.update({
          where: { id: oldManifest.barangId },
          data: {
            stok: {
              increment: BigInt(oldManifest.jumlahDibawa),
            },
          },
        });
      }

      // 2. Hapus manifest lama
      await tx.manifestBarang.deleteMany({
        where: { perjalananId: id },
      });

      // 3. Buat manifest baru dan kurangi stok
      for (const item of manifestBarang) {
        const { barangId, totalItem } = item;

        // Validasi barang dan stok
        const barang = await tx.barang.findUnique({
          where: { id: barangId },
        });

        if (!barang) {
          throw new Error(`Barang dengan ID ${barangId} tidak ditemukan`);
        }

        if (Number(barang.stok) < totalItem) {
          throw new Error(
            `Stok ${barang.namaBarang} tidak mencukupi. Tersedia: ${barang.stok}, Dibutuhkan: ${totalItem}`
          );
        }

        // Buat manifest baru
        await tx.manifestBarang.create({
          data: {
            perjalananId: id,
            barangId,
            jumlahDibawa: BigInt(totalItem), // Jumlah awal yang dibawa
            totalItem: BigInt(totalItem), // Sisa yang belum direkonsiliasi
          },
        });

        // Kurangi stok
        await tx.barang.update({
          where: { id: barangId },
          data: {
            stok: {
              decrement: BigInt(totalItem),
            },
          },
        });
      }
    });

    // Ambil data perjalanan terbaru
    const updated = await prisma.perjalananSales.findUnique({
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
                jumlahPerKemasan: true,
                jenisKemasan: true,
                hargaBeli: true,
                hargaJual: true,
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
        message: "Manifest berhasil diupdate",
        data: result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating manifest:", error);
    return Response.json(
      {
        success: false,
        message: error.message || "Gagal update manifest",
      },
      { status: 500 }
    );
  }
}
