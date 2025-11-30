// =====================================================
// PATH: app/api/penjualan/route.ts
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Deep serialize to handle all BigInt in nested objects
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

// Helper function untuk menghitung total penjualan
const calculatePenjualan = (items: any[], diskonNota: number = 0) => {
  let subtotal = 0;
  let totalDiskonItem = 0;

  const calculatedItems = items.map((item) => {
    const jumlahDus =
      typeof item.jumlahDus === "bigint"
        ? Number(item.jumlahDus)
        : item.jumlahDus;
    const jumlahPcs =
      typeof item.jumlahPcs === "bigint"
        ? Number(item.jumlahPcs)
        : item.jumlahPcs;
    const hargaJual =
      typeof item.hargaJual === "bigint"
        ? Number(item.hargaJual)
        : item.hargaJual;
    const diskonPerItem =
      typeof item.diskonPerItem === "bigint"
        ? Number(item.diskonPerItem)
        : item.diskonPerItem;
    const jumlahPerkardus =
      typeof item.barang?.jumlahPerkardus === "bigint"
        ? Number(item.barang.jumlahPerkardus)
        : item.barang?.jumlahPerkardus || 1;

    const totalPcs = jumlahDus * jumlahPerkardus + (jumlahPcs || 0);
    const hargaTotal = hargaJual * jumlahDus;
    const hargaPcs =
      jumlahPcs > 0 ? Math.round((hargaJual / jumlahPerkardus) * jumlahPcs) : 0;
    const totalHargaSebelumDiskon = hargaTotal + hargaPcs;
    const diskon = diskonPerItem * jumlahDus;

    subtotal += totalHargaSebelumDiskon;
    totalDiskonItem += diskon;

    return {
      ...item,
      totalPcs,
      totalHargaSebelumDiskon,
      totalDiskon: diskon,
      subtotalItem: totalHargaSebelumDiskon - diskon,
    };
  });

  const totalHarga = subtotal - totalDiskonItem - diskonNota;

  return {
    items: calculatedItems,
    ringkasan: {
      subtotal,
      totalDiskonItem,
      diskonNota,
      totalHarga: Math.max(0, totalHarga),
    },
  };
};

// GET: Ambil penjualan dengan filter dan pagination
export async function GET(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const status = searchParams.get("status");
    const pembayaran = searchParams.get("pembayaran");
    const customerId = searchParams.get("customerId");
    const salesId = searchParams.get("salesId");
    const tipePenjualan = searchParams.get("tipePenjualan"); // "toko" atau "sales"
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = {};

    if (status && status !== "all") {
      where.statusTransaksi = status;
    }

    if (pembayaran && pembayaran !== "all") {
      where.statusPembayaran = pembayaran;
    }

    if (customerId) {
      where.customerId = parseInt(customerId);
    }

    if (salesId) {
      where.salesId = parseInt(salesId);
    }

    // Filter berdasarkan tipe penjualan
    if (tipePenjualan === "toko") {
      where.salesId = null; // Penjualan toko tidak memiliki sales sebagai customer
    } else if (tipePenjualan === "sales") {
      where.salesId = { not: null }; // Penjualan ke sales memiliki salesId
      where.customerId = null; // Sales penjualan tidak punya customerId
    }

    if (search) {
      where.OR = [
        { kodePenjualan: { contains: search, mode: "insensitive" } },
        { namaCustomer: { contains: search, mode: "insensitive" } },
        { namaSales: { contains: search, mode: "insensitive" } },
        { customer: { nama: { contains: search, mode: "insensitive" } } },
        { customer: { namaToko: { contains: search, mode: "insensitive" } } },
        { sales: { namaSales: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (startDate || endDate) {
      where.tanggalTransaksi = {};
      if (startDate) {
        where.tanggalTransaksi.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.tanggalTransaksi.lte = end;
      }
    }

    const totalCount = await prisma.penjualanHeader.count({ where });

    let orderBy: any;
    if (pembayaran === "HUTANG") {
      orderBy = { tanggalJatuhTempo: "asc" };
    } else {
      orderBy = { tanggalTransaksi: "desc" };
    }

    const penjualan = await prisma.penjualanHeader.findMany({
      where,
      include: {
        customer: true,
        sales: true,
        items: {
          include: {
            barang: true,
          },
          orderBy: { id: "asc" },
        },
      },
      orderBy,
      skip,
      take: limit,
    });

    const penjualanWithCalculation = penjualan.map((p) => ({
      ...p,
      calculation: calculatePenjualan(p.items, Number(p.diskonNota)),
    }));

    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return NextResponse.json(
      deepSerialize({
        success: true,
        data: penjualanWithCalculation,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasMore,
        },
      })
    );
  } catch (err) {
    console.error("Error fetching penjualan:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data penjualan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST: Buat penjualan baru (keranjang)
export async function POST(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { userId, salesId } = body;

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

    const lastPenjualan = await prisma.penjualanHeader.findFirst({
      where: {
        kodePenjualan: {
          startsWith: `PJ-${dateStr}`,
        },
      },
      orderBy: {
        kodePenjualan: "desc",
      },
    });

    let nextNumber = 1;
    if (lastPenjualan) {
      const lastNumber = parseInt(lastPenjualan.kodePenjualan.split("-")[2]);
      nextNumber = lastNumber + 1;
    }

    const kodePenjualan = `PJ-${dateStr}-${String(nextNumber).padStart(
      4,
      "0"
    )}`;

    const tanggalJatuhTempo = new Date();
    tanggalJatuhTempo.setDate(tanggalJatuhTempo.getDate() + 30);

    // Prepare data untuk create
    const createData: any = {
      kodePenjualan,
      statusTransaksi: "KERANJANG",
      statusPembayaran: "HUTANG",
      tanggalJatuhTempo,
      userId,
    };

    // Tambahkan salesId jika ada
    if (salesId) {
      createData.salesId = salesId;
    }

    const penjualan = await prisma.penjualanHeader.create({
      data: createData,
      include: {
        customer: true,
        sales: true,
        items: true,
      },
    });

    return NextResponse.json(
      deepSerialize({
        success: true,
        message: "Keranjang penjualan berhasil dibuat",
        data: penjualan,
      }),
      { status: 201 }
    );
  } catch (err) {
    console.error("Error creating penjualan:", err);
    return NextResponse.json(
      { success: false, error: "Gagal membuat penjualan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
