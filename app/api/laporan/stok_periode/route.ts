import { NextRequest, NextResponse } from "next/server";
import { Prisma, PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function toNumber(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  return Number(value || 0);
}

function getStokKemasan(stok: number, jumlahPerKemasan: number) {
  const perKemasan = Math.max(1, jumlahPerKemasan);
  return {
    jumlahKemasan: Math.floor(stok / perKemasan),
    jumlahPcs: stok % perKemasan,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        { success: false, error: "Parameter startDate dan endDate wajib diisi" },
        { status: 400 },
      );
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, error: "Format tanggal tidak valid" },
        { status: 400 },
      );
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const supplierIdsParam = searchParams.get("supplierIds");
    const search = searchParams.get("search")?.trim();

    const barangWhere: Prisma.BarangWhereInput = { isActive: true };

    if (supplierIdsParam && supplierIdsParam !== "all") {
      const ids = supplierIdsParam
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isInteger(id) && id > 0);
      if (ids.length > 0) barangWhere.supplierId = { in: ids };
    }

    if (search) {
      barangWhere.OR = [
        { namaBarang: { contains: search, mode: "insensitive" } },
        {
          supplier: { namaSupplier: { contains: search, mode: "insensitive" } },
        },
      ];
    }

    const barangList = await prisma.barang.findMany({
      where: barangWhere,
      include: { supplier: true },
      orderBy: [{ supplier: { namaSupplier: "asc" } }, { namaBarang: "asc" }],
    });

    const penjualanItems = await prisma.penjualanItem.groupBy({
      by: ["barangId"],
      where: {
        penjualan: {
          statusTransaksi: "SELESAI",
          isDeleted: false,
          tanggalTransaksi: { gte: startDate, lte: endDate },
        },
        barangId: { in: barangList.map((b) => b.id) },
      },
      _sum: { totalItem: true },
    });

    const terjualMap = new Map<number, number>();
    for (const item of penjualanItems) {
      terjualMap.set(item.barangId, toNumber(item._sum.totalItem));
    }

    const data = barangList.map((barang) => {
      const stokSekarang = toNumber(barang.stok);
      const jumlahPerKemasan = Math.max(1, toNumber(barang.jumlahPerKemasan));
      const totalTerjual = terjualMap.get(barang.id) ?? 0;
      const terjualK = getStokKemasan(totalTerjual, jumlahPerKemasan);
      const stokAkhirK = getStokKemasan(stokSekarang, jumlahPerKemasan);

      const hargaJual = toNumber(barang.hargaJual);
      const hargaBeli = toNumber(barang.hargaBeli);

      const nilaiTerjual =
        hargaJual * terjualK.jumlahKemasan +
        (terjualK.jumlahPcs > 0
          ? Math.round((hargaJual / jumlahPerKemasan) * terjualK.jumlahPcs)
          : 0);
      const modalTerjual =
        hargaBeli * terjualK.jumlahKemasan +
        (terjualK.jumlahPcs > 0
          ? Math.round((hargaBeli / jumlahPerKemasan) * terjualK.jumlahPcs)
          : 0);

      return {
        barangId: barang.id,
        namaBarang: barang.namaBarang,
        namaSupplier: barang.supplier?.namaSupplier || "-",
        satuanKemasan: barang.jenisKemasan,
        jumlahPerKemasan,
        hargaBeli,
        hargaJual,
        totalTerjual,
        terjualKemasan: terjualK.jumlahKemasan,
        terjualPcs: terjualK.jumlahPcs,
        stokAkhir: stokSekarang,
        stokAkhirKemasan: stokAkhirK.jumlahKemasan,
        stokAkhirPcs: stokAkhirK.jumlahPcs,
        nilaiTerjual,
        modalTerjual,
        labaKotor: nilaiTerjual - modalTerjual,
      };
    });

    const summary = data.reduce(
      (acc, b) => {
        acc.jumlahBarang += 1;
        acc.totalTerjual += b.totalTerjual;
        acc.totalNilaiTerjual += b.nilaiTerjual;
        acc.totalModalTerjual += b.modalTerjual;
        acc.totalLabaKotor += b.labaKotor;
        acc.totalStokAkhir += b.stokAkhir;
        return acc;
      },
      {
        jumlahBarang: 0,
        totalTerjual: 0,
        totalNilaiTerjual: 0,
        totalModalTerjual: 0,
        totalLabaKotor: 0,
        totalStokAkhir: 0,
      },
    );

    return NextResponse.json({ success: true, data, summary }, { status: 200 });
  } catch (error) {
    console.error("Error fetching laporan stok periode:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data stok periode" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
