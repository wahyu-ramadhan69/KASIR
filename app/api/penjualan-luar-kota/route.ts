// app/api/penjualan-luar-kota/route.ts

import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/penjualan-luar-kota
 * List semua perjalanan sales dengan filter
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const karyawanId = searchParams.get("karyawanId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    // Build where clause
    const where: any = {};

    if (status) {
      where.statusPerjalanan = status;
    }

    if (karyawanId) {
      where.karyawanId = parseInt(karyawanId);
    }

    if (startDate || endDate) {
      where.tanggalBerangkat = {};
      if (startDate) {
        where.tanggalBerangkat.gte = new Date(startDate);
      }
      if (endDate) {
        where.tanggalBerangkat.lte = new Date(endDate);
      }
    }

    // Get total count
    const total = await prisma.perjalananSales.count({ where });

    // Get data with pagination
    const perjalanan = await prisma.perjalananSales.findMany({
      where,
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
              },
            },
          },
        },
        penjualanHeaders: {
          select: {
            id: true,
            kodePenjualan: true,
            namaCustomer: true,
            totalHarga: true,
            statusPembayaran: true,
            customer: {
              select: {
                id: true,
                nama: true,
                namaToko: true,
              },
            },
          },
        },
        pengembalianBarang: {
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
        _count: {
          select: {
            penjualanHeaders: true,
            pengembalianBarang: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
    });

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
          perjalanan: result,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error fetching perjalanan:", error);
    return Response.json(
      {
        success: false,
        message: "Gagal mengambil data perjalanan",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/penjualan-luar-kota
 * Buat perjalanan sales baru
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validasi
    if (!body.karyawanId || !body.kotaTujuan || !body.tanggalBerangkat) {
      return Response.json(
        {
          success: false,
          message: "Data tidak lengkap",
        },
        { status: 400 }
      );
    }

    if (!body.manifestBarang || body.manifestBarang.length === 0) {
      return Response.json(
        {
          success: false,
          message: "Manifest barang tidak boleh kosong",
        },
        { status: 400 }
      );
    }

    // Cek karyawan exists
    const karyawan = await prisma.karyawan.findUnique({
      where: { id: body.karyawanId },
    });

    if (!karyawan) {
      return Response.json(
        {
          success: false,
          message: "Karyawan tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // Generate kode perjalanan
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const datePrefix = `PRJ-${year}${month}${day}`;

    const lastPerjalanan = await prisma.perjalananSales.findFirst({
      where: {
        kodePerjalanan: {
          startsWith: datePrefix,
        },
      },
      orderBy: {
        kodePerjalanan: "desc",
      },
    });

    const lastNumber = lastPerjalanan
      ? parseInt(lastPerjalanan.kodePerjalanan.split("-")[2])
      : 0;

    const kodePerjalanan = `${datePrefix}-${String(lastNumber + 1).padStart(
      3,
      "0"
    )}`;

    // Get barang details untuk validasi dan hitung total
    const barangIds = body.manifestBarang.map((item: any) => item.barangId);
    const barangList = await prisma.barang.findMany({
      where: {
        id: { in: barangIds },
      },
    });

    if (barangList.length !== barangIds.length) {
      return Response.json(
        {
          success: false,
          message: "Ada barang yang tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // Siapkan manifest dan cek stok cukup
    const manifestData = body.manifestBarang.map((item: any) => {
      const barang = barangList.find((b) => b.id === item.barangId);
      if (!barang) throw new Error("Barang tidak ditemukan");

      const totalItem = Number(item.totalItem);
      const availablePcs = Number(barang.stok); // stok disimpan dalam pcs

      if (totalItem > availablePcs) {
        throw new Error(
          `Stok ${barang.namaBarang} tidak cukup (tersedia ${availablePcs} pcs)`
        );
      }

      return {
        barangId: item.barangId,
        jumlahDibawa: BigInt(totalItem), // Jumlah awal yang dibawa (tidak berubah)
        totalItem: BigInt(totalItem), // Sisa yang belum direkonsiliasi (akan dikurangi)
      };
    });

    // TODO: Get userId from session/token
    const userId = 1; // Hardcoded for now

    // Create perjalanan + kurangi stok barang secara atomik
    const perjalanan = await prisma.$transaction(async (tx) => {
      const created = await tx.perjalananSales.create({
        data: {
          kodePerjalanan,
          karyawanId: body.karyawanId,
          kotaTujuan: body.kotaTujuan,
          tanggalBerangkat: new Date(body.tanggalBerangkat),
          keterangan: body.keterangan,
          createdBy: userId,
          manifestBarang: {
            create: manifestData,
          },
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
                  jumlahPerKemasan: true,
                },
              },
            },
          },
        },
      });

      // Kurangi stok barang di gudang (stok disimpan dalam pcs)
      for (const item of body.manifestBarang) {
        const barang = barangList.find((b) => b.id === item.barangId);
        if (!barang) continue;

        const totalItem = Number(item.totalItem);
        const currentStokPcs = Number(barang.stok);
        const newStokPcs = currentStokPcs - totalItem;

        await tx.barang.update({
          where: { id: item.barangId },
          data: {
            stok: BigInt(Math.max(0, newStokPcs)),
          },
        });
      }

      return created;
    });

    // Convert BigInt to string
    const result = JSON.parse(
      JSON.stringify(perjalanan, (_, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return Response.json(
      {
        success: true,
        message: "Perjalanan sales berhasil dibuat",
        data: result,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating perjalanan:", error);
    return Response.json(
      {
        success: false,
        message: error.message || "Gagal membuat perjalanan sales",
      },
      { status: 500 }
    );
  }
}
