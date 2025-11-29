import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated, getAuthData } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function deepSerialize(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "bigint") {
    return Number(obj);
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepSerialize);
  }

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

// GET - Mengambil semua pengeluaran
export async function GET() {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authData = await getAuthData();
  try {
    const pengeluaran = await prisma.pengeluaran.findMany({
      orderBy: { id: "desc" },
      include: {
        user: true,
      },
    });

    const serialized = deepSerialize(pengeluaran);

    return NextResponse.json(
      { success: true, data: serialized },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching pengeluaran:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mengambil data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// POST - Menambah pengeluaran baru
export async function POST(request: Request) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { namaPengeluaran, jumlah, keterangan } = body;

    if (!namaPengeluaran || !jumlah) {
      return NextResponse.json(
        { success: false, error: "Jenis, jumlah harus diisi" },
        { status: 400 }
      );
    }

    const pengeluaran = await prisma.pengeluaran.create({
      data: {
        namaPengeluaran: namaPengeluaran,
        jumlah: parseInt(jumlah),
        keterangan: keterangan || null,
        userId: parseInt(authData.userId),
      },
      include: {
        user: true,
      },
    });

    const serialized = deepSerialize(pengeluaran);

    return NextResponse.json(
      { success: true, data: serialized },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating pengeluaran:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat menambahkan data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
