import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

type RouteCtx = {
  params: Promise<{ id: string }>;
};

// Helper function to convert BigInt to number safely
function bigIntToNumber(value: bigint | number): number {
  if (typeof value === "bigint") {
    return Number(value);
  }
  return value;
}

function parseId(id: string | undefined) {
  const num = Number(id);
  if (!id || Number.isNaN(num)) return null;
  return num;
}

// GET info hutang customer (jumlah transaksi hutang & sisa limit)
export async function GET(_request: NextRequest, { params }: RouteCtx) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const idNum = parseId(id);

  if (idNum === null) {
    return NextResponse.json(
      { success: false, error: "ID tidak valid" },
      { status: 400 }
    );
  }

  try {
    // Get customer data
    const customer = await prisma.customer.findUnique({
      where: { id: idNum },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer tidak ditemukan" },
        { status: 404 }
      );
    }

    // Count jumlah transaksi yang masih hutang
    const jumlahTransaksiHutang = await prisma.penjualanHeader.count({
      where: {
        customerId: idNum,
        statusPembayaran: "HUTANG",
        statusTransaksi: "SELESAI",
        isDeleted: false,
      },
    });

    // Calculate sisa limit hutang
    const sisaLimitHutang = bigIntToNumber(customer.limit_piutang) - bigIntToNumber(customer.piutang);

    return NextResponse.json({
      success: true,
      data: {
        customerId: customer.id,
        nama: customer.nama,
        namaToko: customer.namaToko,
        limit_piutang: bigIntToNumber(customer.limit_piutang),
        piutang: bigIntToNumber(customer.piutang),
        sisaLimitHutang: Math.max(0, sisaLimitHutang),
        jumlahTransaksiHutang,
      },
    });
  } catch (err) {
    console.error("Error fetching customer hutang info:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
