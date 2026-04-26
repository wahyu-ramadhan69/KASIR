import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated, getAuthData } from "@/app/AuthGuard";

const prisma = new PrismaClient();

function toNumber(v: any): number {
  if (typeof v === "bigint") return Number(v);
  return Number(v || 0);
}

// POST /api/hutang-lain/[id]/bayar
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await isAuthenticated();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userData = await getAuthData();
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) return NextResponse.json({ success: false, error: "ID tidak valid" }, { status: 400 });

    const body = await req.json();
    const { jumlahBayar, tanggalBayar, keterangan } = body;

    if (!jumlahBayar || Number(jumlahBayar) <= 0) {
      return NextResponse.json({ success: false, error: "Jumlah bayar harus lebih dari 0" }, { status: 400 });
    }

    const hutang = await prisma.hutangLain.findUnique({ where: { id } });
    if (!hutang) return NextResponse.json({ success: false, error: "Data tidak ditemukan" }, { status: 404 });
    if (hutang.status === "LUNAS") {
      return NextResponse.json({ success: false, error: "Hutang ini sudah lunas" }, { status: 400 });
    }

    const jumlahPokok = toNumber(hutang.jumlahPokok);
    const sudahDibayar = toNumber(hutang.jumlahDibayar);
    const sisa = jumlahPokok - sudahDibayar;
    const bayar = Math.min(Number(jumlahBayar), sisa); // tidak bisa lebih dari sisa
    const totalDibayarBaru = sudahDibayar + bayar;
    const lunas = totalDibayarBaru >= jumlahPokok;

    const [pembayaran, updated] = await prisma.$transaction([
      prisma.hutangLainPembayaran.create({
        data: {
          hutangLainId: id,
          jumlahBayar: BigInt(bayar),
          tanggalBayar: tanggalBayar ? new Date(tanggalBayar) : new Date(),
          keterangan: keterangan || null,
          userId: userData?.id ?? null,
        },
      }),
      prisma.hutangLain.update({
        where: { id },
        data: {
          jumlahDibayar: BigInt(totalDibayarBaru),
          status: lunas ? "LUNAS" : "AKTIF",
        },
        include: { pembayaran: { orderBy: { tanggalBayar: "desc" } } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      lunas,
      pembayaran: { ...pembayaran, jumlahBayar: toNumber(pembayaran.jumlahBayar) },
      data: {
        ...updated,
        jumlahPokok: toNumber(updated.jumlahPokok),
        jumlahDibayar: toNumber(updated.jumlahDibayar),
        pembayaran: updated.pembayaran.map((p) => ({ ...p, jumlahBayar: toNumber(p.jumlahBayar) })),
      },
    });
  } catch (error) {
    console.error("[POST /api/hutang-lain/[id]/bayar]", error);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
