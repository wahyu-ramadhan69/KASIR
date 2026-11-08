// =====================================================
// PATH: app/api/laporan/piutang-customer/route.ts
// Data laporan piutang customer (list + statistik)
// =====================================================
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData } from "@/app/AuthGuard";
import {
  buildPiutangWhere,
  getSisaPiutang,
  readPiutangFilters,
  toNumber,
} from "./filter";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const authData = await getAuthData();
    if (!authData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (authData.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20")),
    );
    const skip = (page - 1) * limit;

    const where = buildPiutangWhere(readPiutangFilters(searchParams));

    const [list, totalCount, agg, hutangAgg, customerGroups, overdueCount] =
      await Promise.all([
        prisma.penjualanHeader.findMany({
          where,
          orderBy: [{ tanggalJatuhTempo: "asc" }, { tanggalTransaksi: "desc" }],
          skip,
          take: limit,
          include: {
            customer: {
              select: {
                id: true,
                nama: true,
                namaToko: true,
                noHp: true,
                limit_piutang: true,
              },
            },
            pembayaran: {
              orderBy: { tanggalBayar: "asc" },
              select: {
                id: true,
                kodePembayaran: true,
                tanggalBayar: true,
                nominal: true,
                metode: true,
                catatan: true,
              },
            },
          },
        }),
        prisma.penjualanHeader.count({ where }),
        prisma.penjualanHeader.aggregate({
          where,
          _sum: { totalHarga: true },
        }),
        // Sisa piutang hanya dari nota HUTANG (nota LUNAS bisa punya kembalian)
        prisma.penjualanHeader.aggregate({
          where: { AND: [where, { statusPembayaran: "HUTANG" }] },
          _sum: { totalHarga: true, jumlahDibayar: true },
        }),
        prisma.penjualanHeader.groupBy({
          by: ["customerId"],
          where: { AND: [where, { customerId: { not: null } }] },
        }),
        prisma.penjualanHeader.count({
          where: {
            AND: [
              where,
              {
                statusPembayaran: "HUTANG",
                tanggalJatuhTempo: { lt: new Date() },
              },
            ],
          },
        }),
      ]);

    const totalPiutang = toNumber(agg._sum.totalHarga);
    const totalSisaPiutang = Math.max(
      0,
      toNumber(hutangAgg._sum.totalHarga) -
        toNumber(hutangAgg._sum.jumlahDibayar),
    );
    const totalDibayar = Math.max(0, totalPiutang - totalSisaPiutang);

    const data = list.map((p) => ({
      id: p.id,
      kodePenjualan: p.kodePenjualan,
      customerId: p.customerId,
      namaCustomer: p.namaCustomer,
      customer: p.customer
        ? {
            ...p.customer,
            limit_piutang: toNumber(p.customer.limit_piutang),
          }
        : null,
      totalHarga: toNumber(p.totalHarga),
      jumlahDibayar: toNumber(p.jumlahDibayar),
      sisaPiutang: p.statusPembayaran === "HUTANG" ? getSisaPiutang(p) : 0,
      metodePembayaran: p.metodePembayaran,
      statusPembayaran: p.statusPembayaran,
      tanggalTransaksi: p.tanggalTransaksi,
      tanggalJatuhTempo: p.tanggalJatuhTempo,
      pembayaran: p.pembayaran.map((b) => ({
        ...b,
        nominal: toNumber(b.nominal),
      })),
    }));

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + list.length < totalCount,
      },
      stats: {
        jumlahTransaksi: totalCount,
        jumlahCustomer: customerGroups.length,
        totalPiutang,
        totalDibayar,
        totalSisaPiutang,
        jumlahJatuhTempo: overdueCount,
      },
    });
  } catch (error) {
    console.error("Error fetching laporan piutang customer:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data piutang customer" },
      { status: 500 },
    );
  }
}
