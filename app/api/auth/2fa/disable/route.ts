import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET as string;

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = payload?.userId as number | undefined;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User tidak ditemukan" },
        { status: 404 }
      );
    }

    if (!user.twoFAEnabled) {
      return NextResponse.json(
        { success: false, error: "2FA belum aktif" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFAEnabled: false,
        twoFASecret: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "2FA berhasil dinonaktifkan",
    });
  } catch (err) {
    console.error("2FA disable error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal menonaktifkan 2FA" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
