import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

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

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasMore = page < totalPages;

    return NextResponse.json({
      success: true,
      data: pembelian,
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

// POST: Buat pembelian baru (keranjang) - Step 1: Pilih Supplier
export async function POST(request: NextRequest) {
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

    // Generate kode pembelian unik
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

    // Cari kode pembelian terakhir hari ini
    const lastPembelian = await prisma.pembelianHeader.findFirst({
      where: {
        kodePembelian: {
          startsWith: `PB-${dateStr}`,
        },
      },
      orderBy: {
        kodePembelian: "desc",
      },
    });

    let nextNumber = 1;
    if (lastPembelian) {
      // Extract nomor dari kode terakhir (PB-20251121-0005 -> 5)
      const lastNumber = parseInt(lastPembelian.kodePembelian.split("-")[2]);
      nextNumber = lastNumber + 1;
    }

    const kodePembelian = `PB-${dateStr}-${String(nextNumber).padStart(
      4,
      "0"
    )}`;

    // Set default tanggal jatuh tempo 30 hari dari sekarang
    const tanggalJatuhTempo = new Date();
    tanggalJatuhTempo.setDate(tanggalJatuhTempo.getDate() + 30);

    // Buat pembelian baru dengan status KERANJANG
    const pembelian = await prisma.pembelianHeader.create({
      data: {
        kodePembelian,
        supplierId,
        statusTransaksi: "KERANJANG",
        statusPembayaran: "HUTANG",
        tanggalJatuhTempo,
      },
      include: {
        supplier: true,
        items: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Keranjang pembelian berhasil dibuat",
        data: pembelian,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error creating pembelian:", err);
    return NextResponse.json(
      { success: false, error: "Gagal membuat pembelian" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
