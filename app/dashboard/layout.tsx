// app/layout.jsx
import "../globals.css";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { isAuthenticated, getAuthData } from "../AuthGuard";
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
  const authData = await getAuthData();
  // if (!auth || !authData) {
  //   redirect("/");
  // }
  // const { role, username } = authData;

  return (
    <div className="min-h-screen bg-gray-50/50">
      <Toaster position="top-right" />
      {/* <Sidebar role={role} username={username} /> */}
      <div className="p-4 transition-all duration-300 xl:ml-80 sidebar-content">
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
