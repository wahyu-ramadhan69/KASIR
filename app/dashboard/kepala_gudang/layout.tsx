import { redirect } from "next/navigation";
import { getAuthData } from "@/app/AuthGuard";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authData = await getAuthData();

  if (!authData) {
    redirect("/");
  }

  if (authData.role !== "KEPALA_GUDANG") {
    redirect("/dashboard/kasir");
  }

  return <>{children}</>;
}
