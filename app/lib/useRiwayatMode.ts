"use client";
// Mode akses riwayat penjualan kasir (diatur admin).
// "HARI_INI" -> kasir hanya bisa melihat transaksi hari ini.
import { useEffect, useState } from "react";

export type RiwayatMode = "SEMUA" | "HARI_INI";

/** null = masih memuat */
export function useRiwayatMode(jenis: "toko" | "sales"): RiwayatMode | null {
  const [mode, setMode] = useState<RiwayatMode | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/pengaturan/riwayat-kasir", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setMode(data?.success ? data.data[jenis] : "SEMUA");
      })
      .catch(() => active && setMode("SEMUA"));
    return () => {
      active = false;
    };
  }, [jenis]);

  return mode;
}
