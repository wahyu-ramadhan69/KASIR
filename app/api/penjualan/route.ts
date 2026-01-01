// =====================================================
// PATH: app/api/penjualan/route.ts
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData, isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function toNumber(value: any): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value || 0);
}

function deriveDusPcsFromTotal(totalItem: number, jumlahPerKemasan: number) {
  const perKemasan = Math.max(1, jumlahPerKemasan);
  const jumlahDus = Math.floor(totalItem / perKemasan);
  const jumlahPcs = totalItem % perKemasan;
  return { jumlahDus, jumlahPcs };
}

function getTotalItemPcs(item: any, jumlahPerKemasan: number): number {
  if (item.totalItem !== undefined && item.totalItem !== null) {
    return toNumber(item.totalItem);
  }
  const jumlahDus = toNumber(item.jumlahDus);
  const jumlahPcs = toNumber(item.jumlahPcs);
  return jumlahDus * jumlahPerKemasan + jumlahPcs;
}

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
    const hargaJual = toNumber(item.hargaJual);
    const diskonPerItem = toNumber(item.diskonPerItem);
    const jumlahPerKemasan = toNumber(
      item.barang?.jumlahPerKemasan ?? item.barang?.jumlahPerkardus ?? 1
    );

    const totalPcs = getTotalItemPcs(item, jumlahPerKemasan);
    const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
      totalPcs,
      jumlahPerKemasan
    );
    const hargaTotal = hargaJual * jumlahDus;
    const hargaPcs =
      jumlahPcs > 0
        ? Math.round((hargaJual / jumlahPerKemasan) * jumlahPcs)
        : 0;
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
    const authData = await getAuthData();
    const isAdmin = authData?.role === "ADMIN";

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const status = searchParams.get("status");
    const pembayaran = searchParams.get("pembayaran");
    const customerId = searchParams.get("customerId");
    const tipePenjualan = searchParams.get("tipePenjualan"); // "toko" atau "sales"
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const summary = searchParams.get("summary") === "1";

    const baseWhere: any = {
      karyawanId: null, // hanya penjualan header tanpa karyawan
    };

    if (status && status !== "all") {
      baseWhere.statusTransaksi = status;
    }

    if (pembayaran && pembayaran !== "all") {
      baseWhere.statusPembayaran = pembayaran;
    }

    if (customerId) {
      baseWhere.customerId = parseInt(customerId);
    }

    // Filter berdasarkan tipe penjualan
    if (tipePenjualan === "toko") {
      baseWhere.perjalananSalesId = null; // Penjualan toko tidak terkait perjalanan sales
    } else if (tipePenjualan === "sales") {
      baseWhere.perjalananSalesId = { not: null }; // Penjualan sales luar kota punya perjalanan
      baseWhere.customerId = null;
    }

    if (search) {
      baseWhere.OR = [
        { kodePenjualan: { contains: search, mode: "insensitive" } },
        { namaCustomer: { contains: search, mode: "insensitive" } },
        { namaSales: { contains: search, mode: "insensitive" } },
        { customer: { nama: { contains: search, mode: "insensitive" } } },
        { customer: { namaToko: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (startDate || endDate) {
      baseWhere.tanggalTransaksi = {};
      if (startDate) {
        baseWhere.tanggalTransaksi.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        baseWhere.tanggalTransaksi.lte = end;
      }
    }

    const listWhere: any = { ...baseWhere };
    if (!isAdmin) {
      listWhere.isDeleted = false;
      if (authData?.userId) {
        listWhere.userId = parseInt(authData.userId, 10);
      }
    }

    const summaryWhere: any = { ...baseWhere, isDeleted: false };
    if (!isAdmin && authData?.userId) {
      summaryWhere.userId = parseInt(authData.userId, 10);
    }

    if (summary) {
      const totalTransaksi = await prisma.penjualanHeader.count({
        where: summaryWhere,
      });
      const totalHutangTransaksi = await prisma.penjualanHeader.count({
        where: { ...summaryWhere, statusPembayaran: "HUTANG" },
      });
      const totalLunas = await prisma.penjualanHeader.count({
        where: { ...summaryWhere, statusPembayaran: "LUNAS" },
      });
      const hutangAgg = await prisma.penjualanHeader.aggregate({
        where: { ...summaryWhere, statusPembayaran: "HUTANG" },
        _sum: { totalHarga: true, jumlahDibayar: true },
      });
      const totalHutang =
        Number(hutangAgg._sum.totalHarga || 0) -
        Number(hutangAgg._sum.jumlahDibayar || 0);
      const jatuhTempoLimit = new Date();
      jatuhTempoLimit.setDate(jatuhTempoLimit.getDate() + 7);
      const hutangJatuhTempo = await prisma.penjualanHeader.count({
        where: {
          ...summaryWhere,
          statusPembayaran: "HUTANG",
          tanggalJatuhTempo: { lte: jatuhTempoLimit },
        },
      });

      let totalPembayaran = 0;
      const pembayaranPenjualanWhere: any = {
        ...summaryWhere,
      };
      delete pembayaranPenjualanWhere.tanggalTransaksi;
      const pembayaranIds = await prisma.penjualanHeader.findMany({
        where: pembayaranPenjualanWhere,
        select: { id: true },
      });
      const idList = pembayaranIds.map((row) => row.id);
      if (idList.length > 0) {
        const pembayaranWhere: any = { penjualanId: { in: idList } };
        if (startDate || endDate) {
          pembayaranWhere.tanggalBayar = {};
          if (startDate) {
            pembayaranWhere.tanggalBayar.gte = new Date(startDate);
          }
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            pembayaranWhere.tanggalBayar.lte = end;
          }
        }
        const pembayaranAgg = await prisma.pembayaranPenjualan.aggregate({
          where: pembayaranWhere,
          _sum: { nominal: true },
        });
        totalPembayaran = Number(pembayaranAgg._sum.nominal || 0);
      }
      return NextResponse.json(
        deepSerialize({
          success: true,
          data: [],
          summary: {
            totalTransaksi,
            totalPembayaran,
            totalHutang,
            totalHutangTransaksi,
            totalLunas,
            hutangJatuhTempo,
          },
        })
      );
    }

    const totalCount = await prisma.penjualanHeader.count({ where: listWhere });

    let orderBy: any;
    if (pembayaran === "HUTANG") {
      orderBy = { tanggalJatuhTempo: "asc" };
    } else {
      orderBy = { tanggalTransaksi: "desc" };
    }

    let penjualan: any[] = [];
    if (summary) {
      penjualan = await prisma.penjualanHeader.findMany({
        where: listWhere,
        select: {
          id: true,
          kodePenjualan: true,
          totalHarga: true,
          jumlahDibayar: true,
          statusPembayaran: true,
          statusTransaksi: true,
          tanggalJatuhTempo: true,
          tanggalTransaksi: true,
          isDeleted: true,
        },
        orderBy,
        skip,
        take: limit,
      });
    } else {
      penjualan = await prisma.penjualanHeader.findMany({
        where: listWhere,
        include: {
          customer: true,
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
    }

    const penjualanWithCalculation = summary
      ? penjualan
      : penjualan.map((p) => ({
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
    const { salesId } = body;
    const authData = await getAuthData();
    const userId = authData?.userId ? parseInt(authData.userId, 10) : undefined;

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
      ...(userId ? { userId } : {}),
    };

    // Tambahkan salesId jika ada
    if (salesId) {
      createData.salesId = salesId;
    }

    const penjualan = await prisma.penjualanHeader.create({
      data: createData,
      include: {
        customer: true,
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
