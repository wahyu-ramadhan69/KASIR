import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/AuthGuard";
import { writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "barang");
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function getExtension(filename: string): string {
  return path.extname(filename).toLowerCase();
}

export async function POST(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "File tidak ditemukan" },
        { status: 400 }
      );
    }

    // Validasi MIME type
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { success: false, error: "Tipe file tidak diizinkan. Gunakan JPG, PNG, WEBP, atau GIF" },
        { status: 400 }
      );
    }

    // Validasi ekstensi (double check terhadap spoofing nama file)
    const ext = getExtension(file.name);
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        { success: false, error: "Ekstensi file tidak diizinkan" },
        { status: 400 }
      );
    }

    // Validasi ukuran file
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "Ukuran file maksimal 2 MB" },
        { status: 400 }
      );
    }

    // Baca bytes dan verifikasi magic bytes (file signature)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!isValidImageBuffer(buffer, file.type)) {
      return NextResponse.json(
        { success: false, error: "File bukan gambar yang valid" },
        { status: 400 }
      );
    }

    // Generate nama file unik (UUID + ekstensi asli)
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueName);

    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/barang/${uniqueName}`;

    return NextResponse.json(
      { success: true, url: publicUrl, filename: uniqueName },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat upload file" },
      { status: 500 }
    );
  }
}

// DELETE file gambar lama
export async function DELETE(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { filename } = body as { filename?: string };

    if (!filename) {
      return NextResponse.json(
        { success: false, error: "Filename tidak ditemukan" },
        { status: 400 }
      );
    }

    // Sanitasi: pastikan tidak ada path traversal
    const safeName = path.basename(filename);
    if (safeName !== filename || safeName.includes("..")) {
      return NextResponse.json(
        { success: false, error: "Nama file tidak valid" },
        { status: 400 }
      );
    }

    const filePath = path.join(UPLOAD_DIR, safeName);

    if (existsSync(filePath)) {
      await unlink(filePath);
    }

    return NextResponse.json({ success: true, message: "File dihapus" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { success: false, error: "Terjadi kesalahan saat menghapus file" },
      { status: 500 }
    );
  }
}

/**
 * Verifikasi magic bytes untuk memastikan file benar-benar gambar,
 * bukan file berbahaya yang disamarkan dengan ekstensi .jpg/.png
 */
function isValidImageBuffer(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;

  const b = buffer;

  // JPEG: FF D8 FF
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mimeType === "image/png") {
    return (
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47
    );
  }

  // WEBP: 52 49 46 46 ... 57 45 42 50
  if (mimeType === "image/webp") {
    return (
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      buffer.length > 11 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50
    );
  }

  // GIF: 47 49 46 38
  if (mimeType === "image/gif") {
    return b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38;
  }

  return false;
}
