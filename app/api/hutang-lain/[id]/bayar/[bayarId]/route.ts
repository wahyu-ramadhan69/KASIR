import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function toNumber(v: any): number {
  if (typeof v === "bigint") return Number(v);
  return Number(v || 0);
}

// Recalculate jumlahDibayar & status after edit/delete
async function recalculateHutang(hutangLainId: number) {
  const payments = await prisma.hutangLainPembayaran.findMany({
    where: { hutangLainId },
    select: { jumlahBayar: true },
  });

  const hutang = await prisma.hutangLain.findUnique({
    where: { id: hutangLainId },
    select: { jumlahPokok: true },
  });

  if (!hutang) return;

  const totalDibayar = payments.reduce((sum, p) => sum + toNumber(p.jumlahBayar), 0);
  const jumlahPokok = toNumber(hutang.jumlahPokok);
  const lunas = totalDibayar >= jumlahPokok;

  await prisma.hutangLain.update({
    where: { id: hutangLainId },
    data: {
      jumlahDibayar: BigInt(totalDibayar),
      status: lunas ? "LUNAS" : "AKTIF",
    },
  });
}

// PUT /api/hutang-lain/[id]/bayar/[bayarId]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; bayarId: string }> }
) {
  try {
    const auth = await isAuthenticated();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: idParam, bayarId: bayarIdParam } = await params;
    const hutangLainId = parseInt(idParam);
    const bayarId = parseInt(bayarIdParam);
    if (isNaN(hutangLainId) || isNaN(bayarId))
      return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });

    const body = await req.json();
    const { jumlahBayar, tanggalBayar, keterangan } = body;

    if (!jumlahBayar || Number(jumlahBayar) <= 0)
      return NextResponse.json({ success: false, error: "Jumlah bayar harus lebih dari 0" }, { status: 400 });

    const existing = await prisma.hutangLainPembayaran.findUnique({ where: { id: bayarId } });
    if (!existing || existing.hutangLainId !== hutangLainId)
      return NextResponse.json({ success: false, error: "Data pembayaran tidak ditemukan" }, { status: 404 });

    const updated = await prisma.hutangLainPembayaran.update({
      where: { id: bayarId },
      data: {
        jumlahBayar: BigInt(Math.round(Number(jumlahBayar))),
        tanggalBayar: tanggalBayar ? new Date(tanggalBayar) : existing.tanggalBayar,
        keterangan: keterangan ?? existing.keterangan,
      },
    });

    await recalculateHutang(hutangLainId);

    return NextResponse.json({
      success: true,
      data: { ...updated, jumlahBayar: toNumber(updated.jumlahBayar) },
    });
  } catch (error) {
    console.error("[PUT /api/hutang-lain/[id]/bayar/[bayarId]]", error);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/hutang-lain/[id]/bayar/[bayarId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; bayarId: string }> }
) {
  try {
    const auth = await isAuthenticated();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: idParam, bayarId: bayarIdParam } = await params;
    const hutangLainId = parseInt(idParam);
    const bayarId = parseInt(bayarIdParam);
    if (isNaN(hutangLainId) || isNaN(bayarId))
      return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });

    const existing = await prisma.hutangLainPembayaran.findUnique({ where: { id: bayarId } });
    if (!existing || existing.hutangLainId !== hutangLainId)
      return NextResponse.json({ success: false, error: "Data pembayaran tidak ditemukan" }, { status: 404 });

    await prisma.hutangLainPembayaran.delete({ where: { id: bayarId } });
    await recalculateHutang(hutangLainId);

    return NextResponse.json({ success: true, message: "Pembayaran berhasil dihapus" });
  } catch (error) {
    console.error("[DELETE /api/hutang-lain/[id]/bayar/[bayarId]]", error);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
