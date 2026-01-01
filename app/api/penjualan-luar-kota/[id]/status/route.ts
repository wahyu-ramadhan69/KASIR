// app/api/penjualan-luar-kota/[id]/status/route.ts

import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * PATCH /api/penjualan-luar-kota/[id]/status
 * Update status perjalanan
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

    if (!body.status) {
      return Response.json(
        {
          success: false,
          message: "Status tidak boleh kosong",
        },
        { status: 400 }
      );
    }

    // Get perjalanan
    const perjalanan = await prisma.perjalananSales.findUnique({
      where: { id },
      include: {
        manifestBarang: {
          include: {
            barang: true,
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

    // Validasi transisi status
    const validTransitions: Record<string, string[]> = {
      PERSIAPAN: ["DI_PERJALANAN", "DIBATALKAN"],
      DI_PERJALANAN: ["KEMBALI", "DIBATALKAN"],
      KEMBALI: ["SELESAI", "DIBATALKAN"],
      SELESAI: [],
      DIBATALKAN: [],
    };

    const currentStatus = perjalanan.statusPerjalanan;
    const newStatus = body.status;

    if (!validTransitions[currentStatus]) {
      return Response.json(
        {
          success: false,
          message: "Status tidak valid",
        },
        { status: 400 }
      );
    }

    if (!validTransitions[currentStatus].includes(newStatus)) {
      return Response.json(
        {
          success: false,
          message: `Tidak bisa mengubah status dari ${currentStatus} ke ${newStatus}`,
        },
        { status: 400 }
      );
    }

    // Logic khusus per status
    if (newStatus === "DI_PERJALANAN") {
      // Kurangi stok barang saat sales berangkat
      for (const manifest of perjalanan.manifestBarang) {
        const totalPcs = Number(manifest.totalItem);

        // Cek stok cukup
        const currentStokPcs = Number(manifest.barang.stok);

        if (currentStokPcs < totalPcs) {
          return Response.json(
            {
              success: false,
              message: `Stok ${manifest.barang.namaBarang} tidak cukup. Stok: ${currentStokPcs} pcs, Dibutuhkan: ${totalPcs} pcs`,
            },
            { status: 400 }
          );
        }

        // Update stok
        const newStokPcs = currentStokPcs - totalPcs;

        await prisma.barang.update({
          where: { id: manifest.barangId },
          data: {
            stok: BigInt(Math.max(0, newStokPcs)),
          },
        });
      }
    }

    if (newStatus === "KEMBALI") {
      // Validasi tanggal kembali
      if (!body.tanggalKembali) {
        return Response.json(
          {
            success: false,
            message: "Tanggal kembali harus diisi",
          },
          { status: 400 }
        );
      }
    }

    if (newStatus === "SELESAI") {
      // Update jumlah terjual di manifest
      const penjualanItems = await prisma.penjualanItem.findMany({
        where: {
          penjualan: {
            perjalananSalesId: id,
          },
        },
      });

      // Group by barangId dan hitung total terjual
      const terjualMap = new Map<number, number>();

      for (const item of penjualanItems) {
        const totalPcs = Number(item.totalItem || 0);
        const current = terjualMap.get(item.barangId) || 0;
        terjualMap.set(item.barangId, current + totalPcs);
      }

      // Update manifest
      for (const [barangId, totalTerjual] of terjualMap) {
        await prisma.manifestBarang.updateMany({
          where: {
            perjalananId: id,
            barangId: barangId,
          },
          data: {
            jumlahTerjual: BigInt(totalTerjual),
          },
        });
      }

      // Update jumlah kembali di manifest
      const pengembalianItems = await prisma.pengembalianBarang.findMany({
        where: { perjalananId: id },
        include: {
          barang: {
            select: {
              jumlahPerKemasan: true,
            },
          },
        },
      });

      const kembaliMap = new Map<number, number>();

      for (const item of pengembalianItems) {
        const totalPcs =
          Number(item.jumlahDus) * Number(item.barang.jumlahPerKemasan) +
          Number(item.jumlahPcs);
        const current = kembaliMap.get(item.barangId) || 0;
        kembaliMap.set(item.barangId, current + totalPcs);
      }

      // Update manifest
      for (const [barangId, totalKembali] of kembaliMap) {
        await prisma.manifestBarang.updateMany({
          where: {
            perjalananId: id,
            barangId: barangId,
          },
          data: {
            jumlahKembali: BigInt(totalKembali),
          },
        });
      }
    }

    if (newStatus === "DIBATALKAN") {
      // Jika dibatalkan setelah berangkat (DI_PERJALANAN atau KEMBALI), kembalikan stok
      if (["DI_PERJALANAN", "KEMBALI"].includes(currentStatus)) {
        for (const manifest of perjalanan.manifestBarang) {
          const totalPcs = Number(manifest.totalItem);
          const currentStokPcs = Number(manifest.barang.stok);
          const newStokPcs = currentStokPcs + totalPcs;

          await prisma.barang.update({
            where: { id: manifest.barangId },
            data: {
              stok: BigInt(newStokPcs),
            },
          });
        }
      }
    }

    // Update status perjalanan
    const updateData: any = {
      statusPerjalanan: newStatus,
    };

    if (body.tanggalKembali) {
      updateData.tanggalKembali = new Date(body.tanggalKembali);
    }

    const updated = await prisma.perjalananSales.update({
      where: { id },
      data: updateData,
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
        message: `Status berhasil diubah menjadi ${newStatus}`,
        data: result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating status:", error);
    return Response.json(
      {
        success: false,
        message: error.message || "Gagal mengubah status perjalanan",
      },
      { status: 500 }
    );
  }
}
