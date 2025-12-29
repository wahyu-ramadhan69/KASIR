import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET as string;

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username & Password harus diisi" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return NextResponse.json(
        { error: "Username atau password salah" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Akun Anda telah dinonaktifkan. Hubungi administrator." },
        { status: 403 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Username atau password salah" },
        { status: 401 }
      );
    }

    // ✅ jika 2FA aktif → pending token dulu
    if (user.twoFAEnabled) {
      const pendingToken = jwt.sign(
        { userId: user.id, purpose: "2fa" },
        JWT_SECRET,
        { expiresIn: "5m" }
      );

      const response = NextResponse.json({
        success: true,
        twoFARequired: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      });

      response.cookies.set({
        name: "2fa_pending",
        value: pendingToken,
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 5 * 60,
        secure: process.env.NODE_ENV === "production",
      });

      return response;
    }

    // ✅ normal login (tanpa 2FA)
    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      source: "database",
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });

    const response = NextResponse.json({
      success: true,
      twoFARequired: false,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set({
      name: "token",
      value: token,
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 12 * 60 * 60,
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat login" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
