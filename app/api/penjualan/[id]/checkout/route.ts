// app/api/penjualan/[id]/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthData, isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Deep serialize to handle all BigInt in nested objects
function deepSerialize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(deepSerialize);
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

// Helper to convert BigInt to number safely
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

// Helper untuk total penjualan harian termasuk manifest terjual
async function getTotalPenjualanHariIni(
  barangId: number,
  excludePenjualanId?: number
): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const items = await prisma.penjualanItem.findMany({
    where: {
      barangId,
      penjualan: {
        statusTransaksi: "SELESAI",
        tanggalTransaksi: {
          gte: today,
          lt: tomorrow,
        },
        ...(excludePenjualanId ? { NOT: { id: excludePenjualanId } } : {}),
      },
    },
    include: {
      barang: {
        select: {
          jumlahPerKemasan: true,
        },
      },
    },
  });

  const manifestData = await prisma.manifestBarang.findMany({
    where: {
      barangId,
      perjalanan: {
        tanggalBerangkat: {
          gte: today,
          lt: tomorrow,
        },
        statusPerjalanan: { not: "DIBATALKAN" },
      },
      updatedAt: {
        gte: today,
        lt: tomorrow,
      },
    },
    include: {
      perjalanan: true,
    },
  });

  let totalPcs = 0;
  for (const item of items) {
    const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
    totalPcs += getTotalItemPcs(item, jumlahPerKemasan);
  }

  for (const manifest of manifestData) {
    totalPcs += toNumber(manifest.jumlahTerjual) + toNumber(manifest.totalItem);
  }

  return totalPcs;
}

// Helper function untuk menghitung total penjualan
const calculatePenjualan = (items: any[], diskonNota: number = 0) => {
  let subtotal = 0;
  let totalDiskonItem = 0;

  const calculatedItems = items.map((item) => {
    const hargaJual = toNumber(item.hargaJual);
    const diskonPerItem = toNumber(item.diskonPerItem);
    const jumlahPerKemasan = toNumber(item.barang?.jumlahPerKemasan || 1);

    const totalPcs = getTotalItemPcs(item, jumlahPerKemasan);
    const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
      totalPcs,
      jumlahPerKemasan
    );
    const hargaTotal = hargaJual * jumlahDus;
    const hargaPcs =
      jumlahPcs > 0
        ? Math.round((hargaJual / jumlahPerKemasan) * jumlahPcs)
        : 0;
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

// POST: Checkout penjualan
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const authData = await getAuthData();
    const userId = authData?.userId ? parseInt(authData.userId, 10) : undefined;
    const { id } = await params;
    const penjualanId = parseInt(id);
    const body = await request.json();
    const {
      jumlahDibayar,
      diskonNota = 0,
      metodePembayaran = "CASH",
      totalCash = 0,
      totalTransfer = 0,
      tanggalJatuhTempo,
      customerId,
      salesId,
      namaSales,
      tanggalTransaksi,
    } = body;

    // Validasi penjualan
    const penjualan = await prisma.penjualanHeader.findUnique({
      where: { id: penjualanId },
      include: {
        customer: true,
        karyawan: true,
        items: {
          include: { barang: true },
        },
      },
    });

    if (!penjualan) {
      return NextResponse.json(
        { success: false, error: "Penjualan tidak ditemukan" },
        { status: 404 }
      );
    }

    if (penjualan.statusTransaksi !== "KERANJANG") {
      return NextResponse.json(
        { success: false, error: "Penjualan sudah diproses sebelumnya" },
        { status: 400 }
      );
    }

    if (penjualan.items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Keranjang masih kosong" },
        { status: 400 }
      );
    }

    // Validasi limit pembelian per hari untuk setiap item
    for (const item of penjualan.items) {
      const limitPenjualan = toNumber(item.barang.limitPenjualan);

      if (limitPenjualan > 0) {
        const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
        const totalPcsItem = getTotalItemPcs(item, jumlahPerKemasan);

        const totalTerjualHariIni = await getTotalPenjualanHariIni(
          item.barangId,
          penjualanId
        );
        const totalSetelahCheckout = totalTerjualHariIni + totalPcsItem;

        if (totalSetelahCheckout > limitPenjualan) {
          const sisaLimit = Math.max(0, limitPenjualan - totalTerjualHariIni);
          return NextResponse.json(
            {
              success: false,
              error: `CHECKOUT DITOLAK - LIMIT TERLAMPAUI!\n\n📦 ${item.barang.namaBarang}\n⚠️ Limit: ${limitPenjualan} unit/hari\n✅ Terjual: ${totalTerjualHariIni} unit\n🔸 Sisa: ${sisaLimit} unit\n🛒 Keranjang: ${totalPcsItem} unit\n\nKurangi jumlah atau hubungi admin!`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Calculate totals
    const calculation = calculatePenjualan(penjualan.items, diskonNota);
    const totalHarga = calculation.ringkasan.totalHarga;
    const totalBerat = penjualan.items.reduce(
      (sum, item) => sum + toNumber(item.berat),
      0
    );

    // Determine payment status
    const kembalian =
      jumlahDibayar >= totalHarga ? jumlahDibayar - totalHarga : 0;
    const statusPembayaran = jumlahDibayar >= totalHarga ? "LUNAS" : "HUTANG";
    const sisaHutang =
      statusPembayaran === "HUTANG" ? totalHarga - jumlahDibayar : 0;

    // Deteksi tipe penjualan berdasarkan data yang ada
    const isPenjualanSales = penjualan.karyawanId !== null;
    const effectiveCustomerId = customerId ?? penjualan.customerId ?? null;

    // Validasi hutang untuk sales
    if (statusPembayaran === "HUTANG" && isPenjualanSales) {
      if (!penjualan.karyawanId) {
        return NextResponse.json(
          {
            success: false,
            error: "Transaksi dengan hutang harus menggunakan sales terdaftar",
          },
          { status: 400 }
        );
      }

      const karyawan = await prisma.karyawan.findUnique({
        where: { id: penjualan.karyawanId },
      });

      if (!karyawan || karyawan.jenis !== "SALES") {
        return NextResponse.json(
          {
            success: false,
            error: "Sales tidak ditemukan atau bukan jenis SALES",
          },
          { status: 404 }
        );
      }

      // Note: Karyawan tidak memiliki limit hutang, jadi skip validasi limit
    }

    // Validasi piutang customer untuk hutang (toko atau sales jika ada customer)
    if (statusPembayaran === "HUTANG" && effectiveCustomerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: effectiveCustomerId },
      });

      if (!customer) {
        return NextResponse.json(
          { success: false, error: "Customer tidak ditemukan" },
          { status: 404 }
        );
      }

      // Cek apakah piutang baru melebihi limit
      const piutangSekarang = toNumber(customer.piutang);
      const limitPiutang = toNumber(customer.limit_piutang);
      const piutangBaru = piutangSekarang + sisaHutang;

      if (limitPiutang > 0 && piutangBaru > limitPiutang) {
        // Over-limit tetap boleh, tapi limit_piutang tidak diubah
      }
    } else if (statusPembayaran === "HUTANG" && !isPenjualanSales) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Transaksi dengan hutang harus menggunakan customer terdaftar. Customer tidak terdaftar tidak bisa mengambil hutang.",
        },
        { status: 400 }
      );
    }

    // Validasi customer untuk transaksi LUNAS toko
    if (statusPembayaran === "LUNAS" && !isPenjualanSales && !customerId) {
      return NextResponse.json(
        { success: false, error: "Customer harus diisi" },
        { status: 400 }
      );
    }

    // Validasi sales/karyawan
    if (isPenjualanSales && salesId) {
      const karyawan = await prisma.karyawan.findUnique({
        where: { id: salesId },
      });

      if (!karyawan || karyawan.jenis !== "SALES") {
        return NextResponse.json(
          { success: false, error: "Sales tidak ditemukan" },
          { status: 404 }
        );
      }
    }

    // Cek stok sebelum checkout
    for (const item of penjualan.items) {
      const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
      const stokTersedia = toNumber(item.barang.stok);

      const totalPcsNeeded = getTotalItemPcs(item, jumlahPerKemasan);

      if (stokTersedia < totalPcsNeeded) {
        return NextResponse.json(
          {
            success: false,
            error: `Stok ${item.barang.namaBarang} tidak cukup. Tersedia: ${stokTersedia} pcs, Dibutuhkan: ${totalPcsNeeded} pcs`,
          },
          { status: 400 }
        );
      }
    }

    // Set tanggal jatuh tempo
    let finalTanggalJatuhTempo = null;
    if (statusPembayaran === "HUTANG") {
      if (tanggalJatuhTempo) {
        finalTanggalJatuhTempo = new Date(tanggalJatuhTempo);
      } else {
        finalTanggalJatuhTempo = new Date();
        finalTanggalJatuhTempo.setDate(finalTanggalJatuhTempo.getDate() + 30);
      }
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Calculate total modal first
      let totalModal = 0;
      for (const item of penjualan.items) {
        const hargaBeli = toNumber(item.hargaBeli);
        const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
        const totalPcs = getTotalItemPcs(item, jumlahPerKemasan);
        const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
          totalPcs,
          jumlahPerKemasan
        );

        const modalDus = hargaBeli * jumlahDus;
        const modalPcs =
          jumlahPcs > 0
            ? Math.round((hargaBeli / jumlahPerKemasan) * jumlahPcs)
            : 0;
        totalModal += modalDus + modalPcs;
      }

      // Recalculate laba after diskonNota
      const totalLabaSebelum = penjualan.items.reduce(
        (sum, item) => sum + toNumber(item.laba),
        0
      );

      const totalLabaSesudah = totalHarga - totalModal;

      // Update each item's laba proportionally if diskonNota > 0
      if (diskonNota > 0 && totalLabaSebelum > 0) {
        const adjustmentFactor = totalLabaSesudah / totalLabaSebelum;

        for (const item of penjualan.items) {
          const labaOriginal = toNumber(item.laba);
          const labaAdjusted = Math.round(labaOriginal * adjustmentFactor);

          await tx.penjualanItem.update({
            where: { id: item.id },
            data: { laba: BigInt(labaAdjusted) },
          });
        }
      }

      // Kurangi stok barang
      for (const item of penjualan.items) {
        const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
        const totalPcs = getTotalItemPcs(item, jumlahPerKemasan);

        await tx.barang.update({
          where: { id: item.barangId },
          data: {
            stok: { decrement: BigInt(totalPcs) },
          },
        });
      }

      // Note: Karyawan tidak memiliki field hutang, jadi tidak perlu update
      // Jika perlu tracking hutang sales, harus dihandle di tempat lain

      // Update piutang customer jika penjualan toko dengan HUTANG
      if (statusPembayaran === "HUTANG" && effectiveCustomerId) {
        await tx.customer.update({
          where: { id: effectiveCustomerId },
          data: {
            piutang: { increment: BigInt(sisaHutang) },
          },
        });
      }

      const now = new Date();
      const transaksiDate = tanggalTransaksi ? new Date(tanggalTransaksi) : now;
      if (tanggalTransaksi) {
        transaksiDate.setHours(
          now.getHours(),
          now.getMinutes(),
          now.getSeconds(),
          now.getMilliseconds()
        );
      }

      // Prepare update data
      const updateData: any = {
        subtotal: BigInt(calculation.ringkasan.subtotal),
        diskonNota: BigInt(diskonNota),
        totalHarga: BigInt(totalHarga),
        jumlahDibayar: BigInt(jumlahDibayar),
        beratTotal: BigInt(totalBerat),
        kembalian: BigInt(kembalian),
        metodePembayaran,
        statusPembayaran,
        statusTransaksi: "SELESAI",
        tanggalTransaksi: transaksiDate,
        tanggalJatuhTempo: finalTanggalJatuhTempo,
      };

      // Deteksi tipe penjualan dari data yang sudah ada di penjualan
      // Jika ada karyawanId (sudah di-set via PATCH), berarti penjualan sales
      if (penjualan.karyawanId) {
        // Penjualan sales - pertahankan karyawanId dan customerId yang sudah ada
        // Tidak perlu update karena sudah di-set via PATCH sebelumnya
      }
      // Jika ada customerId tapi tidak ada karyawanId, berarti penjualan toko
      else if (penjualan.customerId || customerId) {
        updateData.customerId = customerId || penjualan.customerId;
      }

      // Update penjualan header
      const updated = await tx.penjualanHeader.update({
        where: { id: penjualanId },
        data: updateData,
        include: {
          customer: true,
          karyawan: true,
          items: {
            include: { barang: true },
          },
        },
      });

      if (jumlahDibayar > 0) {
        const normalizedTotalCash = toNumber(totalCash);
        const normalizedTotalTransfer = toNumber(totalTransfer);
        let totalCashFinal = normalizedTotalCash;
        let totalTransferFinal = normalizedTotalTransfer;

        if (metodePembayaran === "TRANSFER") {
          totalCashFinal = 0;
          totalTransferFinal =
            normalizedTotalTransfer > 0
              ? normalizedTotalTransfer
              : jumlahDibayar;
        } else if (metodePembayaran === "CASH_TRANSFER") {
          if (normalizedTotalCash === 0 && normalizedTotalTransfer === 0) {
            totalCashFinal = jumlahDibayar;
          }
        } else {
          totalTransferFinal = 0;
          totalCashFinal =
            normalizedTotalCash > 0 ? normalizedTotalCash : jumlahDibayar;
        }

        const pembayaranDate = transaksiDate;
        const pembayaranDateStr = pembayaranDate
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "");
        const lastPembayaran = await tx.pembayaranPenjualan.findFirst({
          where: {
            kodePembayaran: {
              startsWith: `BYR-${pembayaranDateStr}`,
            },
          },
          orderBy: {
            kodePembayaran: "desc",
          },
        });

        let nextPembayaranNumber = 1;
        if (lastPembayaran) {
          const lastNumber = parseInt(
            lastPembayaran.kodePembayaran.split("-")[2]
          );
          nextPembayaranNumber = lastNumber + 1;
        }

        const kodePembayaran = `BYR-${pembayaranDateStr}-${String(
          nextPembayaranNumber
        ).padStart(4, "0")}`;

        await tx.pembayaranPenjualan.create({
          data: {
            kodePembayaran,
            penjualanId,
            tanggalBayar: pembayaranDate,
            nominal: BigInt(jumlahDibayar),
            totalCash: BigInt(totalCashFinal),
            totalTransfer: BigInt(totalTransferFinal),
            metode: metodePembayaran,
            ...(userId ? { userId } : {}),
          },
        });
      }

      return updated;
    });

    // Generate receipt
    const receipt = {
      kodePenjualan: result.kodePenjualan,
      tanggal: result.tanggalTransaksi,
      customer: result.customer
        ? {
            nama: result.customer.nama,
            namaToko: result.customer.namaToko,
            piutang: toNumber(result.customer.piutang),
            limit_piutang: toNumber(result.customer.limit_piutang),
          }
        : null,
      karyawan: result.karyawan
        ? {
            id: result.karyawan.id,
            nama: result.karyawan.nama,
          }
        : null,
      items: result.items.map((item) => ({
        namaBarang: item.barang.namaBarang,
        ...deriveDusPcsFromTotal(
          getTotalItemPcs(item, toNumber(item.barang.jumlahPerKemasan)),
          toNumber(item.barang.jumlahPerKemasan)
        ),
        hargaJual: toNumber(item.hargaJual),
        diskon:
          toNumber(item.diskonPerItem) *
          deriveDusPcsFromTotal(
            getTotalItemPcs(item, toNumber(item.barang.jumlahPerKemasan)),
            toNumber(item.barang.jumlahPerKemasan)
          ).jumlahDus,
        subtotal:
          toNumber(item.hargaJual) *
            deriveDusPcsFromTotal(
              getTotalItemPcs(item, toNumber(item.barang.jumlahPerKemasan)),
              toNumber(item.barang.jumlahPerKemasan)
            ).jumlahDus -
          toNumber(item.diskonPerItem) *
            deriveDusPcsFromTotal(
              getTotalItemPcs(item, toNumber(item.barang.jumlahPerKemasan)),
              toNumber(item.barang.jumlahPerKemasan)
            ).jumlahDus,
      })),
      subtotal: toNumber(result.subtotal),
      diskonNota: toNumber(result.diskonNota),
      totalHarga: toNumber(result.totalHarga),
      metodePembayaran: result.metodePembayaran,
      jumlahDibayar: toNumber(result.jumlahDibayar),
      kembalian: toNumber(result.kembalian),
      sisaHutang,
      statusPembayaran: result.statusPembayaran,
      tanggalJatuhTempo: result.tanggalJatuhTempo,
      tipePenjualan: result.karyawanId ? "sales" : "toko",
    };

    return NextResponse.json(
      deepSerialize({
        success: true,
        message:
          statusPembayaran === "LUNAS"
            ? "Penjualan berhasil diselesaikan - LUNAS"
            : `Penjualan berhasil diselesaikan - HUTANG (Sisa: Rp ${sisaHutang.toLocaleString(
                "id-ID"
              )})`,
        data: {
          penjualan: result,
          receipt,
        },
      })
    );
  } catch (err) {
    console.error("Error checkout penjualan:", err);
    return NextResponse.json(
      { success: false, error: "Gagal checkout penjualan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
