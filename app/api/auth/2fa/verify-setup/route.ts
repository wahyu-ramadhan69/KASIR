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

    const token = req.cookies.get("token")?.value;
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = payload?.userId as number | undefined;
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFASecret) {
      return NextResponse.json(
        { error: "2FA belum di-setup" },
        { status: 400 }
      );
    }

    authenticator.options = { window: 1 }; // toleransi waktu
    const secret = decrypt(user.twoFASecret);

    const ok = authenticator.check(code, secret);
    if (!ok)
      return NextResponse.json({ error: "Kode OTP salah" }, { status: 400 });

    await prisma.user.update({
      where: { id: userId },
      data: { twoFAEnabled: true },
    });

    return NextResponse.json({
      success: true,
      message: "2FA berhasil diaktifkan",
    });
  } catch (err) {
    console.error("2FA verify-setup error:", err);
    return NextResponse.json(
      { error: "Gagal verifikasi 2FA" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
