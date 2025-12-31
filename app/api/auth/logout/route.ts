import { NextResponse } from "next/server";

async function handleLogout() {
  try {
    const response = NextResponse.json({ success: true });

    response.cookies.set({
      name: "token",
      value: "",
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
      secure: process.env.NODE_ENV === "production",
    });

    response.cookies.set({
      name: "2fa_pending",
      value: "",
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat logout" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return handleLogout();
}

export async function DELETE() {
  return handleLogout();
}
