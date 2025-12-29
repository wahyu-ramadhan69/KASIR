import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { authenticator } from "otplib";

export const runtime = "nodejs";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET as string;
const ENC_KEY_B64 = process.env.TWOFA_ENCRYPTION_KEY_BASE64 as string;

function decrypt(payload: string) {
  if (!ENC_KEY_B64) throw new Error("TWOFA_ENCRYPTION_KEY_BASE64 belum di-set");
  const KEY = Buffer.from(ENC_KEY_B64, "base64");
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc) + decipher.final("utf8");
}

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code)
      return NextResponse.json(
        { error: "Kode OTP wajib diisi" },
        { status: 400 }
      );

    const pending = req.cookies.get("2fa_pending")?.value; // ✅ FIX di sini
    if (!pending) {
      return NextResponse.json(
        { error: "2FA pending tidak ditemukan. Silakan login ulang." },
        { status: 401 }
      );
    }

    let pendingPayload: any;
    try {
      pendingPayload = jwt.verify(pending, JWT_SECRET);
    } catch {
      return NextResponse.json(
        { error: "2FA pending invalid/expired. Silakan login ulang." },
        { status: 401 }
      );
    }

    if (pendingPayload?.purpose !== "2fa" || !pendingPayload?.userId) {
      return NextResponse.json(
        { error: "2FA pending tidak valid" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: pendingPayload.userId },
    });
    if (!user || !user.twoFAEnabled || !user.twoFASecret) {
      return NextResponse.json(
        { error: "2FA tidak aktif / user tidak valid" },
        { status: 400 }
      );
    }

    authenticator.options = { window: 1 };
    const secret = decrypt(user.twoFASecret);

    const ok = authenticator.check(code, secret);
    if (!ok)
      return NextResponse.json({ error: "Kode OTP salah" }, { status: 400 });

    // ✅ issue token final sama seperti login kamu
    const finalPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      source: "database",
    };

    const token = jwt.sign(finalPayload, JWT_SECRET, { expiresIn: "12h" });

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });

    res.cookies.set({
      name: "token",
      value: token,
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 12 * 60 * 60,
      secure: process.env.NODE_ENV === "production",
    });

    // hapus pending
    res.cookies.set({
      name: "2fa_pending",
      value: "",
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
      secure: process.env.NODE_ENV === "production",
    });

    return res;
  } catch (err) {
    console.error("2FA login verify error:", err);
    return NextResponse.json(
      { error: "Gagal verifikasi OTP" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
