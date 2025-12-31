import { redirect } from "next/navigation";
import { getAuthData } from "@/app/AuthGuard";

export default async function KasirLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/");
  }

  if (authData.role !== "KASIR") {
    redirect("/dashboard/admin");
  }

  return <>{children}</>;
}
