// app/api/barang/[id]/riwayat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

type RouteCtx = { params: Promise<{ id: string }> };

function toNumber(value: bigint | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "bigint" ? Number(value) : value;
}

function parseId(id: string | undefined) {
  const num = Number(id);
  return !id || Number.isNaN(num) ? null : num;
}

// GET riwayat penjualan / pembelian untuk 1 barang
// query: ?tipe=penjualan | pembelian  (opsional: ?limit=100)
export async function GET(req: NextRequest, { params }: RouteCtx) {
  const auth = await isAuthenticated();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const idNum = parseId(id);
  if (idNum === null)
    return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const tipe = searchParams.get("tipe");
  const limitParam = Number(searchParams.get("limit"));
  const take = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 300) : 10;

  if (tipe !== "penjualan" && tipe !== "pembelian") {
    return NextResponse.json(
      { success: false, error: "Parameter tipe harus 'penjualan' atau 'pembelian'" },
      { status: 400 }
    );
  }

  try {
    if (tipe === "penjualan") {
      const items = await prisma.penjualanItem.findMany({
        where: {
          barangId: idNum,
          penjualan: { statusTransaksi: "SELESAI", isDeleted: false },
        },
        include: {
          penjualan: {
            select: {
              kodePenjualan: true,
              tanggalTransaksi: true,
              namaCustomer: true,
              customer: { select: { nama: true, namaToko: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take,
      });

      const data = items.map((item) => {
        const jumlah = toNumber(item.totalItem);
        const harga = toNumber(item.hargaJual);
        const diskon = toNumber(item.diskonPerItem);
        return {
          id: item.id,
          kode: item.penjualan.kodePenjualan,
          tanggal: item.penjualan.tanggalTransaksi,
          pihak:
            item.penjualan.namaCustomer ||
            item.penjualan.customer?.namaToko ||
            item.penjualan.customer?.nama ||
            "Umum",
          jumlah,
          harga,
          diskon,
          subtotal: jumlah * harga - diskon,
          laba: toNumber(item.laba),
        };
      });

      return NextResponse.json({ success: true, tipe, data }, { status: 200 });
    }

    const items = await prisma.pembelianItem.findMany({
      where: {
        barangId: idNum,
        pembelian: { statusTransaksi: "SELESAI" },
      },
      include: {
        pembelian: {
          select: {
            kodePembelian: true,
            createdAt: true,
            supplier: { select: { namaSupplier: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    const data = items.map((item) => {
      const jumlah = toNumber(item.totalItem);
      const harga = toNumber(item.hargaPokok);
      const diskon = toNumber(item.diskonPerItem);
      return {
        id: item.id,
        kode: item.pembelian.kodePembelian,
        tanggal: item.pembelian.createdAt,
        pihak: item.pembelian.supplier?.namaSupplier || "-",
        jumlah,
        harga,
        diskon,
        subtotal: jumlah * harga - diskon,
      };
    });

    return NextResponse.json({ success: true, tipe, data }, { status: 200 });
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
