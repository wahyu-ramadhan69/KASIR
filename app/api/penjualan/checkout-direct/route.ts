// =====================================================
// PATH: app/api/penjualan/checkout-direct/route.ts
// Endpoint untuk membuat penjualan dan langsung checkout
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

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
    const body = await request.json();
    const {
      items,
      customerId,
      namaCustomer,
      diskonNota = 0,
      jumlahDibayar,
      metodePembayaran,
      tanggalTransaksi,
      tanggalJatuhTempo,
      userId,
    } = body;

    // Validasi
    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Keranjang kosong" },
        { status: 400 }
      );
    }

    if (!jumlahDibayar) {
      return NextResponse.json(
        { success: false, error: "Jumlah pembayaran wajib diisi" },
        { status: 400 }
      );
    }

    if (!customerId && !namaCustomer) {
      return NextResponse.json(
        { success: false, error: "Customer wajib dipilih" },
        { status: 400 }
      );
    }

    // Generate kode penjualan
    const today = tanggalTransaksi ? new Date(tanggalTransaksi) : new Date();
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

    // Hitung subtotal dan total
    let subtotal = 0;
    let totalDiskonItem = 0;

    const itemsWithCalculation = await Promise.all(
      items.map(async (item: any) => {
        const barang = await prisma.barang.findUnique({
          where: { id: item.barangId },
        });

        if (!barang) {
          throw new Error(`Barang dengan ID ${item.barangId} tidak ditemukan`);
        }

        const jumlahPerKemasan = Number(barang.jumlahPerKemasan);
        const totalStokDiperlukan = getTotalItemPcs(item, jumlahPerKemasan);
        const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
          totalStokDiperlukan,
          jumlahPerKemasan
        );

        if (Number(barang.stok) < totalStokDiperlukan) {
          throw new Error(`Stok ${barang.namaBarang} tidak mencukupi`);
        }

        const hargaTotal = item.hargaJual * jumlahDus;
        const hargaPcs =
          jumlahPcs > 0
            ? Math.round((item.hargaJual / jumlahPerKemasan) * jumlahPcs)
            : 0;
        const totalHargaSebelumDiskon = hargaTotal + hargaPcs;
        const diskon = item.diskonPerItem * jumlahDus;

        subtotal += totalHargaSebelumDiskon;
        totalDiskonItem += diskon;

        return {
          ...item,
          barang,
          totalStokDiperlukan,
        };
      })
    );

    const totalHarga = subtotal - totalDiskonItem - diskonNota;

    // Cek status pembayaran
    const sisaHutang = Math.max(0, totalHarga - jumlahDibayar);
    const kembalian = Math.max(0, jumlahDibayar - totalHarga);
    const statusPembayaran = sisaHutang > 0 ? "HUTANG" : "LUNAS";

    // Jika hutang, validasi customer dan limit piutang
    if (statusPembayaran === "HUTANG") {
      if (!customerId) {
        return NextResponse.json(
          {
            success: false,
            error: "Customer tidak terdaftar tidak bisa mengambil hutang",
          },
          { status: 400 }
        );
      }

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        return NextResponse.json(
          { success: false, error: "Customer tidak ditemukan" },
          { status: 404 }
        );
      }

      const totalPiutangBaru = Number(customer.piutang) + sisaHutang;
      if (
        customer.limit_piutang > 0 &&
        totalPiutangBaru > Number(customer.limit_piutang)
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Piutang melebihi limit! Limit: Rp ${customer.limit_piutang.toLocaleString(
              "id-ID"
            )}`,
          },
          { status: 400 }
        );
      }
    }

    // Set tanggal jatuh tempo
    let finalTanggalJatuhTempo = tanggalJatuhTempo
      ? new Date(tanggalJatuhTempo)
      : new Date(today);
    finalTanggalJatuhTempo.setDate(finalTanggalJatuhTempo.getDate() + 30);

    // Mulai transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Buat penjualan header
      const createData: any = {
        kodePenjualan,
        subtotal,
        diskonNota,
        totalHarga,
        jumlahDibayar,
        kembalian,
        metodePembayaran,
        statusPembayaran,
        statusTransaksi: "SELESAI",
        tanggalTransaksi: today,
        tanggalJatuhTempo: finalTanggalJatuhTempo,
        userId,
      };

      if (customerId) {
        createData.customerId = customerId;
      } else {
        createData.namaCustomer = namaCustomer;
      }

      const penjualanHeader = await tx.penjualanHeader.create({
        data: createData,
      });

      // 2. Buat penjualan items
      const createdItems = [];
      for (const item of itemsWithCalculation) {
        const jumlahPerKemasan = Number(item.barang.jumlahPerKemasan);
        const totalPcs = getTotalItemPcs(item, jumlahPerKemasan);
        const penjualanItem = await tx.penjualanItem.create({
          data: {
            penjualanId: penjualanHeader.id,
            barangId: item.barangId,
            totalItem: totalPcs,
            hargaJual: item.hargaJual,
            diskonPerItem: item.diskonPerItem || 0,
          },
        });
        createdItems.push(penjualanItem);

        // 3. Update stok barang
        await tx.barang.update({
          where: { id: item.barangId },
          data: {
            stok: {
              decrement: item.totalStokDiperlukan,
            },
          },
        });
      }

      // 4. Jika hutang, update piutang customer
      if (statusPembayaran === "HUTANG" && customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            piutang: {
              increment: sisaHutang,
            },
          },
        });
      }

      return {
        penjualanHeader,
        items: createdItems,
      };
    });

    // Ambil data lengkap untuk receipt
    const penjualanComplete = await prisma.penjualanHeader.findUnique({
      where: { id: result.penjualanHeader.id },
      include: {
        customer: true,
        items: {
          include: {
            barang: true,
          },
        },
      },
    });

    // Format receipt
    const receipt = {
      kodePenjualan: penjualanComplete!.kodePenjualan,
      tanggal: penjualanComplete!.tanggalTransaksi,
      customer: penjualanComplete!.customer || {
        nama: penjualanComplete!.namaCustomer,
      },
      items: penjualanComplete!.items,
      subtotal,
      diskonNota,
      totalHarga,
      jumlahDibayar,
      kembalian,
      sisaHutang,
      metodePembayaran,
      statusPembayaran,
    };

    return NextResponse.json(
      deepSerialize({
        success: true,
        message:
          statusPembayaran === "LUNAS"
            ? "Transaksi berhasil"
            : "Transaksi berhasil (Hutang)",
        data: {
          penjualan: penjualanComplete,
          receipt,
        },
      }),
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Error checkout direct:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal checkout" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
