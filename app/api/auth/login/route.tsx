import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs"; // atau "bcrypt"

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

    // 🔍 Cari user di database berdasarkan username
    const user = await prisma.user.findUnique({
      where: { username },
    });

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

    // 🔐 Verifikasi password (asumsi password di-hash dengan bcrypt)
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Username atau password salah" },
        { status: 401 }
      );
    }

    // ✅ Buat JWT token dengan role
    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      source: "database",
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    const response = NextResponse.json({
      success: true,
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
      maxAge: 60 * 60, // 1 jam
      secure: process.env.NODE_ENV === "production", // HTTPS di production
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
