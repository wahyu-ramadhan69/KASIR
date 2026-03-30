import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated, getAuthData } from "@/app/AuthGuard";

const prisma = new PrismaClient();

// GET - ambil konfigurasi aktif (atau default jika belum ada)
export async function GET(req: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let config = await prisma.konfigurasiGaji.findFirst({
      orderBy: { id: "asc" },
    });

    if (!config) {
      config = await prisma.konfigurasiGaji.create({
        data: {
          jamMasukBatas: "08:10",
          jamKerjaMenit: 540,
          potonganTelat: 10000,
          potonganKurangJam: 10000,
          upahLemburPerJam: 10000,
        },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("GET konfigurasi-gaji error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PUT - update konfigurasi (admin only)
export async function PUT(req: NextRequest) {
  const auth = await isAuthenticated();
  const authdata = await getAuthData();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (authdata?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      jamMasukBatas,
      jamKerjaMenit,
      potonganTelat,
      potonganKurangJam,
      upahLemburPerJam,
    } = body;

    // Validasi format jamMasukBatas (HH:mm)
    if (jamMasukBatas !== undefined) {
      const match = /^([01]\d|2[0-3]):([0-5]\d)$/.test(jamMasukBatas);
      if (!match) {
        return NextResponse.json(
          { error: "Format jam masuk batas tidak valid. Gunakan format HH:mm" },
          { status: 400 },
        );
      }
    }

    // Validasi nilai numerik positif
    const numericFields = {
      jamKerjaMenit,
      potonganTelat,
      potonganKurangJam,
      upahLemburPerJam,
    };
    for (const [key, val] of Object.entries(numericFields)) {
      if (val !== undefined && (typeof val !== "number" || val < 0)) {
        return NextResponse.json(
          { error: `Field ${key} harus berupa angka positif` },
          { status: 400 },
        );
      }
    }

    let config = await prisma.konfigurasiGaji.findFirst({
      orderBy: { id: "asc" },
    });

    if (!config) {
      config = await prisma.konfigurasiGaji.create({
        data: {
          jamMasukBatas: jamMasukBatas ?? "08:10",
          jamKerjaMenit: jamKerjaMenit ?? 540,
          potonganTelat: potonganTelat ?? 10000,
          potonganKurangJam: potonganKurangJam ?? 10000,
          upahLemburPerJam: upahLemburPerJam ?? 10000,
        },
      });
    } else {
      config = await prisma.konfigurasiGaji.update({
        where: { id: config.id },
        data: {
          ...(jamMasukBatas !== undefined && { jamMasukBatas }),
          ...(jamKerjaMenit !== undefined && { jamKerjaMenit }),
          ...(potonganTelat !== undefined && { potonganTelat }),
          ...(potonganKurangJam !== undefined && { potonganKurangJam }),
          ...(upahLemburPerJam !== undefined && { upahLemburPerJam }),
        },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("PUT konfigurasi-gaji error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
