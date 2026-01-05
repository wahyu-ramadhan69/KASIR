// app/api/penjualan-luar-kota/[id]/pengembalian/route.ts

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

/**
 * POST /api/penjualan-luar-kota/[id]/pengembalian
 * Kasir input barang yang dikembalikan sales
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const perjalananId = parseInt(id);
    const body = await request.json();

    if (isNaN(perjalananId)) {
      return Response.json(
        {
          success: false,
          message: "ID perjalanan tidak valid",
        },
        { status: 400 }
      );
    }

    // Validasi
    if (!body.pengembalianBarang || body.pengembalianBarang.length === 0) {
      return Response.json(
        {
          success: false,
          message: "Data pengembalian tidak boleh kosong",
        },
        { status: 400 }
      );
    }

    // Cek perjalanan exists
    const perjalanan = await prisma.perjalananSales.findUnique({
      where: { id: perjalananId },
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

    // Hanya bisa input pengembalian jika status KEMBALI
    if (perjalanan.statusPerjalanan !== "KEMBALI") {
      return Response.json(
        {
          success: false,
          message: "Pengembalian barang hanya bisa diinput saat status KEMBALI",
        },
        { status: 400 }
      );
    }

    // Validasi barang dalam manifest
    const barangIds: number[] = body.pengembalianBarang.map(
      (item: any) => item.barangId
    );
    const manifestBarangIds: number[] = perjalanan.manifestBarang.map(
      (m) => m.barangId
    );

    const invalidBarang = barangIds.filter(
      (id: number) => !manifestBarangIds.includes(id)
    );
    if (invalidBarang.length > 0) {
      return Response.json(
        {
          success: false,
          message: `Barang dengan ID ${invalidBarang.join(
            ", "
          )} tidak ada dalam manifest`,
        },
        { status: 400 }
      );
    }

    // Get barang details
    const barangList = await prisma.barang.findMany({
      where: {
        id: { in: barangIds },
      },
    });

    // Prepare data pengembalian
    const pengembalianData = [];
    const barangUpdates: any[] = [];
    const manifestUpdates: any[] = [];

    for (const item of body.pengembalianBarang) {
      const barang = barangList.find((b) => b.id === item.barangId);
      if (!barang) {
        return Response.json(
          {
            success: false,
            message: `Barang dengan ID ${item.barangId} tidak ditemukan`,
          },
          { status: 404 }
        );
      }

      // Validasi jumlah tidak melebihi manifest
      const manifest = perjalanan.manifestBarang.find(
        (m) => m.barangId === item.barangId
      );
      if (!manifest) continue;

      const totalKembaliPcs =
        Number(item.jumlahDus) * Number(barang.jumlahPerKemasan) +
        Number(item.jumlahPcs);

      if (totalKembaliPcs > Number(manifest.totalItem)) {
        return Response.json(
          {
            success: false,
            message: `Jumlah pengembalian ${barang.namaBarang} (${totalKembaliPcs} pcs) melebihi jumlah yang dibawa (${manifest.totalItem} pcs)`,
          },
          { status: 400 }
        );
      }

      pengembalianData.push({
        perjalananId,
        barangId: item.barangId,
        jumlahDus: BigInt(item.jumlahDus),
        jumlahPcs: BigInt(item.jumlahPcs),
        kondisiBarang: item.kondisiBarang,
        keterangan: item.keterangan,
      });

      // Update stok barang (stok disimpan dalam pcs)
      if (item.kondisiBarang === "BAIK") {
        barangUpdates.push(
          prisma.barang.update({
            where: { id: item.barangId },
            data: {
              stok: {
                increment: BigInt(totalKembaliPcs),
              },
            },
          })
        );
      }

      // Update manifest sisa dan jumlah kembali
      const sisaSebelum = Number(manifest.totalItem);
      const sisaBaru = Math.max(0, sisaSebelum - totalKembaliPcs);
      manifestUpdates.push(
        prisma.manifestBarang.update({
          where: { id: manifest.id },
          data: {
            jumlahKembali: {
              increment: BigInt(totalKembaliPcs),
            },
            totalItem: BigInt(sisaBaru),
          },
        })
      );
    }

    // Jalankan transaksi: update stok, manifest, lalu catat pengembalian
    await prisma.$transaction([
      ...barangUpdates,
      ...manifestUpdates,
      prisma.pengembalianBarang.createMany({
        data: pengembalianData,
      }),
    ]);

    // Jika semua manifest sudah habis, tandai perjalanan selesai
    const remainingManifest = await prisma.manifestBarang.count({
      where: {
        perjalananId,
        totalItem: { gt: BigInt(0) },
      },
    });

    if (remainingManifest === 0) {
      await prisma.perjalananSales.update({
        where: { id: perjalananId },
        data: { statusPerjalanan: "SELESAI" },
      });
    }

    // Get created data
    const createdPengembalian = await prisma.pengembalianBarang.findMany({
      where: {
        perjalananId,
        id: {
          in: (
            await prisma.pengembalianBarang.findMany({
              where: { perjalananId },
              orderBy: { id: "desc" },
              take: pengembalianData.length,
            })
          ).map((p) => p.id),
        },
      },
      include: {
        barang: {
          select: {
            id: true,
            namaBarang: true,
            jumlahPerKemasan: true,
          },
        },
      },
    });

    // Convert BigInt to string
    const result = JSON.parse(
      JSON.stringify(createdPengembalian, (_, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return Response.json(
      {
        success: true,
        message: "Pengembalian barang berhasil dicatat",
        data: result,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating pengembalian:", error);
    return Response.json(
      {
        success: false,
        message: error.message || "Gagal mencatat pengembalian barang",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/penjualan-luar-kota/[id]/pengembalian
 * Get list pengembalian barang dari perjalanan
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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

    const pengembalian = await prisma.pengembalianBarang.findMany({
      where: {
        perjalananId,
      },
      include: {
        barang: {
          select: {
            id: true,
            namaBarang: true,
            jumlahPerKemasan: true,
          },
        },
      },
      orderBy: {
        tanggalPengembalian: "asc",
      },
    });

    // Convert BigInt to string
    const result = JSON.parse(
      JSON.stringify(pengembalian, (_, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return Response.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error fetching pengembalian:", error);
    return Response.json(
      {
        success: false,
        message: "Gagal mengambil data pengembalian",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/penjualan-luar-kota/[id]/pengembalian
 * Hapus data pengembalian
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const searchParams = request.nextUrl.searchParams;
    const pengembalianId = searchParams.get("pengembalianId");

    if (!pengembalianId) {
      return Response.json(
        {
          success: false,
          message: "ID pengembalian tidak valid",
        },
        { status: 400 }
      );
    }

    const id = parseInt(pengembalianId);
    if (isNaN(id)) {
      return Response.json(
        {
          success: false,
          message: "ID pengembalian tidak valid",
        },
        { status: 400 }
      );
    }

    // Get pengembalian detail
    const pengembalian = await prisma.pengembalianBarang.findUnique({
      where: { id },
      include: {
        barang: true,
        perjalanan: true,
      },
    });

    if (!pengembalian) {
      return Response.json(
        {
          success: false,
          message: "Data pengembalian tidak ditemukan",
        },
        { status: 404 }
      );
    }

    if (!pengembalian.perjalanan) {
      return Response.json(
        {
          success: false,
          message: "Data perjalanan tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // Hanya bisa delete jika perjalanan belum SELESAI
    if (pengembalian.perjalanan.statusPerjalanan === "SELESAI") {
      return Response.json(
        {
          success: false,
          message:
            "Tidak bisa menghapus pengembalian dari perjalanan yang sudah selesai",
        },
        { status: 400 }
      );
    }

    // Kembalikan stok jika kondisi BAIK
    if (pengembalian.kondisiBarang === "BAIK") {
      const totalKembaliPcs =
        Number(pengembalian.jumlahDus) *
          Number(pengembalian.barang.jumlahPerKemasan) +
        Number(pengembalian.jumlahPcs);
      const currentStokPcs = Number(pengembalian.barang.stok);
      const newStokPcs = currentStokPcs - totalKembaliPcs;

      await prisma.barang.update({
        where: { id: pengembalian.barangId },
        data: {
          stok: BigInt(Math.max(0, newStokPcs)),
        },
      });
    }

    // Delete pengembalian
    await prisma.pengembalianBarang.delete({
      where: { id },
    });

    return Response.json(
      {
        success: true,
        message: "Data pengembalian berhasil dihapus",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting pengembalian:", error);
    return Response.json(
      {
        success: false,
        message: "Gagal menghapus data pengembalian",
      },
      { status: 500 }
    );
  }
}
