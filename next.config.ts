import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname, // <-- WAJIB: supaya Next.js pakai folder "kasir" sebagai root
  },
};

export default nextConfig;
