// =====================================================
// PATH: app/api/sales/order/[id]/route.ts
// Endpoint untuk sales edit order (pending approval)
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

function deepSerialize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(deepSerialize);
  if (typeof obj === "object") {
    const serialized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) serialized[key] = deepSerialize(obj[key]);
    }
    return serialized;
  }
  return obj;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const authData = await getAuthData();
    if (!authData || authData.role !== "SALES") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const parsedId = Number(id);
    if (!parsedId) {
      return NextResponse.json(
        { success: false, error: "ID tidak valid" },
        { status: 400 },
      );
    }

    const data = await prisma.penjualanHeader.findFirst({
      where: {
        id: parsedId,
        createdById: Number(authData.userId),
        statusApproval: "PENDING",
        statusTransaksi: "KERANJANG",
        isDeleted: false,
      },
      include: {
        customer: true,
        items: { include: { barang: true }, orderBy: { id: "asc" } },
        createdBy: {
          select: {
            id: true,
            username: true,
            role: true,
            karyawan: { select: { nama: true } },
          },
        },
      },
    });

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Order tidak ditemukan" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      deepSerialize({ success: true, data }),
      { status: 200 },
    );
  } catch (error) {
    console.error("Error fetching sales order:", error);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data order" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const authData = await getAuthData();
    if (!authData || authData.role !== "SALES") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const parsedId = Number(id);
    if (!parsedId) {
      return NextResponse.json(
        { success: false, error: "ID tidak valid" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const {
      items,
      customerId,
      namaCustomer,
      diskonNota = 0,
      keterangan,
      tanggalTransaksi,
      tanggalJatuhTempo,
      metodePembayaran = "CASH",
      jumlahDibayar = 0,
      totalCash = 0,
      totalTransfer = 0,
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Keranjang kosong" },
        { status: 400 },
      );
    }

    if (!customerId && !namaCustomer) {
      return NextResponse.json(
        { success: false, error: "Customer wajib diisi" },
        { status: 400 },
      );
    }

    const penjualan = await prisma.penjualanHeader.findFirst({
      where: {
        id: parsedId,
        createdById: Number(authData.userId),
        statusApproval: "PENDING",
        statusTransaksi: "KERANJANG",
        isDeleted: false,
      },
      include: { items: true },
    });

    if (!penjualan) {
      return NextResponse.json(
        { success: false, error: "Order tidak ditemukan" },
        { status: 404 },
      );
    }

    let subtotal = 0;
    let totalDiskonItem = 0;

    const itemsWithCalculation = await Promise.all(
      items.map(async (item: any) => {
        if (!item.barangId) {
          throw new Error("barangId wajib diisi");
        }
        if (item.hargaJual === undefined || item.hargaJual === null) {
          throw new Error("hargaJual wajib diisi");
        }

        const barang = await prisma.barang.findUnique({
          where: { id: item.barangId },
        });

        if (!barang) {
          throw new Error(`Barang dengan ID ${item.barangId} tidak ditemukan`);
        }

        const jumlahPerKemasan = Number(barang.jumlahPerKemasan || 1);
        const totalPcs = getTotalItemPcs(item, jumlahPerKemasan);
        if (totalPcs <= 0) {
          throw new Error("Jumlah item harus lebih dari 0");
        }

        const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
          totalPcs,
          jumlahPerKemasan,
        );

        const hargaTotal = toNumber(item.hargaJual) * jumlahDus;
        const hargaPcs =
          jumlahPcs > 0
            ? Math.round(
                (toNumber(item.hargaJual) / jumlahPerKemasan) * jumlahPcs,
              )
            : 0;
        const totalHargaSebelumDiskon = hargaTotal + hargaPcs;
        const diskon = toNumber(item.diskonPerItem || 0) * jumlahDus;

        subtotal += totalHargaSebelumDiskon;
        totalDiskonItem += diskon;

        const beratPerItem = Number(barang.berat || 0);
        const beratItem =
          item.berat !== undefined && item.berat !== null
            ? Number(item.berat)
            : beratPerItem * totalPcs;

        return {
          ...item,
          totalPcs,
          berat: beratItem,
        };
      }),
    );

    const totalHarga = subtotal - totalDiskonItem - toNumber(diskonNota);
    const jumlahDibayarFinal = toNumber(jumlahDibayar);
    const totalHargaFinal = Math.max(0, totalHarga);
    const statusPembayaran =
      jumlahDibayarFinal >= totalHargaFinal ? "LUNAS" : "HUTANG";
    const kembalian = Math.max(0, jumlahDibayarFinal - totalHargaFinal);

    if (statusPembayaran === "HUTANG" && !customerId) {
      return NextResponse.json(
        {
          success: false,
          error: "Customer tidak terdaftar tidak bisa mengambil hutang",
        },
        { status: 400 },
      );
    }

    const trxDate = tanggalTransaksi ? new Date(tanggalTransaksi) : new Date();
    const finalTanggalJatuhTempo = tanggalJatuhTempo
      ? new Date(tanggalJatuhTempo)
      : new Date(trxDate);
    finalTanggalJatuhTempo.setDate(finalTanggalJatuhTempo.getDate() + 30);

    const result = await prisma.$transaction(async (tx) => {
      const existingMap = new Map(penjualan.items.map((it) => [it.id, it]));
      const keepIds = new Set<number>();

      for (const rawItem of itemsWithCalculation) {
        const itemId = Number(rawItem.itemId || rawItem.id || 0);
        const data = {
          barangId: Number(rawItem.barangId),
          totalItem: rawItem.totalPcs,
          hargaJual: toNumber(rawItem.hargaJual),
          diskonPerItem: toNumber(rawItem.diskonPerItem || 0),
          berat: toNumber(rawItem.berat || 0),
        };

        if (itemId && existingMap.has(itemId)) {
          keepIds.add(itemId);
          await tx.penjualanItem.update({
            where: { id: itemId },
            data,
          });
        } else {
          const created = await tx.penjualanItem.create({
            data: {
              ...data,
              penjualanId: penjualan.id,
            },
          });
          keepIds.add(created.id);
        }
      }

      const idsToDelete = penjualan.items
        .filter((it) => !keepIds.has(it.id))
        .map((it) => it.id);

      if (idsToDelete.length > 0) {
        await tx.penjualanItem.deleteMany({
          where: { id: { in: idsToDelete } },
        });
      }

      const totalBerat = itemsWithCalculation.reduce(
        (sum, item) => sum + Number(item.berat || 0),
        0,
      );

      const updatedHeader = await tx.penjualanHeader.update({
        where: { id: penjualan.id },
        data: {
          subtotal,
          diskonNota: toNumber(diskonNota),
          totalHarga: totalHargaFinal,
          jumlahDibayar: jumlahDibayarFinal,
          kembalian,
          beratTotal: totalBerat,
          metodePembayaran,
          statusPembayaran,
          tanggalTransaksi: trxDate,
          tanggalJatuhTempo: finalTanggalJatuhTempo,
          keterangan: keterangan || null,
          customerId: customerId ? Number(customerId) : null,
          namaCustomer: customerId ? null : namaCustomer || null,
        },
        include: {
          customer: true,
          items: { include: { barang: true }, orderBy: { id: "asc" } },
          createdBy: {
            select: {
              id: true,
              username: true,
              role: true,
              karyawan: { select: { nama: true } },
            },
          },
        },
      });

      return updatedHeader;
    });

    return NextResponse.json(
      deepSerialize({ success: true, data: result }),
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Error updating sales order:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengupdate order" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
