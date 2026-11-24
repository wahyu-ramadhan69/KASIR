// Ringkasan jumlah barang terjual untuk filter "nama barang" di riwayat penjualan
import type { PrismaClient, Prisma } from "@prisma/client";

export type BarangSummary = {
  barangId: number;
  namaBarang: string;
  jenisKemasan: string;
  jumlahPerKemasan: number;
  totalItem: number;
  jumlahKemasan: number;
  sisaPcs: number;
  jumlahBaris: number;
};

/** Baca & validasi query param `barangId`; null jika tidak ada/tidak valid */
export function readBarangIdParam(searchParams: URLSearchParams): number | null {
  const raw = searchParams.get("barangId");
  if (!raw) return null;
  const id = parseInt(raw, 10);
  return Number.isNaN(id) ? null : id;
}

/**
 * Total barang `barangId` yang terjual pada penjualan yang cocok dengan
 * `penjualanWhere` (where yang sama dengan ringkasan/summary).
 */
export async function getBarangSummary(
  prisma: PrismaClient,
  barangId: number,
  penjualanWhere: Prisma.PenjualanHeaderWhereInput,
): Promise<BarangSummary> {
  const [barangInfo, itemAgg] = await Promise.all([
    prisma.barang.findUnique({
      where: { id: barangId },
      select: { namaBarang: true, jenisKemasan: true, jumlahPerKemasan: true },
    }),
    prisma.penjualanItem.aggregate({
      where: { barangId, penjualan: penjualanWhere },
      _sum: { totalItem: true },
      _count: { _all: true },
    }),
  ]);

  const totalItem = Number(itemAgg._sum.totalItem || 0);
  const perKemasan = Math.max(1, Number(barangInfo?.jumlahPerKemasan || 1));

  return {
    barangId,
    namaBarang: barangInfo?.namaBarang || "-",
    jenisKemasan: barangInfo?.jenisKemasan || "kemasan",
    jumlahPerKemasan: perKemasan,
    totalItem,
    jumlahKemasan: Math.floor(totalItem / perKemasan),
    sisaPcs: totalItem % perKemasan,
    jumlahBaris: itemAgg._count._all,
  };
}
