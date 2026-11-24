"use client";
// Jumlah permintaan edit penjualan yang menunggu approval admin.
// Dipakai oleh lonceng di Sidebar & Navbar.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Event browser agar lonceng langsung diperbarui
// setelah admin menyetujui/menolak permintaan edit.
export const APPROVAL_EDIT_CHANGED_EVENT = "approval-edit:changed";

export function notifyApprovalEditChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(APPROVAL_EDIT_CHANGED_EVENT));
  }
}

/**
 * Ambil jumlah PENDING (hanya jika enabled, mis. user ADMIN).
 * Diperbarui: tiap 30 detik, saat pindah halaman, saat tab fokus,
 * dan saat event APPROVAL_EDIT_CHANGED_EVENT dikirim.
 */
export function useApprovalEditCount(enabled: boolean): number {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/permintaan-edit-penjualan/count", {
          cache: "no-store",
        });
        const data = await res.json();
        if (active && data.success) setCount(data.pending || 0);
      } catch {
        // abaikan; dicoba lagi di interval berikutnya
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    window.addEventListener(APPROVAL_EDIT_CHANGED_EVENT, fetchCount);
    window.addEventListener("focus", fetchCount);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener(APPROVAL_EDIT_CHANGED_EVENT, fetchCount);
      window.removeEventListener("focus", fetchCount);
    };
  }, [enabled, pathname]);

  return enabled ? count : 0;
}
