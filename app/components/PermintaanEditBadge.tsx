"use client";
// Badge status permintaan edit penjualan (riwayat kasir)
import React from "react";
import { Check, Clock, X } from "lucide-react";

export interface PermintaanEditInfo {
  id: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  alasan: string;
  catatanAdmin: string | null;
  createdAt: string;
  diprosesAt: string | null;
}

/** Permintaan edit terakhir dari data list (`permintaanEdit` take: 1) */
export const getPermintaanEdit = (pj: {
  permintaanEdit?: PermintaanEditInfo[];
}): PermintaanEditInfo | null => pj.permintaanEdit?.[0] ?? null;

export function PermintaanEditBadge({
  permintaan,
}: {
  permintaan: PermintaanEditInfo | null;
}) {
  if (!permintaan) return null;

  if (permintaan.status === "PENDING") {
    return (
      <span className="mt-1 flex w-fit items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-700">
        <Clock className="w-3 h-3" />
        Menunggu approval
      </span>
    );
  }

  if (permintaan.status === "APPROVED") {
    return (
      <span className="mt-1 flex w-fit items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-700">
        <Check className="w-3 h-3" />
        Edit disetujui
      </span>
    );
  }

  return (
    <div
      className="mt-1"
      title={`Alasan ditolak: ${permintaan.catatanAdmin || "-"}`}
    >
      <span className="flex w-fit items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-700">
        <X className="w-3 h-3" />
        Edit ditolak
      </span>
      {permintaan.catatanAdmin && (
        <p className="mt-0.5 max-w-[180px] truncate text-[11px] text-red-600">
          {permintaan.catatanAdmin}
        </p>
      )}
    </div>
  );
}

/** Tombol batal untuk permintaan yang masih PENDING */
export function BatalPermintaanButton({
  permintaanId,
  onDone,
}: {
  permintaanId: number;
  onDone: (ok: boolean, message: string) => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/permintaan-edit-penjualan/${permintaanId}/batal`,
        { method: "POST" },
      );
      const data = await res.json();
      onDone(
        !!data.success,
        data.success
          ? "Permintaan edit dibatalkan"
          : data.error || "Gagal membatalkan permintaan",
      );
    } catch {
      onDone(false, "Gagal membatalkan permintaan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="px-2 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-all text-xs font-semibold disabled:opacity-50"
      title="Batalkan permintaan edit"
    >
      {loading ? "..." : "Batal Edit"}
    </button>
  );
}
