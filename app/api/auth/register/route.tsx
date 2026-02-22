// app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const { username, email, password, role, karyawanId } =
      await request.json();

    // ✅ Validasi input
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: "Username, email, dan password harus diisi" },
        { status: 400 }
      );
    }

    // ✅ Validasi format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Format email tidak valid" },
        { status: 400 }
      );
    }

    // ✅ Validasi password minimal 6 karakter
    if (password.length < 4) {
      return NextResponse.json(
        { error: "Password minimal 6 karakter" },
        { status: 400 }
      );
    }

    // ✅ Validasi role (opsional, default KASIR)
    const validRoles = ["ADMIN", "KASIR", "KEPALA_GUDANG", "SALES"];
    const userRole = role && validRoles.includes(role) ? role : "KASIR";

    // 🔍 Cek apakah username sudah digunakan
    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUsername) {
      return NextResponse.json(
        { error: "Username sudah digunakan" },
        { status: 409 }
      );
    }

    // 🔍 Cek apakah email sudah digunakan
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: "Email sudah digunakan" },
        { status: 409 }
      );
    }

    // 🔐 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    let karyawanIdValue: number | null = null;
    if (userRole === "SALES") {
      if (!karyawanId) {
        return NextResponse.json(
          { error: "Karyawan wajib dipilih untuk role SALES" },
          { status: 400 }
        );
      }
      const karyawan = await prisma.karyawan.findUnique({
        where: { id: Number(karyawanId) },
      });
      if (!karyawan || karyawan.jenis !== "SALES") {
        return NextResponse.json(
          { error: "Karyawan SALES tidak ditemukan" },
          { status: 404 }
        );
      }
      const existingUserWithKaryawan = await prisma.user.findUnique({
        where: { karyawanId: Number(karyawanId) },
      });
      if (existingUserWithKaryawan) {
        return NextResponse.json(
          { error: "Karyawan sudah terhubung dengan user lain" },
          { status: 409 }
        );
      }
      karyawanIdValue = Number(karyawanId);
    }

    // ✅ Buat user baru
    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: userRole,
        ...(karyawanIdValue ? { karyawanId: karyawanIdValue } : {}),
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        karyawanId: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "User berhasil didaftarkan",
        user: newUser,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat registrasi" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
