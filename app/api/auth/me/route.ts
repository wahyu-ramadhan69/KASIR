// app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { getAuthData } from "@/app/AuthGuard";

export async function GET() {
  try {
    const authData = await getAuthData();

    if (!authData) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: authData.userId,
        username: authData.username,
        role: authData.role,
      },
    });
  } catch (error) {
    console.error("Error getting auth data:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
