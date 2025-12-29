import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET as string;

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized (token tidak ditemukan)" },
        { status: 401 }
      );
    }

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json(
        { success: false, error: "Unauthorized (token invalid/expired)" },
        { status: 401 }
      );
    }

    const userId = payload?.userId as number | undefined;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized (payload tidak valid)" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        email: true,
        twoFAEnabled: true,
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User tidak ditemukan" },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: "Akun dinonaktifkan" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        username: user.username,
        email: user.email,
        twoFactorEnabled: user.twoFAEnabled,
      },
    });
  } catch (err) {
    console.error("GET /api/auth/settings error:", err);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat mengambil data" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
