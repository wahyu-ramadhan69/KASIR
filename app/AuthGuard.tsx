import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Fungsi untuk cek token valid atau tidak (tetap seperti sebelumnya)
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return false;
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

// Fungsi baru untuk mengambil userId dan role
export async function getAuthData(): Promise<{
  userId: string;
  role: string;
  username: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return {
      username: decoded.username,
      userId: decoded.userId,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}
