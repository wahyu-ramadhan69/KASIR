// app/api/penjualan-luar-kota/[id]/transaksi/route.ts

import { NextRequest } from "next/server";
import {
  MetodePembayaran,
  PrismaClient,
  StatusPerjalanan,
} from "@prisma/client";

const prisma = new PrismaClient();

/**
 * POST /api/penjualan-luar-kota/[id]/transaksi
 * Kasir input transaksi dari catatan sales
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const perjalananId = parseInt(id);
    const body = await request.json();

    if (isNaN(perjalananId)) {
      return Response.json(
        {
          success: false,
          message: "ID perjalanan tidak valid",
        },
        { status: 400 }
      );
    }

    // Validasi
    if (!body.items || body.items.length === 0) {
      return Response.json(
        {
          success: false,
          message: "Items tidak boleh kosong",
        },
        { status: 400 }
      );
    }

    if (!body.kodePenjualan) {
      return Response.json(
        {
          success: false,
          message: "Kode penjualan tidak boleh kosong",
        },
        { status: 400 }
      );
    }

    // Cek perjalanan exists dan statusnya
    const perjalanan = await prisma.perjalananSales.findUnique({
      where: { id: perjalananId },
      include: {
        karyawan: true,
        manifestBarang: {
          include: {
            barang: {
              select: {
                id: true,
                namaBarang: true,
                jumlahPerKemasan: true,
              },
            },
          },
        },
      },
    });

    if (!perjalanan) {
      return Response.json(
        {
          success: false,
          message: "Perjalanan tidak ditemukan",
        },
        { status: 404 }
      );
    }

    // Hanya bisa input transaksi jika status KEMBALI atau DI_PERJALANAN
    if (!["KEMBALI", "DI_PERJALANAN"].includes(perjalanan.statusPerjalanan)) {
      return Response.json(
        {
          success: false,
          message:
            "Transaksi hanya bisa diinput saat status KEMBALI atau DI_PERJALANAN",
        },
        { status: 400 }
      );
    }

    // Validasi uniqueness kode penjualan dari frontend
    const kodePenjualan = body.kodePenjualan;
    const existingPenjualan = await prisma.penjualanHeader.findFirst({
      where: {
        kodePenjualan: kodePenjualan,
      },
    });

    if (existingPenjualan) {
      return Response.json(
        {
          success: false,
          message: "Kode penjualan sudah digunakan. Silakan refresh halaman dan coba lagi.",
        },
        { status: 409 } // 409 Conflict
      );
    }

    // Validasi barang dalam manifest
    const barangIds: number[] = body.items.map((item: any) => item.barangId);
    const manifestBarangIds: number[] = perjalanan.manifestBarang.map(
      (m) => m.barangId
    );

    const invalidBarang = barangIds.filter(
      (id: number) => !manifestBarangIds.includes(id)
    );
    if (invalidBarang.length > 0) {
      return Response.json(
        {
          success: false,
          message: `Barang dengan ID ${invalidBarang.join(
            ", "
          )} tidak ada dalam manifest`,
        },
        { status: 400 }
      );
    }

    // Get barang details
    const barangList = await prisma.barang.findMany({
      where: {
        id: { in: barangIds },
      },
    });

    // Handle customer (existing atau baru)
    let customerId = body.customerId;

    if (!customerId && body.namaCustomer) {
      // Cek apakah customer dengan nama yang sama sudah ada
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          nama: body.namaCustomer,
        },
      });

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else if (body.namaToko && body.alamat && body.noHp) {
        // Generate NIK untuk customer baru
        const lastCustomer = await prisma.customer.findFirst({
          orderBy: { id: "desc" },
        });
        const newNik = `CUST-${String((lastCustomer?.id || 0) + 1).padStart(
          6,
          "0"
        )}`;

        // Buat customer baru
        const newCustomer = await prisma.customer.create({
          data: {
            nik: newNik,
            nama: body.namaCustomer,
            alamat: body.alamat,
            namaToko: body.namaToko,
            noHp: body.noHp,
          },
        });
        customerId = newCustomer.id;
      }
    }

    const manifestMap = new Map<
      number,
      (typeof perjalanan.manifestBarang)[number]
    >();
    perjalanan.manifestBarang.forEach((m) => manifestMap.set(m.barangId, m));

    // Normalisasi metode pembayaran (UI kirim "TUNAI")
    const metodePembayaran =
      body.metodePembayaran === "TUNAI"
        ? MetodePembayaran.CASH
        : body.metodePembayaran;

    if (!Object.values(MetodePembayaran).includes(metodePembayaran)) {
      return Response.json(
        {
          success: false,
          message: "Metode pembayaran tidak valid",
        },
        { status: 400 }
      );
    }

    // Hitung subtotal dan total
    let subtotal = 0;
    const itemsData = [];

    for (const item of body.items) {
      const barang = barangList.find((b) => b.id === item.barangId);
      if (!barang) {
        return Response.json(
          {
            success: false,
            message: `Barang dengan ID ${item.barangId} tidak ditemukan`,
          },
          { status: 404 }
        );
      }

      const totalPcs =
        Number(item.jumlahDus) * Number(barang.jumlahPerKemasan) +
        Number(item.jumlahPcs);
      const manifest = manifestMap.get(item.barangId);

      if (manifest) {
        const sisaManifest = Number(manifest.totalItem); // totalItem disimpan sebagai stok tersisa

        if (totalPcs > sisaManifest) {
          return Response.json(
            {
              success: false,
              message: `Jumlah untuk ${barang.namaBarang} melebihi stok manifest (tersisa ${sisaManifest} pcs)`,
            },
            { status: 400 }
          );
        }
      }

      const hargaPerPcs = Number(item.hargaJual);
      const itemSubtotal = totalPcs * hargaPerPcs;
      const diskon = Number(item.diskonPerItem || 0);
      const itemTotal = itemSubtotal - diskon;

      subtotal += itemTotal;

      // Hitung laba
      const hargaBeliPerPcs =
        Number(barang.hargaBeli) / Number(barang.jumlahPerKemasan);
      const totalHargaBeli = totalPcs * hargaBeliPerPcs;
      const laba = itemTotal - totalHargaBeli;

      itemsData.push({
        barangId: item.barangId,
        jumlahDus: BigInt(item.jumlahDus),
        jumlahPcs: BigInt(item.jumlahPcs),
        hargaJual: BigInt(hargaPerPcs),
        hargaBeli: BigInt(Math.floor(hargaBeliPerPcs)),
        diskonPerItem: BigInt(diskon),
        laba: BigInt(Math.floor(laba)),
      });
    }

    const diskonNota = Number(body.diskonNota || 0);
    const totalHarga = subtotal - diskonNota;
    const jumlahDibayar = Number(body.jumlahDibayar || 0);
    const kembalian =
      jumlahDibayar > totalHarga ? jumlahDibayar - totalHarga : 0;

    // TODO: Get userId from session
    const userId = 1;

    // Create penjualan header
    const penjualan = await prisma.penjualanHeader.create({
      data: {
        kodePenjualan,
        perjalananSalesId: perjalananId,
        customerId: customerId || null,
        namaCustomer: body.namaCustomer || null,
        karyawanId: perjalanan.karyawanId,
        namaSales: perjalanan.karyawan.nama,
        subtotal: BigInt(subtotal),
        diskonNota: BigInt(diskonNota),
        totalHarga: BigInt(totalHarga),
        jumlahDibayar: BigInt(jumlahDibayar),
        kembalian: BigInt(kembalian),
        keterangan: body.keterangan,
        metodePembayaran,
        statusPembayaran: body.statusPembayaran,
        statusTransaksi: "SELESAI",
        tanggalTransaksi: new Date(body.tanggalTransaksi),
        tanggalJatuhTempo: body.tanggalJatuhTempo
          ? new Date(body.tanggalJatuhTempo)
          : null,
        userId: userId,
        items: {
          create: itemsData,
        },
      },
      include: {
        items: {
          include: {
            barang: {
              select: {
                id: true,
                namaBarang: true,
                satuan: true,
                jumlahPerKemasan: true,
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            nama: true,
            namaToko: true,
          },
        },
        karyawan: {
          select: {
            id: true,
            nama: true,
          },
        },
      },
    });

    // Update piutang customer jika HUTANG
    if (body.statusPembayaran === "HUTANG" && customerId) {
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          piutang: {
            increment: BigInt(totalHarga - jumlahDibayar),
          },
        },
      });
    }

    // Update stok barang
    for (const item of body.items) {
      const barang = barangList.find((b) => b.id === item.barangId);
      if (!barang) continue;

      const totalPcsJual =
        Number(item.jumlahDus) * Number(barang.jumlahPerKemasan) +
        Number(item.jumlahPcs);
      const currentStokPcs = Number(barang.stok);
      const newStokPcs = currentStokPcs - totalPcsJual;

      await prisma.barang.update({
        where: { id: item.barangId },
        data: {
          stok: BigInt(Math.max(0, newStokPcs)),
        },
      });
    }

    // Update jumlahTerjual di manifest perjalanan
    const manifestUpdates: any[] = [];

    for (const item of body.items) {
      const manifest = manifestMap.get(item.barangId);
      if (!manifest) continue;
      const jumlahPerDus = Number(manifest.barang.jumlahPerKemasan) || 1;
      const totalPcsJual =
        Number(item.jumlahDus) * jumlahPerDus + Number(item.jumlahPcs);
      const sisaSebelumnya = Number(manifest.totalItem);
      const sisaBaru = Math.max(0, sisaSebelumnya - totalPcsJual);

      manifestUpdates.push(
        prisma.manifestBarang.update({
          where: { id: manifest.id },
          data: {
            jumlahTerjual: {
              increment: BigInt(totalPcsJual),
            },
            totalItem: BigInt(sisaBaru),
          },
        })
      );
    }

    if (manifestUpdates.length) {
      await prisma.$transaction(manifestUpdates);
    }

    // Jika semua manifest habis, tandai perjalanan selesai
    const remainingManifest = await prisma.manifestBarang.count({
      where: {
        perjalananId,
        totalItem: {
          gt: BigInt(0),
        },
      },
    });

    if (remainingManifest === 0) {
      await prisma.perjalananSales.update({
        where: { id: perjalananId },
        data: { statusPerjalanan: StatusPerjalanan.SELESAI },
      });
    }

    // Convert BigInt to string
    const result = JSON.parse(
      JSON.stringify(penjualan, (_, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return Response.json(
      {
        success: true,
        message: "Transaksi berhasil dibuat",
        data: result,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating transaksi:", error);
    return Response.json(
      {
        success: false,
        message: error.message || "Gagal membuat transaksi",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/penjualan-luar-kota/[id]/transaksi
 * Get list transaksi dari perjalanan
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const perjalananId = parseInt(id);

    if (isNaN(perjalananId)) {
      return Response.json(
        {
          success: false,
          message: "ID perjalanan tidak valid",
        },
        { status: 400 }
      );
    }

    const transaksi = await prisma.penjualanHeader.findMany({
      where: {
        perjalananSalesId: perjalananId,
      },
      include: {
        items: {
          include: {
            barang: {
              select: {
                id: true,
                namaBarang: true,
                satuan: true,
                jumlahPerKemasan: true,
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            nama: true,
            namaToko: true,
          },
        },
        karyawan: {
          select: {
            id: true,
            nama: true,
          },
        },
      },
      orderBy: {
        tanggalTransaksi: "asc",
      },
    });

    // Convert BigInt to string
    const result = JSON.parse(
      JSON.stringify(transaksi, (_, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return Response.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error fetching transaksi:", error);
    return Response.json(
      {
        success: false,
        message: "Gagal mengambil data transaksi",
      },
      { status: 500 }
    );
  }
}
