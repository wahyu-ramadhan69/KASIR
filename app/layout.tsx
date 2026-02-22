import type { Metadata } from "next";
import { Rubik, Barlow } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-rubik",
  display: "swap",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-barlow",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AW Sembako",
  description: "AW Sembako E-commerce Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${rubik.variable} ${barlow.variable}`}>
      <body>
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  );
}
