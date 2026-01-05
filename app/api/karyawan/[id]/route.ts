// app/api/karyawan/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "@/app/AuthGuard";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const karyawan = await prisma.karyawan.findUnique({
      where: { id: parseInt(id) },
    });

    if (!karyawan) {
      return NextResponse.json(
        { error: "Karyawan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(karyawan);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch karyawan" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();

    const karyawan = await prisma.karyawan.update({
      where: { id: parseInt(id) },
      data: {
        nama: body.nama,
        nik: body.nik,
        noHp: body.noHp,
        alamat: body.alamat,
        jenis: body.jenis,
        gajiPokok: body.gajiPokok,
        tunjanganMakan: body.tunjanganMakan,
        totalPinjaman: body.totalPinjaman,
      },
    });

    return NextResponse.json(karyawan);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update karyawan" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isAuthenticated();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const karyawan = await prisma.karyawan.update({
      where: { id: parseInt(id) },
      data: { isActive: false },
    });

    return NextResponse.json(karyawan);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete karyawan" },
      { status: 500 }
    );
  }
}
