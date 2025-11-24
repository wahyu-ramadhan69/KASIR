import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET as string;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Await params untuk Next.js 15+
    const { id } = await params;

    // ✅ Await cookies() untuk Next.js 15+
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      role: string;
      userId: number;
    };

    if (decoded.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const userId = parseInt(id);
    const body = await request.json();
    const { username, email, role, isActive, password } = body;

    // Cek apakah user exist
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: "User tidak ditemukan" },
        { status: 404 }
      );
    }

    // Cek username duplikat
    if (username && username !== existingUser.username) {
      const duplicateUsername = await prisma.user.findUnique({
        where: { username },
      });

      if (duplicateUsername) {
        return NextResponse.json(
          { error: "Username sudah digunakan" },
          { status: 409 }
        );
      }
    }

    // Cek email duplikat
    if (email && email !== existingUser.email) {
      const duplicateEmail = await prisma.user.findUnique({
        where: { email },
      });

      if (duplicateEmail) {
        return NextResponse.json(
          { error: "Email sudah digunakan" },
          { status: 409 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {
      username: username || existingUser.username,
      email: email || existingUser.email,
      role: role || existingUser.role,
      isActive: isActive !== undefined ? isActive : existingUser.isActive,
    };

    // Update password jika diberikan
    if (password && password.length >= 6) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "User berhasil diupdate",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengupdate user" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Await params untuk Next.js 15+
    const { id } = await params;

    // ✅ Await cookies() untuk Next.js 15+
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      role: string;
      userId: number;
    };

    if (decoded.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const userId = parseInt(id);

    // Tidak bisa hapus diri sendiri
    if (decoded.userId === userId) {
      return NextResponse.json(
        { error: "Tidak dapat menghapus akun sendiri" },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      success: true,
      message: "User berhasil dihapus",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat menghapus user" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
