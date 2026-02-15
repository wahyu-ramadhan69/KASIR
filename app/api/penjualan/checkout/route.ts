// app/api/penjualan/checkout/route.ts
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
async function getTotalPenjualanHariIni(barangId: number): Promise<number> {
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

// POST: Checkout penjualan langsung (tanpa keranjang di DB)
export async function POST(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const {
      items = [],
      jumlahDibayar,
      diskonNota = 0,
      metodePembayaran = "CASH",
      totalCash = 0,
      totalTransfer = 0,
      tanggalJatuhTempo,
      customerId,
      namaCustomer,
      salesId,
      namaSales,
      tanggalTransaksi,
    } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Keranjang masih kosong" },
        { status: 400 }
      );
    }

    const barangIds = items.map((item) => item.barangId).filter(Boolean);
    const uniqueBarangIds = Array.from(new Set(barangIds));
    if (uniqueBarangIds.length !== barangIds.length) {
      return NextResponse.json(
        { success: false, error: "Barang duplikat di keranjang" },
        { status: 400 }
      );
    }

    const barangList = await prisma.barang.findMany({
      where: { id: { in: uniqueBarangIds } },
    });

    const barangMap = new Map(barangList.map((b) => [b.id, b]));
    for (const item of items) {
      if (!barangMap.has(item.barangId)) {
        return NextResponse.json(
          { success: false, error: "Barang tidak ditemukan" },
          { status: 404 }
        );
      }
    }

    const normalizedItems = items.map((item) => {
      const barang = barangMap.get(item.barangId);
      const jumlahPerKemasan = toNumber(barang?.jumlahPerKemasan || 1);
      const totalItem = getTotalItemPcs(item, jumlahPerKemasan);
      const beratPerItem = toNumber(barang?.berat || 0);
      const beratItem =
        item.berat !== undefined && item.berat !== null
          ? Number(item.berat)
          : beratPerItem * totalItem;
      const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
        totalItem,
        jumlahPerKemasan
      );

      return {
        ...item,
        totalItem,
        jumlahDus,
        jumlahPcs,
        berat: beratItem,
        hargaJual: item.hargaJual,
        diskonPerItem: Number(item.diskonPerItem || 0),
        barang,
      };
    });

    // Validasi limit pembelian per hari untuk setiap item
    for (const item of normalizedItems) {
      const limitPenjualan = toNumber(item.barang.limitPenjualan);

      if (limitPenjualan > 0) {
        const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
        const totalPcsItem = getTotalItemPcs(item, jumlahPerKemasan);

        const totalTerjualHariIni = await getTotalPenjualanHariIni(
          item.barangId
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
    const calculation = calculatePenjualan(normalizedItems, diskonNota);
    const totalHarga = calculation.ringkasan.totalHarga;

    // Determine payment status
    const kembalian =
      jumlahDibayar >= totalHarga ? jumlahDibayar - totalHarga : 0;
    const statusPembayaran = jumlahDibayar >= totalHarga ? "LUNAS" : "HUTANG";
    const sisaHutang =
      statusPembayaran === "HUTANG" ? totalHarga - jumlahDibayar : 0;

    const isPenjualanSales = Boolean(salesId);

    // Validasi hutang untuk sales
    if (statusPembayaran === "HUTANG" && isPenjualanSales) {
      const karyawan = await prisma.karyawan.findUnique({
        where: { id: salesId },
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
    }

    // Validasi piutang customer untuk penjualan toko dengan hutang
    if (statusPembayaran === "HUTANG" && !isPenjualanSales) {
      if (!customerId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Transaksi dengan hutang harus menggunakan customer terdaftar. Customer tidak terdaftar tidak bisa mengambil hutang.",
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

      // Cek apakah piutang baru melebihi limit
      const piutangSekarang = toNumber(customer.piutang);
      const limitPiutang = toNumber(customer.limit_piutang);
      const piutangBaru = piutangSekarang + sisaHutang;

      if (limitPiutang > 0 && piutangBaru > limitPiutang) {
        // Over-limit tetap boleh, tapi limit_piutang tidak diubah
      }
    }

    // Validasi customer untuk transaksi LUNAS toko
    if (
      statusPembayaran === "LUNAS" &&
      !isPenjualanSales &&
      !customerId &&
      !namaCustomer
    ) {
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
    for (const item of normalizedItems) {
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

    const authData = await getAuthData();
    const userId = authData?.userId ? parseInt(authData.userId, 10) : undefined;

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
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
      const dateStr = transaksiDate
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");

      const lastPenjualan = await tx.penjualanHeader.findFirst({
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

      const createData: any = {
        kodePenjualan,
        statusTransaksi: "KERANJANG",
        statusPembayaran: "HUTANG",
        ...(userId ? { userId } : {}),
      };

      if (customerId) {
        createData.customerId = customerId;
      } else if (namaCustomer) {
        createData.namaCustomer = namaCustomer;
      }

      if (salesId) {
        createData.karyawanId = salesId;
      }

      if (namaSales) {
        createData.namaSales = namaSales;
      }

      const penjualan = await tx.penjualanHeader.create({
        data: createData,
      });

      for (const item of normalizedItems) {
        const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan || 1);
        const hargaBeliBarang = toNumber(item.barang.hargaBeli);
        const hargaJualFinal =
          item.hargaJual || toNumber(item.barang.hargaJual);
        const totalPcs = getTotalItemPcs(item, jumlahPerKemasan);
        const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
          totalPcs,
          jumlahPerKemasan
        );

        const hargaBeliPerPcs = Math.round(hargaBeliBarang / jumlahPerKemasan);
        const hargaJualPerPcs = Math.round(hargaJualFinal / jumlahPerKemasan);

        const labaPerDus =
          hargaJualFinal - item.diskonPerItem - hargaBeliBarang;
        const labaFromDus = labaPerDus * jumlahDus;

        const labaPerPcs = hargaJualPerPcs - hargaBeliPerPcs;
        const labaFromPcs = labaPerPcs * jumlahPcs;

        const totalLaba = labaFromDus + labaFromPcs;

        await tx.penjualanItem.create({
          data: {
            penjualanId: penjualan.id,
            barangId: item.barangId,
            totalItem: BigInt(totalPcs),
            berat: BigInt(item.berat || 0),
            hargaJual: BigInt(hargaJualFinal),
            hargaBeli: item.barang.hargaBeli,
            diskonPerItem: BigInt(item.diskonPerItem),
            laba: BigInt(totalLaba),
          },
        });
      }

      const createdItems = await tx.penjualanItem.findMany({
        where: { penjualanId: penjualan.id },
        include: { barang: true },
      });
      const totalBerat = createdItems.reduce(
        (sum, item) => sum + toNumber(item.berat),
        0
      );

      // Calculate total modal
      let totalModal = 0;
      for (const item of createdItems) {
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

      const totalLabaSebelum = createdItems.reduce(
        (sum, item) => sum + toNumber(item.laba),
        0
      );

      const totalLabaSesudah = totalHarga - totalModal;

      if (diskonNota > 0 && totalLabaSebelum > 0) {
        const adjustmentFactor = totalLabaSesudah / totalLabaSebelum;

        for (const item of createdItems) {
          const labaOriginal = toNumber(item.laba);
          const labaAdjusted = Math.round(labaOriginal * adjustmentFactor);

          await tx.penjualanItem.update({
            where: { id: item.id },
            data: { laba: BigInt(labaAdjusted) },
          });
        }
      }

      // Kurangi stok barang
      for (const item of createdItems) {
        const jumlahPerKemasan = toNumber(item.barang.jumlahPerKemasan);
        const totalPcs = getTotalItemPcs(item, jumlahPerKemasan);

        await tx.barang.update({
          where: { id: item.barangId },
          data: {
            stok: { decrement: BigInt(totalPcs) },
          },
        });
      }

      // Update piutang customer jika penjualan toko dengan HUTANG
      if (statusPembayaran === "HUTANG" && customerId && !salesId) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            piutang: { increment: BigInt(sisaHutang) },
          },
        });
      }

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

      const updated = await tx.penjualanHeader.update({
        where: { id: penjualan.id },
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
            penjualanId: penjualan.id,
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

    const receiptCustomer = result.customer
      ? {
          nama: result.customer.nama,
          namaToko: result.customer.namaToko,
          piutang: toNumber(result.customer.piutang),
          limit_piutang: toNumber(result.customer.limit_piutang),
        }
      : result.namaCustomer
      ? {
          nama: result.namaCustomer,
          namaToko: "",
          piutang: 0,
          limit_piutang: 0,
        }
      : null;

    const receipt = {
      kodePenjualan: result.kodePenjualan,
      tanggal: result.tanggalTransaksi,
      customer: receiptCustomer,
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
