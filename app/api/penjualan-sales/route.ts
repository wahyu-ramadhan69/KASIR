// =====================================================
// PATH: app/api/penjualan-sales/route.ts
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData } from "@/app/AuthGuard";

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
    const jumlahPerKemasan =
      typeof item.barang?.jumlahPerKemasan === "bigint"
        ? Number(item.barang.jumlahPerKemasan)
        : item.barang?.jumlahPerKemasan || 1;

    const totalPcs = jumlahDus * jumlahPerKemasan + (jumlahPcs || 0);
    const hargaTotal = hargaJual * jumlahDus;
    const hargaPcs =
      jumlahPcs > 0 ? Math.round((hargaJual / jumlahPerKemasan) * jumlahPcs) : 0;
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

// GET: Ambil penjualan sales (dengan karyawan jenis SALES) dengan filter dan pagination
export async function GET(request: NextRequest) {
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const status = searchParams.get("status");
    const pembayaran = searchParams.get("pembayaran");
    const karyawanId = searchParams.get("karyawanId");
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const summary = searchParams.get("summary") === "1";

    const isAdmin = authData.role === "ADMIN";
    const baseWhere: any = {
      // Filter hanya penjualan dengan karyawan jenis SALES
      karyawan: {
        jenis: "SALES",
      },
    };

    if (status && status !== "all") {
      baseWhere.statusTransaksi = status;
    }

    if (pembayaran && pembayaran !== "all") {
      baseWhere.statusPembayaran = pembayaran;
    }

    if (karyawanId) {
      baseWhere.karyawanId = parseInt(karyawanId);
    }

    if (search) {
      baseWhere.OR = [
        { kodePenjualan: { contains: search, mode: "insensitive" } },
        { namaCustomer: { contains: search, mode: "insensitive" } },
        { namaSales: { contains: search, mode: "insensitive" } },
        { customer: { nama: { contains: search, mode: "insensitive" } } },
        { customer: { namaToko: { contains: search, mode: "insensitive" } } },
        { karyawan: { nama: { contains: search, mode: "insensitive" } } },
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
    const summaryWhere: any = { ...baseWhere, isDeleted: false };
    const userId = Number(authData.userId);
    if (!isAdmin && !Number.isNaN(userId)) {
      listWhere.isDeleted = false;
      listWhere.userId = userId;
      summaryWhere.userId = userId;
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
      const hutangList = await prisma.penjualanHeader.findMany({
        where: { ...summaryWhere, statusPembayaran: "HUTANG" },
        select: { totalHarga: true, jumlahDibayar: true },
      });
      const totalHutang = hutangList.reduce(
        (sum, item) =>
          sum +
          (Number(item.totalHarga || 0) - Number(item.jumlahDibayar || 0)),
        0
      );
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
      const pembayaranPenjualanWhere: any = { ...summaryWhere };
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
        const pembayaranRows = await prisma.pembayaranPenjualan.findMany({
          where: pembayaranWhere,
          select: { nominal: true },
        });
        totalPembayaran = pembayaranRows.reduce(
          (sum, row) => sum + Number(row.nominal || 0),
          0
        );
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
      // Sort by tanggalJatuhTempo, nulls last, then by tanggalTransaksi desc
      orderBy = [
        { tanggalJatuhTempo: { sort: "asc", nulls: "last" } },
        { tanggalTransaksi: "desc" },
      ];
    } else {
      orderBy = { tanggalTransaksi: "desc" };
    }

    const penjualan = await prisma.penjualanHeader.findMany({
      where: listWhere,
      include: {
        customer: true,
        karyawan: true,
        perjalananSales: {
          include: {
            karyawan: true,
          },
        },
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
    console.error("Error fetching penjualan sales:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data penjualan sales" },
      { status: 500 }
    );
  }
}
