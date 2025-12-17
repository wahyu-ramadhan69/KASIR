// app/api/penjualan/createcode/route.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

export async function GET() {
  try {
    // Generate kode penjualan berdasarkan tanggal hari ini
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const dateFormat = `${year}${month}${day}`;
    const datePrefix = `PNJ-${dateFormat}`;

    // IMPORTANT: Gunakan PostgreSQL advisory lock untuk mencegah race condition
    // Advisory lock bekerja di level database, bukan row, jadi aman untuk concurrent access
    const lockKey = stringToHash(datePrefix);

    const kodePenjualan = await prisma.$transaction(
      async (tx) => {
        // Acquire advisory lock - ini akan block sampai lock didapat
        // Lock ini akan otomatis di-release setelah transaction selesai
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock(${lockKey})`
        );

        // Sekarang kita punya exclusive lock untuk date prefix ini
        // Cari kode penjualan terakhir hari ini
        const lastPenjualan = await tx.penjualanHeader.findFirst({
          where: {
            kodePenjualan: {
              startsWith: datePrefix,
            },
          },
          orderBy: {
            kodePenjualan: "desc",
          },
          select: {
            kodePenjualan: true,
          },
        });

        // Ambil nomor urut terakhir, jika ada
        const lastNumber = lastPenjualan
          ? parseInt(lastPenjualan.kodePenjualan.split("-")[3])
          : 0;

        // Generate kode penjualan baru dengan format PNJ-YYYYMMDD-NNN
        const newCode = `PNJ-${dateFormat}-${String(lastNumber + 1).padStart(
          3,
          "0"
        )}`;

        return newCode;
      },
      {
        isolationLevel: "ReadCommitted", // Read committed sudah cukup dengan advisory lock
        maxWait: 5000, // Maximum time to wait for a transaction slot (5s)
        timeout: 10000, // Maximum time the transaction can run (10s)
      }
    );

    return Response.json(
      {
        success: true,
        data: {
          kodePenjualan,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error generating kode penjualan:", error);
    return Response.json(
      {
        success: false,
        message: error.message || "Gagal generate kode penjualan",
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
