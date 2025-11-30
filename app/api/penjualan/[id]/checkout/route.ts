// app/api/penjualan/[id]/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

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

// Helper function untuk menghitung total penjualan
const calculatePenjualan = (items: any[], diskonNota: number = 0) => {
  let subtotal = 0;
  let totalDiskonItem = 0;

  const calculatedItems = items.map((item) => {
    const jumlahDus = toNumber(item.jumlahDus);
    const jumlahPcs = toNumber(item.jumlahPcs);
    const hargaJual = toNumber(item.hargaJual);
    const diskonPerItem = toNumber(item.diskonPerItem);
    const jumlahPerkardus = toNumber(item.barang?.jumlahPerkardus || 1);

    const totalPcs = jumlahDus * jumlahPerkardus + jumlahPcs;
    const hargaTotal = hargaJual * jumlahDus;
    const hargaPcs =
      jumlahPcs > 0 ? Math.round((hargaJual / jumlahPerkardus) * jumlahPcs) : 0;
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
    const { id } = await params;
    const penjualanId = parseInt(id);
    const body = await request.json();
    const {
      jumlahDibayar,
      diskonNota = 0,
      metodePembayaran = "CASH",
      tanggalJatuhTempo,
      customerId,
      namaCustomer,
      salesId,
      namaSales,
      tanggalTransaksi,
    } = body;

    // Validasi penjualan
    const penjualan = await prisma.penjualanHeader.findUnique({
      where: { id: penjualanId },
      include: {
        customer: true,
        sales: true,
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

    // Calculate totals
    const calculation = calculatePenjualan(penjualan.items, diskonNota);
    const totalHarga = calculation.ringkasan.totalHarga;

    // Determine payment status
    const kembalian =
      jumlahDibayar >= totalHarga ? jumlahDibayar - totalHarga : 0;
    const statusPembayaran = jumlahDibayar >= totalHarga ? "LUNAS" : "HUTANG";
    const sisaHutang =
      statusPembayaran === "HUTANG" ? totalHarga - jumlahDibayar : 0;

    // Deteksi tipe penjualan berdasarkan data yang ada
    const isPenjualanSales =
      salesId !== undefined || penjualan.salesId !== null;

    // Validasi hutang untuk sales
    if (statusPembayaran === "HUTANG" && isPenjualanSales) {
      if (!salesId) {
        return NextResponse.json(
          {
            success: false,
            error: "Transaksi dengan hutang harus menggunakan sales terdaftar",
          },
          { status: 400 }
        );
      }

      const sales = await prisma.sales.findUnique({
        where: { id: salesId },
      });

      if (!sales) {
        return NextResponse.json(
          { success: false, error: "Sales tidak ditemukan" },
          { status: 404 }
        );
      }

      // Cek limit hutang sales
      const hutangSekarang = toNumber(sales.hutang);
      const limitHutang = toNumber(sales.limitHutang);
      const hutangBaru = hutangSekarang + sisaHutang;

      if (limitHutang > 0 && hutangBaru > limitHutang) {
        const sisaLimit = limitHutang - hutangSekarang;
        return NextResponse.json(
          {
            success: false,
            error: `Hutang melebihi limit! Limit: Rp ${limitHutang.toLocaleString(
              "id-ID"
            )}, Hutang saat ini: Rp ${hutangSekarang.toLocaleString(
              "id-ID"
            )}, Sisa limit: Rp ${sisaLimit.toLocaleString(
              "id-ID"
            )}, Hutang baru: Rp ${sisaHutang.toLocaleString("id-ID")}`,
          },
          { status: 400 }
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
        const sisaLimit = limitPiutang - piutangSekarang;
        return NextResponse.json(
          {
            success: false,
            error: `Piutang melebihi limit! Limit: Rp ${limitPiutang.toLocaleString(
              "id-ID"
            )}, Piutang saat ini: Rp ${piutangSekarang.toLocaleString(
              "id-ID"
            )}, Sisa limit: Rp ${sisaLimit.toLocaleString(
              "id-ID"
            )}, Hutang baru: Rp ${sisaHutang.toLocaleString("id-ID")}`,
          },
          { status: 400 }
        );
      }
    }

    // Validasi customer atau nama customer untuk transaksi LUNAS toko
    if (
      statusPembayaran === "LUNAS" &&
      !isPenjualanSales &&
      !customerId &&
      !namaCustomer
    ) {
      return NextResponse.json(
        { success: false, error: "Customer atau nama customer harus diisi" },
        { status: 400 }
      );
    }

    // Validasi sales
    if (isPenjualanSales && salesId) {
      const sales = await prisma.sales.findUnique({
        where: { id: salesId },
      });

      if (!sales) {
        return NextResponse.json(
          { success: false, error: "Sales tidak ditemukan" },
          { status: 404 }
        );
      }
    }

    // Cek stok sebelum checkout
    for (const item of penjualan.items) {
      const jumlahDus = toNumber(item.jumlahDus);
      const jumlahPcs = toNumber(item.jumlahPcs);
      const jumlahPerkardus = toNumber(item.barang.jumlahPerkardus);
      const stokTersedia = toNumber(item.barang.stok);

      const totalPcsNeeded = jumlahDus * jumlahPerkardus + jumlahPcs;

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
    let finalTanggalJatuhTempo = penjualan.tanggalJatuhTempo;
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
        const jumlahDus = toNumber(item.jumlahDus);
        const jumlahPcs = toNumber(item.jumlahPcs);
        const hargaBeli = toNumber(item.hargaBeli);
        const jumlahPerkardus = toNumber(item.barang.jumlahPerkardus);

        const modalDus = hargaBeli * jumlahDus;
        const modalPcs =
          jumlahPcs > 0
            ? Math.round((hargaBeli / jumlahPerkardus) * jumlahPcs)
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
        const jumlahDus = toNumber(item.jumlahDus);
        const jumlahPcs = toNumber(item.jumlahPcs);
        const jumlahPerkardus = toNumber(item.barang.jumlahPerkardus);
        const totalPcs = jumlahDus * jumlahPerkardus + jumlahPcs;

        await tx.barang.update({
          where: { id: item.barangId },
          data: {
            stok: { decrement: BigInt(totalPcs) },
          },
        });
      }

      // Update hutang sales jika penjualan sales dengan HUTANG
      if (statusPembayaran === "HUTANG" && salesId) {
        await tx.sales.update({
          where: { id: salesId },
          data: {
            hutang: { increment: BigInt(sisaHutang) },
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

      // Prepare update data
      const updateData: any = {
        subtotal: BigInt(calculation.ringkasan.subtotal),
        diskonNota: BigInt(diskonNota),
        totalHarga: BigInt(totalHarga),
        jumlahDibayar: BigInt(jumlahDibayar),
        kembalian: BigInt(kembalian),
        metodePembayaran,
        statusPembayaran,
        statusTransaksi: "SELESAI",
        tanggalTransaksi: tanggalTransaksi
          ? new Date(tanggalTransaksi)
          : new Date(),
        tanggalJatuhTempo: finalTanggalJatuhTempo,
      };

      // Untuk penjualan sales: set salesId, hapus customerId & namaCustomer
      if (salesId) {
        updateData.salesId = salesId;
        updateData.namaSales = null;
        updateData.customerId = null;
        updateData.namaCustomer = null;
      }
      // Untuk penjualan sales manual (namaSales)
      else if (namaSales) {
        updateData.salesId = null;
        updateData.namaSales = namaSales;
        updateData.customerId = null;
        updateData.namaCustomer = null;
      }
      // Untuk penjualan toko: set customerId, hapus salesId & namaSales
      else {
        updateData.customerId = customerId || null;
        updateData.namaCustomer = customerId ? null : namaCustomer;
        updateData.salesId = null;
        updateData.namaSales = null;
      }

      // Update penjualan header
      const updated = await tx.penjualanHeader.update({
        where: { id: penjualanId },
        data: updateData,
        include: {
          customer: true,
          sales: true,
          items: {
            include: { barang: true },
          },
        },
      });

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
        : { nama: result.namaCustomer, namaToko: null },
      sales: result.sales
        ? {
            id: result.sales.id,
            namaSales: result.sales.namaSales,
          }
        : result.namaSales
        ? { nama: result.namaSales }
        : null,
      items: result.items.map((item) => ({
        namaBarang: item.barang.namaBarang,
        jumlahDus: toNumber(item.jumlahDus),
        jumlahPcs: toNumber(item.jumlahPcs),
        hargaJual: toNumber(item.hargaJual),
        diskon: toNumber(item.diskonPerItem) * toNumber(item.jumlahDus),
        subtotal:
          toNumber(item.hargaJual) * toNumber(item.jumlahDus) -
          toNumber(item.diskonPerItem) * toNumber(item.jumlahDus),
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
      tipePenjualan: result.salesId ? "sales" : "toko",
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
