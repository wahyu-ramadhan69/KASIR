import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { authenticator } from "otplib";
import QRCode from "qrcode";

export const runtime = "nodejs";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET as string;
const ENC_KEY_B64 = process.env.TWOFA_ENCRYPTION_KEY_BASE64 as string;

function encrypt(text: string) {
  if (!ENC_KEY_B64) throw new Error("TWOFA_ENCRYPTION_KEY_BASE64 belum di-set");
  const KEY = Buffer.from(ENC_KEY_B64, "base64"); // 32 bytes
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export async function POST(req: NextRequest) {
  try {
    // Ambil cookie token dari request
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
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (user.twoFAEnabled) {
      return NextResponse.json({ error: "2FA sudah aktif" }, { status: 400 });
    }

    const secret = authenticator.generateSecret(); // base32
    const appName = "KasirInventory"; // ganti nama app kamu
    const otpauth = authenticator.keyuri(user.email, appName, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFASecret: encrypt(secret),
        twoFAEnabled: false,
      },
    });

    return NextResponse.json({ success: true, qrDataUrl });
  } catch (err) {
    console.error("2FA setup error:", err);
    return NextResponse.json(
      { error: "Gagal membuat QR 2FA" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
