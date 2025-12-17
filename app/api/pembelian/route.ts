import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// Helper function to convert BigInt to number safely
function bigIntToNumber(value: bigint | number): number {
  if (typeof value === "bigint") {
    return Number(value);
  }
  return value;
}

// Helper to serialize pembelian data with BigInt conversion
function serializePembelian(pembelian: any) {
  return {
    id: pembelian.id,
    kodePembelian: pembelian.kodePembelian,
    supplierId: pembelian.supplierId,
    subtotal: bigIntToNumber(pembelian.subtotal),
    diskonNota: bigIntToNumber(pembelian.diskonNota),
    totalHarga: bigIntToNumber(pembelian.totalHarga),
    jumlahDibayar: bigIntToNumber(pembelian.jumlahDibayar),
    kembalian: bigIntToNumber(pembelian.kembalian),
    statusPembayaran: pembelian.statusPembayaran,
    statusTransaksi: pembelian.statusTransaksi,
    createdAt: pembelian.createdAt,
    updatedAt: pembelian.updatedAt,
    tanggalJatuhTempo: pembelian.tanggalJatuhTempo,
    supplier: pembelian.supplier
      ? {
          id: pembelian.supplier.id,
          namaSupplier: pembelian.supplier.namaSupplier,
          alamat: pembelian.supplier.alamat,
          noHp: pembelian.supplier.noHp,
          limitHutang: bigIntToNumber(pembelian.supplier.limitHutang),
          hutang: bigIntToNumber(pembelian.supplier.hutang),
          isActive: pembelian.supplier.isActive,
          createdAt: pembelian.supplier.createdAt,
        }
      : undefined,
    items: pembelian.items?.map((item: any) => ({
      id: item.id,
      pembelianId: item.pembelianId,
      barangId: item.barangId,
      hargaPokok: bigIntToNumber(item.hargaPokok),
      diskonPerItem: bigIntToNumber(item.diskonPerItem),
      jumlahDus: bigIntToNumber(item.jumlahDus),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      barang: item.barang
        ? {
            id: item.barang.id,
            namaBarang: item.barang.namaBarang,
            hargaBeli: bigIntToNumber(item.barang.hargaBeli),
            hargaJual: bigIntToNumber(item.barang.hargaJual),
            stok: bigIntToNumber(item.barang.stok),
            jenisKemasan: item.barang.jenisKemasan,
            jumlahPerKemasan: bigIntToNumber(item.barang.jumlahPerKemasan),
            ukuran: bigIntToNumber(item.barang.ukuran),
            satuan: item.barang.satuan,
            supplierId: item.barang.supplierId,
            limitPenjualan: bigIntToNumber(item.barang.limitPenjualan),
            createdAt: item.barang.createdAt,
            updatedAt: item.barang.updatedAt,
            isActive: item.barang.isActive,
          }
        : undefined,
    })),
  };
}

// GET: Ambil pembelian dengan filter, pagination, dan date range
export async function GET(request: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Filters
    const status = searchParams.get("status"); // KERANJANG, SELESAI, DIBATALKAN
    const pembayaran = searchParams.get("pembayaran"); // LUNAS, HUTANG
    const supplierId = searchParams.get("supplierId");
    const search = searchParams.get("search");

    // Date range filter
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build where clause
    const where: any = {};

    // Status transaksi filter
    if (status && status !== "all") {
      where.statusTransaksi = status;
    }

    // Status pembayaran filter
    if (pembayaran && pembayaran !== "all") {
      where.statusPembayaran = pembayaran;
    }

    // Supplier filter
    if (supplierId) {
      where.supplierId = parseInt(supplierId);
    }

    // Search filter (kode pembelian atau nama supplier)
    if (search) {
      where.OR = [
        { kodePembelian: { contains: search, mode: "insensitive" } },
        {
          supplier: { namaSupplier: { contains: search, mode: "insensitive" } },
        },
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        // Set end date to end of day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Get total count for pagination info
    const totalCount = await prisma.pembelianHeader.count({ where });

    // Determine orderBy based on pembayaran filter
    // Jika filter HUTANG, sort by tanggalJatuhTempo ASC (yang paling dekat dulu)
    // Jika tidak, sort by createdAt DESC (terbaru dulu)
    let orderBy: any;
    if (pembayaran === "HUTANG") {
      orderBy = { tanggalJatuhTempo: "asc" };
    } else {
      orderBy = { createdAt: "desc" };
    }

    // Get paginated data
    const pembelian = await prisma.pembelianHeader.findMany({
      where,
      include: {
        supplier: true,
        items: {
          include: {
            barang: true,
          },
          orderBy: { id: "asc" },
        },
      },
      orderBy,
      skip,
      take: limit,
    });

    // Serialize data
    const serializedPembelian = pembelian.map(serializePembelian);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return NextResponse.json({
      success: true,
      data: serializedPembelian,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasMore,
      },
    });
  } catch (err) {
    console.error("Error fetching pembelian:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil data pembelian" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function untuk generate hash dari string untuk advisory lock
function stringToHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Ensure positive integer for advisory lock
  return Math.abs(hash);
}

// POST: Buat pembelian baru (keranjang) - Step 1: Pilih Supplier
export async function POST(request: NextRequest) {
  const MAX_RETRIES = 3;
  let retries = 0;

  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const { supplierId } = body;

    if (!supplierId) {
      return NextResponse.json(
        { success: false, error: "Supplier harus dipilih" },
        { status: 400 }
      );
    }

    // Cek supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      return NextResponse.json(
        { success: false, error: "Supplier tidak ditemukan" },
        { status: 404 }
      );
    }

    // Generate kode pembelian dengan advisory lock untuk mencegah race condition
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const datePrefix = `PMB-${year}${month}${day}`;
    const lockKey = stringToHash(datePrefix);

    // Set default tanggal jatuh tempo 30 hari dari sekarang
    const tanggalJatuhTempo = new Date();
    tanggalJatuhTempo.setDate(tanggalJatuhTempo.getDate() + 30);

    while (retries < MAX_RETRIES) {
      try {
        const pembelian = await prisma.$transaction(
          async (tx) => {
            // Acquire advisory lock
            await tx.$executeRawUnsafe(
              `SELECT pg_advisory_xact_lock(${lockKey})`
            );

            // Cari kode pembelian terakhir hari ini
            const lastPembelian = await tx.pembelianHeader.findFirst({
              where: {
                kodePembelian: {
                  startsWith: datePrefix,
                },
              },
              orderBy: {
                kodePembelian: "desc",
              },
              select: {
                kodePembelian: true,
              },
            });

            // Ambil nomor urut terakhir
            const lastNumber = lastPembelian
              ? parseInt(lastPembelian.kodePembelian.split("-")[2])
              : 0;

            // Generate kode baru
            const kodePembelian = `${datePrefix}-${String(
              lastNumber + 1
            ).padStart(3, "0")}`;

            // Buat pembelian baru
            const newPembelian = await tx.pembelianHeader.create({
              data: {
                kodePembelian,
                supplierId,
                statusTransaksi: "KERANJANG",
                statusPembayaran: "HUTANG",
                tanggalJatuhTempo,
                subtotal: BigInt(0),
                diskonNota: BigInt(0),
                totalHarga: BigInt(0),
                jumlahDibayar: BigInt(0),
                kembalian: BigInt(0),
              },
              include: {
                supplier: true,
                items: true,
              },
            });

            return newPembelian;
          },
          {
            isolationLevel: "Serializable",
            maxWait: 5000,
            timeout: 10000,
          }
        );

        return NextResponse.json(
          {
            success: true,
            message: "Keranjang pembelian berhasil dibuat",
            data: serializePembelian(pembelian),
          },
          { status: 201 }
        );
      } catch (error: any) {
        // Retry on unique constraint violation
        if (error.code === "P2002" && retries < MAX_RETRIES - 1) {
          retries++;
          console.log(`Retry attempt ${retries} due to duplicate key`);
          continue;
        }
        throw error;
      }
    }

    throw new Error("Failed to create pembelian after retries");
  } catch (err: any) {
    console.error("Error creating pembelian:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal membuat pembelian" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
