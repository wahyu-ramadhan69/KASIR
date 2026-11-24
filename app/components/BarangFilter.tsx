"use client";
// Filter "nama barang" untuk halaman riwayat penjualan.
// - <BarangFilterPicker>: input + dropdown hasil cari (/api/barang/search)
// - <BarangFilterBanner>: ringkasan total barang terjual
// - formatQty / getQtyBarang: helper jumlah dus & item
import React, { useEffect, useRef, useState } from "react";
import { Loader2, Package, X } from "lucide-react";

export interface BarangOption {
  id: number;
  namaBarang: string;
  jenisKemasan?: string;
  jumlahPerKemasan: number;
}

export interface BarangSummary {
  barangId: number;
  namaBarang: string;
  jenisKemasan: string;
  jumlahPerKemasan: number;
  totalItem: number;
  jumlahKemasan: number;
  sisaPcs: number;
  jumlahBaris: number;
}

/** Format jumlah: "3 dus & 5 item" berdasarkan isi per kemasan */
export const formatQty = (
  totalItem: number,
  jumlahPerKemasan: number,
  labelKemasan: string = "dus",
): string => {
  const perKemasan = Math.max(1, jumlahPerKemasan || 1);
  if (perKemasan <= 1) return `${totalItem} item`;
  const kemasan = Math.floor(totalItem / perKemasan);
  const sisa = totalItem % perKemasan;
  if (kemasan > 0 && sisa > 0)
    return `${kemasan} ${labelKemasan} & ${sisa} item`;
  if (kemasan > 0) return `${kemasan} ${labelKemasan}`;
  return `${sisa} item`;
};

type ItemLike = {
  barangId: number;
  totalItem?: number;
  jumlahDus?: number;
  jumlahPcs?: number;
  barang?: { jumlahPerKemasan?: number } | null;
};

/** Jumlah (dalam item) barang `barangId` di dalam satu transaksi */
export const getQtyBarang = (
  items: ItemLike[] | undefined,
  barangId: number,
): number =>
  (items || [])
    .filter((item) => item.barangId === barangId)
    .reduce((sum, item) => {
      const perKemasan = item.barang?.jumlahPerKemasan || 1;
      const total =
        item.totalItem ??
        (item.jumlahDus || 0) * perKemasan + (item.jumlahPcs || 0);
      return sum + Number(total || 0);
    }, 0);

export function BarangFilterPicker({
  value,
  onChange,
  className = "",
}: {
  value: BarangOption | null;
  onChange: (barang: BarangOption | null) => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BarangOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Cari barang via API (debounce)
  useEffect(() => {
    const keyword = query.trim();
    if (keyword.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/barang/search/${encodeURIComponent(keyword)}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        setResults(
          data.success ? (data.data as BarangOption[]).slice(0, 20) : [],
        );
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          console.error("Error searching barang:", error);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const select = (barang: BarangOption) => {
    onChange({
      id: barang.id,
      namaBarang: barang.namaBarang,
      jenisKemasan: barang.jenisKemasan,
      jumlahPerKemasan: Number(barang.jumlahPerKemasan || 1),
    });
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {value ? (
        <div className="flex items-center gap-2 pl-3 pr-2 py-2.5 border-2 border-amber-300 bg-amber-50 rounded-xl h-full">
          <Package className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span
            className="text-sm font-semibold text-amber-800 truncate flex-1"
            title={value.namaBarang}
          >
            {value.namaBarang}
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="p-1 rounded-lg text-amber-700 hover:bg-amber-100 transition-colors"
            title="Hapus filter barang"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter nama barang..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="w-full pl-9 pr-9 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none text-sm bg-white"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
          )}
          {open && query.trim().length >= 2 && (
            <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-72 overflow-y-auto">
              {!searching && results.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">
                  Barang tidak ditemukan
                </p>
              ) : (
                results.map((barang) => (
                  <button
                    key={barang.id}
                    type="button"
                    onClick={() => select(barang)}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {barang.namaBarang}
                    </p>
                    <p className="text-xs text-gray-500">
                      {Number(barang.jumlahPerKemasan) > 1
                        ? `${barang.jumlahPerKemasan} item / ${barang.jenisKemasan || "dus"}`
                        : "Satuan"}
                    </p>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function BarangFilterBanner({
  barang,
  summary,
  totalTransaksi,
}: {
  barang: BarangOption;
  summary: BarangSummary | null;
  totalTransaksi: number;
}) {
  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 sm:p-5 mb-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 p-2.5 rounded-xl shadow">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">
              Filter Barang
            </p>
            <p className="text-base font-bold text-gray-900">
              {barang.namaBarang}
            </p>
            <p className="text-xs text-gray-600">
              Ditemukan di {totalTransaksi} transaksi
            </p>
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">
            Total Dibeli
          </p>
          <p className="text-xl font-bold text-amber-700">
            {summary
              ? formatQty(
                  summary.totalItem,
                  summary.jumlahPerKemasan,
                  summary.jenisKemasan,
                )
              : "..."}
          </p>
          {summary && summary.jumlahPerKemasan > 1 && (
            <p className="text-xs text-gray-600">
              = {summary.totalItem.toLocaleString("id-ID")} item
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
