// app/api/barang/[id]/riwayat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

type RouteCtx = { params: Promise<{ id: string }> };

const DEFAULT_TAKE = 5;
const MAX_TAKE = 50;

function toNumber(value: bigint | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "bigint" ? Number(value) : value;
}

function parseId(id: string | undefined) {
  const num = Number(id);
  return !id || Number.isNaN(num) ? null : num;
}

function parseIntParam(value: string | null, fallback: number, max: number) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.min(Math.floor(num), max);
}

// GET riwayat penjualan / pembelian untuk 1 barang (paginasi untuk infinite scroll)
// query: ?tipe=penjualan|pembelian&skip=0&take=5
export async function GET(req: NextRequest, { params }: RouteCtx) {
  const auth = await isAuthenticated();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const idNum = parseId(id);
  if (idNum === null)
    return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const tipe = searchParams.get("tipe");
  const skip = parseIntParam(searchParams.get("skip"), 0, Number.MAX_SAFE_INTEGER);
  const take = parseIntParam(searchParams.get("take"), DEFAULT_TAKE, MAX_TAKE) || DEFAULT_TAKE;

  if (tipe !== "penjualan" && tipe !== "pembelian") {
    return NextResponse.json(
      { success: false, error: "Parameter tipe harus 'penjualan' atau 'pembelian'" },
      { status: 400 }
    );
  }

  try {
    // ambil take + 1 untuk mendeteksi apakah masih ada data berikutnya
    if (tipe === "penjualan") {
      const rows = await prisma.penjualanItem.findMany({
        where: {
          barangId: idNum,
          penjualan: { statusTransaksi: "SELESAI", isDeleted: false },
        },
        select: {
          id: true,
          totalItem: true,
          penjualan: {
            select: { kodePenjualan: true, tanggalTransaksi: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: take + 1,
      });

      const hasMore = rows.length > take;
      const data = rows.slice(0, take).map((item) => ({
        id: item.id,
        kode: item.penjualan.kodePenjualan,
        tanggal: item.penjualan.tanggalTransaksi,
        jumlah: toNumber(item.totalItem),
      }));

      return NextResponse.json(
        { success: true, tipe, data, hasMore, nextSkip: skip + data.length },
        { status: 200 }
      );
    }

    const rows = await prisma.pembelianItem.findMany({
      where: {
        barangId: idNum,
        pembelian: { statusTransaksi: "SELESAI" },
      },
      select: {
        id: true,
        totalItem: true,
        pembelian: {
          select: { kodePembelian: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: take + 1,
    });

    const hasMore = rows.length > take;
    const data = rows.slice(0, take).map((item) => ({
      id: item.id,
      kode: item.pembelian.kodePembelian,
      tanggal: item.pembelian.createdAt,
      jumlah: toNumber(item.totalItem),
    }));

    return NextResponse.json(
      { success: true, tipe, data, hasMore, nextSkip: skip + data.length },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching riwayat barang:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mengambil riwayat" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
