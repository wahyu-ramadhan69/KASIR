// app/layout.jsx
import "../globals.css";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { isAuthenticated } from "../AuthGuard";
import { redirect } from "next/navigation";
import { Toaster } from "react-hot-toast";

export const metadata = {
  title: "Dashboard",
  description: "Sample layout dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const auth = await isAuthenticated();
  // if (!auth) {
  //   redirect("/");
  // }
  return (
    <div className="min-h-screen bg-gray-50/50">
      <Toaster position="top-right" />
      <Sidebar />
      <div className="p-4 xl:ml-80">
        <Navbar />
        <div className="mt-2">
          <div className="flex justify-center mb-4 grid-cols-1 gap-6 xl:grid-cols-3">
            {children}
          </div>
        </div>
        <div className="text-blue-gray-600">
          {/* <footer className="py-2"></footer> */}
        </div>
      </div>
    </div>
  );
}
