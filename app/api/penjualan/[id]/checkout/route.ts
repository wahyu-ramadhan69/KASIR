import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const calculatePenjualan = (items: any[], diskonNota: number = 0) => {
  let subtotal = 0;
  let totalDiskonItem = 0;

  const calculatedItems = items.map((item) => {
    const totalPcs =
      item.jumlahDus * (item.barang?.jumlahPerkardus || 1) +
      (item.jumlahPcs || 0);
    const hargaTotal = item.hargaJual * item.jumlahDus;
    const hargaPcs =
      item.jumlahPcs > 0
        ? Math.round(
            (item.hargaJual / (item.barang?.jumlahPerkardus || 1)) *
              item.jumlahPcs
          )
        : 0;
    const totalHargaSebelumDiskon = hargaTotal + hargaPcs;
    const diskon = item.diskonPerItem * item.jumlahDus;

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
  try {
    // PENTING: await params dulu sebelum digunakan
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
      tanggalTransaksi,
    } = body;

    // Validasi penjualan
    const penjualan = await prisma.penjualanHeader.findUnique({
      where: { id: penjualanId },
      include: {
        customer: true,
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

    // =====================================================
    // VALIDASI PIUTANG CUSTOMER
    // =====================================================

    // Jika HUTANG, customer harus terdaftar (tidak boleh namaCustomer manual)
    if (statusPembayaran === "HUTANG") {
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

      // Ambil data customer untuk cek limit
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
      const piutangBaru = customer.piutang + sisaHutang;

      if (customer.limit_piutang > 0 && piutangBaru > customer.limit_piutang) {
        const sisaLimit = customer.limit_piutang - customer.piutang;
        return NextResponse.json(
          {
            success: false,
            error: `Piutang melebihi limit! Limit: Rp ${customer.limit_piutang.toLocaleString(
              "id-ID"
            )}, Piutang saat ini: Rp ${customer.piutang.toLocaleString(
              "id-ID"
            )}, Sisa limit: Rp ${sisaLimit.toLocaleString(
              "id-ID"
            )}, Hutang baru: Rp ${sisaHutang.toLocaleString("id-ID")}`,
          },
          { status: 400 }
        );
      }
    }

    // Validasi customer atau nama customer untuk transaksi LUNAS
    if (statusPembayaran === "LUNAS" && !customerId && !namaCustomer) {
      return NextResponse.json(
        { success: false, error: "Customer atau nama customer harus diisi" },
        { status: 400 }
      );
    }

    // Cek stok sebelum checkout
    for (const item of penjualan.items) {
      const totalPcsNeeded =
        item.jumlahDus * item.barang.jumlahPerkardus + item.jumlahPcs;
      if (item.barang.stok < totalPcsNeeded) {
        return NextResponse.json(
          {
            success: false,
            error: `Stok ${item.barang.namaBarang} tidak cukup. Tersedia: ${item.barang.stok} pcs`,
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
      // Kurangi stok barang
      for (const item of penjualan.items) {
        const totalPcs =
          item.jumlahDus * item.barang.jumlahPerkardus + item.jumlahPcs;
        await tx.barang.update({
          where: { id: item.barangId },
          data: {
            stok: { decrement: totalPcs },
          },
        });
      }

      // =====================================================
      // UPDATE PIUTANG CUSTOMER JIKA HUTANG
      // =====================================================
      if (statusPembayaran === "HUTANG" && customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            piutang: { increment: sisaHutang },
          },
        });
      }

      // Update penjualan header
      const updated = await tx.penjualanHeader.update({
        where: { id: penjualanId },
        data: {
          customerId: customerId || null,
          namaCustomer: customerId ? null : namaCustomer,
          subtotal: calculation.ringkasan.subtotal,
          diskonNota,
          totalHarga,
          jumlahDibayar,
          kembalian,
          metodePembayaran,
          statusPembayaran,
          statusTransaksi: "SELESAI",
          tanggalTransaksi: tanggalTransaksi
            ? new Date(tanggalTransaksi)
            : new Date(),
          tanggalJatuhTempo: finalTanggalJatuhTempo,
        },
        include: {
          customer: true,
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
            piutang: result.customer.piutang,
            limit_piutang: result.customer.limit_piutang,
          }
        : { nama: result.namaCustomer, namaToko: null },
      items: result.items.map((item) => ({
        namaBarang: item.barang.namaBarang,
        jumlahDus: item.jumlahDus,
        jumlahPcs: item.jumlahPcs,
        hargaJual: item.hargaJual,
        diskon: item.diskonPerItem * item.jumlahDus,
        subtotal:
          item.hargaJual * item.jumlahDus - item.diskonPerItem * item.jumlahDus,
      })),
      subtotal: result.subtotal,
      diskonNota: result.diskonNota,
      totalHarga: result.totalHarga,
      metodePembayaran: result.metodePembayaran,
      jumlahDibayar: result.jumlahDibayar,
      kembalian: result.kembalian,
      sisaHutang,
      statusPembayaran: result.statusPembayaran,
      tanggalJatuhTempo: result.tanggalJatuhTempo,
    };

    return NextResponse.json({
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
    });
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
