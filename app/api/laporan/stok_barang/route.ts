import { NextRequest, NextResponse } from "next/server";
import { Prisma, PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

type SerializedValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | SerializedValue[]
  | { [key: string]: SerializedValue };

function deepSerialize(obj: unknown): SerializedValue {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (
    typeof obj === "string" ||
    typeof obj === "number" ||
    typeof obj === "boolean"
  ) {
    return obj;
  }
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(deepSerialize);
  if (typeof obj === "object") {
    const serialized: { [key: string]: SerializedValue } = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        serialized[key] = deepSerialize((obj as Record<string, unknown>)[key]);
      }
    }
    return serialized;
  }
  return String(obj);
}

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
    const supplierIdsParam = searchParams.get("supplierIds"); // comma-separated: "1,2,3"
    const search = searchParams.get("search")?.trim();

    const where: Prisma.BarangWhereInput = {
      isActive: true,
    };

    if (supplierIdsParam && supplierIdsParam !== "all") {
      const ids = supplierIdsParam
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (ids.length === 0) {
        return NextResponse.json(
          { success: false, error: "supplierIds tidak valid" },
          { status: 400 },
        );
      }

      where.supplierId = { in: ids };
    }

    if (search) {
      where.OR = [
        { namaBarang: { contains: search, mode: "insensitive" } },
        {
          supplier: {
            namaSupplier: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    const barangList = await prisma.barang.findMany({
      where,
      include: {
        supplier: true,
        kategori: true,
      },
      orderBy: [{ supplier: { namaSupplier: "asc" } }, { namaBarang: "asc" }],
    });

    const data = barangList.map((barang) => {
      const stok = toNumber(barang.stok);
      const jumlahPerKemasan = Math.max(1, toNumber(barang.jumlahPerKemasan));
      const { jumlahKemasan, jumlahPcs } = getStokKemasan(
        stok,
        jumlahPerKemasan,
      );
      const hargaBeli = toNumber(barang.hargaBeli);
      const hargaJual = toNumber(barang.hargaJual);
      const nilaiBeli =
        hargaBeli * jumlahKemasan +
        (jumlahPcs > 0
          ? Math.round((hargaBeli / jumlahPerKemasan) * jumlahPcs)
          : 0);
      const nilaiJual =
        hargaJual * jumlahKemasan +
        (jumlahPcs > 0
          ? Math.round((hargaJual / jumlahPerKemasan) * jumlahPcs)
          : 0);

      return {
        ...barang,
        stok,
        jumlahPerKemasan,
        jumlahKemasan,
        jumlahDus: jumlahKemasan,
        jumlahPcs,
        satuanKemasan: barang.jenisKemasan,
        hargaBeli,
        hargaJual,
        nilaiBeli,
        nilaiJual,
        berat: toNumber(barang.berat),
        limitStok: toNumber(barang.limitStok),
        limitPenjualan: toNumber(barang.limitPenjualan),
        statusStok:
          toNumber(barang.limitStok) > 0 && stok <= toNumber(barang.limitStok)
            ? "LOW_STOCK"
            : "AMAN",
      };
    });

    const summary = data.reduce(
      (acc, barang) => {
        acc.jumlahBarang += 1;
        acc.totalStok += barang.stok;
        acc.totalKemasan += barang.jumlahKemasan;
        acc.totalPcsSisa += barang.jumlahPcs;
        acc.totalNilaiBeli += barang.nilaiBeli;
        acc.totalNilaiJual += barang.nilaiJual;
        if (barang.statusStok === "LOW_STOCK") acc.jumlahLowStock += 1;
        return acc;
      },
      {
        jumlahBarang: 0,
        totalStok: 0,
        totalKemasan: 0,
        totalPcsSisa: 0,
        totalNilaiBeli: 0,
        totalNilaiJual: 0,
        jumlahLowStock: 0,
      },
    );

    return NextResponse.json(
      deepSerialize({
        success: true,
        filters: {
          supplierIds:
            supplierIdsParam && supplierIdsParam !== "all"
              ? supplierIdsParam.split(",").map(Number)
              : "all",
          search: search || null,
        },
        data,
        summary,
      }),
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching laporan stok barang:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data stok barang" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
