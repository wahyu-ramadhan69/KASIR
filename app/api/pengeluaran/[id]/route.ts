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

// PUT - Update pengeluaran
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // ← Ubah jadi Promise
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authData = await getAuthData();
  if (!authData) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params; // ← Await params
    const body = await request.json();
    const { namaPengeluaran, jumlah, keterangan } = body;

    const pengeluaran = await prisma.pengeluaran.update({
      where: { id: parseInt(id) },
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
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating pengeluaran:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mengupdate data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE - Hapus pengeluaran
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // ← Ubah jadi Promise
) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params; // ← Await params

    await prisma.pengeluaran.delete({
      where: { id: parseInt(id) }, // ← Gunakan id yang sudah di-await
    });

    return NextResponse.json(
      { success: true, message: "Pengeluaran berhasil dihapus" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting pengeluaran:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat menghapus data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
