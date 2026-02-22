// =====================================================
// PATH: app/api/sales/order/route.ts
// Endpoint untuk sales membuat order (pending approval)
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

export async function POST(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const authData = await getAuthData();
    if (!authData) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (authData.role !== "SALES") {
      return NextResponse.json(
        { error: "Forbidden: hanya SALES" },
        { status: 403 }
      );
    }
    const userId = parseInt(authData.userId, 10);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { karyawanId: true },
    });
    if (!user?.karyawanId) {
      return NextResponse.json(
        { success: false, error: "User SALES belum terhubung ke karyawan" },
        { status: 400 }
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
        { status: 400 }
      );
    }

    if (!customerId && !namaCustomer) {
      return NextResponse.json(
        { success: false, error: "Customer wajib diisi" },
        { status: 400 }
      );
    }

    const now = new Date();
    const trxDate = tanggalTransaksi ? new Date(tanggalTransaksi) : now;
    if (tanggalTransaksi) {
      trxDate.setHours(
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
      );
    }

    const dateStr = trxDate.toISOString().slice(0, 10).replace(/-/g, "");
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
          jumlahPerKemasan
        );

        const hargaTotal = toNumber(item.hargaJual) * jumlahDus;
        const hargaPcs =
          jumlahPcs > 0
            ? Math.round((toNumber(item.hargaJual) / jumlahPerKemasan) * jumlahPcs)
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
      })
    );

    const totalHarga = subtotal - totalDiskonItem - toNumber(diskonNota);
    const finalTanggalJatuhTempo = tanggalJatuhTempo
      ? new Date(tanggalJatuhTempo)
      : new Date(trxDate);
    finalTanggalJatuhTempo.setDate(finalTanggalJatuhTempo.getDate() + 30);

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
        { status: 400 }
      );
    }


    const result = await prisma.$transaction(async (tx) => {
      const totalBerat = itemsWithCalculation.reduce(
        (sum, item) => sum + Number(item.berat || 0),
        0
      );

      const createData: any = {
        kodePenjualan,
        subtotal,
        diskonNota: toNumber(diskonNota),
        totalHarga: totalHargaFinal,
        jumlahDibayar: jumlahDibayarFinal,
        kembalian,
        beratTotal: totalBerat,
        metodePembayaran,
        statusPembayaran,
        statusTransaksi: "KERANJANG",
        tanggalTransaksi: trxDate,
        tanggalJatuhTempo: finalTanggalJatuhTempo,
        keterangan,
        userId,
        createdById: userId,
        karyawanId: user.karyawanId,
      };

      if (customerId) {
        createData.customerId = Number(customerId);
      } else {
        createData.namaCustomer = namaCustomer;
      }

      const penjualanHeader = await tx.penjualanHeader.create({
        data: createData,
      });

      const createdItems = [];
      for (const item of itemsWithCalculation) {
        const penjualanItem = await tx.penjualanItem.create({
          data: {
            penjualanId: penjualanHeader.id,
            barangId: item.barangId,
            totalItem: item.totalPcs,
            berat: item.berat || 0,
            hargaJual: toNumber(item.hargaJual),
            diskonPerItem: toNumber(item.diskonPerItem || 0),
          },
        });
        createdItems.push(penjualanItem);
      }

      return { penjualanHeader, items: createdItems };
    });

    const penjualanComplete = await prisma.penjualanHeader.findUnique({
      where: { id: result.penjualanHeader.id },
      include: {
        customer: true,
        items: {
          include: {
            barang: true,
          },
          orderBy: { id: "asc" },
        },
      },
    });

    return NextResponse.json(
      deepSerialize({
        success: true,
        message: "Order sales berhasil dibuat (menunggu approval)",
        data: penjualanComplete,
      }),
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Error creating sales order:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal membuat order" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
