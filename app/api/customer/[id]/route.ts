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

// Helper to serialize customer data with BigInt conversion
function serializeCustomer(customer: any) {
  return {
    ...customer,
    limit_piutang: bigIntToNumber(customer.limit_piutang),
    piutang: bigIntToNumber(customer.piutang),
  };
}

function parseId(id: string | undefined) {
  const num = Number(id);
  if (!id || Number.isNaN(num)) return null;
  return num;
}

// GET detail customer
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
    const customer = await prisma.customer.findUnique({
      where: { id: idNum },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: serializeCustomer(customer),
    });
  } catch (err) {
    console.error("Error fetching customer:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(request: NextRequest, { params }: RouteCtx) {
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
    const body = await request.json();
    const { nik, nama, alamat, namaToko, noHp, limit_piutang, piutang } = body;

    // CEK APAKAH CUSTOMER ADA
    const current = await prisma.customer.findUnique({
      where: { id: idNum },
    });

    if (!current) {
      return NextResponse.json(
        { success: false, error: "Customer tidak ditemukan" },
        { status: 404 }
      );
    }

    // CEK JIKA NIK DIGUNAKAN CUSTOMER LAIN
    if (nik && nik !== current.nik) {
      const nikExist = await prisma.customer.findUnique({
        where: { nik },
      });

      if (nikExist) {
        return NextResponse.json(
          { success: false, error: "NIK sudah terdaftar" },
          { status: 400 }
        );
      }
    }

    // Build update data object with BigInt conversion
    const updateData: {
      nik?: string;
      nama?: string;
      alamat?: string;
      namaToko?: string;
      noHp?: string;
      limit_piutang?: bigint;
      piutang?: bigint;
    } = {};

    if (nik !== undefined) updateData.nik = nik;
    if (nama !== undefined) updateData.nama = nama;
    if (alamat !== undefined) updateData.alamat = alamat;
    if (namaToko !== undefined) updateData.namaToko = namaToko;
    if (noHp !== undefined) updateData.noHp = noHp;
    if (limit_piutang !== undefined)
      updateData.limit_piutang = BigInt(limit_piutang);
    if (piutang !== undefined) updateData.piutang = BigInt(piutang);

    const updated = await prisma.customer.update({
      where: { id: idNum },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Customer berhasil diperbarui",
      data: serializeCustomer(updated),
    });
  } catch (err) {
    console.error("Error updating customer:", err);
    return NextResponse.json(
      { success: false, error: "Gagal memperbarui customer" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE customer
export async function DELETE(_req: NextRequest, { params }: RouteCtx) {
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
    await prisma.customer.delete({
      where: { id: idNum },
    });

    return NextResponse.json({
      success: true,
      message: "Customer berhasil dihapus",
    });
  } catch (err) {
    console.error("Error deleting customer:", err);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus customer" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
