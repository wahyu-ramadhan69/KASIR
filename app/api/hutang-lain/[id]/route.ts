import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function toNumber(v: any): number {
  if (typeof v === "bigint") return Number(v);
  return Number(v || 0);
}

function serialize(h: any) {
  return {
    ...h,
    jumlahPokok: toNumber(h.jumlahPokok),
    jumlahDibayar: toNumber(h.jumlahDibayar),
    pembayaran: h.pembayaran?.map((p: any) => ({
      ...p,
      jumlahBayar: toNumber(p.jumlahBayar),
    })),
  };
}

// GET /api/hutang-lain/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await isAuthenticated();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });

    const hutang = await prisma.hutangLain.findUnique({
      where: { id },
      include: { pembayaran: { orderBy: { tanggalBayar: "desc" } } },
    });

    if (!hutang) return NextResponse.json({ success: false, error: "Data tidak ditemukan" }, { status: 404 });

    return NextResponse.json({ success: true, data: serialize(hutang) });
  } catch (error) {
    console.error("[GET /api/hutang-lain/[id]]", error);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// PUT /api/hutang-lain/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await isAuthenticated();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });

    const body = await req.json();
    const { namaHutang, jenisHutang, kreditur, jumlahPokok, tanggalMulai, tanggalJatuhTempo, keterangan } = body;

    const existing = await prisma.hutangLain.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ success: false, error: "Data tidak ditemukan" }, { status: 404 });
    if (existing.status === "LUNAS") {
      return NextResponse.json({ success: false, error: "Hutang yang sudah lunas tidak dapat diubah" }, { status: 400 });
    }

    const updated = await prisma.hutangLain.update({
      where: { id },
      data: {
        ...(namaHutang && { namaHutang }),
        ...(jenisHutang && { jenisHutang }),
        ...(kreditur && { kreditur }),
        ...(jumlahPokok && { jumlahPokok: BigInt(jumlahPokok) }),
        ...(tanggalMulai && { tanggalMulai: new Date(`${tanggalMulai}T00:00:00.000Z`) }),
        tanggalJatuhTempo: tanggalJatuhTempo
          ? new Date(`${tanggalJatuhTempo}T00:00:00.000Z`)
          : null,
        keterangan: keterangan ?? null,
      },
      include: { pembayaran: { orderBy: { tanggalBayar: "desc" } } },
    });

    return NextResponse.json({ success: true, data: serialize(updated) });
  } catch (error) {
    console.error("[PUT /api/hutang-lain/[id]]", error);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/hutang-lain/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await isAuthenticated();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });

    const hutang = await prisma.hutangLain.findUnique({
      where: { id },
      include: { _count: { select: { pembayaran: true } } },
    });

    if (!hutang) return NextResponse.json({ success: false, error: "Data tidak ditemukan" }, { status: 404 });
    if (hutang._count.pembayaran > 0) {
      return NextResponse.json(
        { success: false, error: "Tidak dapat menghapus hutang yang sudah memiliki riwayat pembayaran" },
        { status: 400 }
      );
    }

    await prisma.hutangLain.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Hutang berhasil dihapus" });
  } catch (error) {
    console.error("[DELETE /api/hutang-lain/[id]]", error);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
