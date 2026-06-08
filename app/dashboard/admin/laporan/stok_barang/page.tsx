"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Calendar,
  ChevronDown,
  Download,
  Loader2,
  Package,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingUp,
  Warehouse,
  X,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Supplier {
  id: number;
  namaSupplier: string;
}

interface StokPeriodeItem {
  barangId: number;
  namaBarang: string;
  namaSupplier: string;
  satuanKemasan: string;
  jumlahPerKemasan: number;
  hargaBeli: number;
  hargaJual: number;
  totalTerjual: number;
  terjualKemasan: number;
  terjualPcs: number;
  stokAkhir: number;
  stokAkhirKemasan: number;
  stokAkhirPcs: number;
  nilaiTerjual: number;
  modalTerjual: number;
  labaKotor: number;
}

interface Summary {
  jumlahBarang: number;
  totalTerjual: number;
  totalNilaiTerjual: number;
  totalModalTerjual: number;
  totalLabaKotor: number;
  totalStokAkhir: number;
}

const initialSummary: Summary = {
  jumlahBarang: 0,
  totalTerjual: 0,
  totalNilaiTerjual: 0,
  totalModalTerjual: 0,
  totalLabaKotor: 0,
  totalStokAkhir: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: format tanggal untuk input[type=date]  (YYYY-MM-DD)
// ─────────────────────────────────────────────────────────────────────────────
function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toDisplayDate(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Supplier multi-select portal (sama seperti LaporanStokBarangPage)
// ─────────────────────────────────────────────────────────────────────────────
interface SupplierDropdownPortalProps {
  open: boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  supplierList: Supplier[];
  selectedSupplierIds: number[];
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onClose: () => void;
}

const SupplierDropdownPortal: React.FC<SupplierDropdownPortalProps> = ({
  open,
  triggerRef,
  supplierList,
  selectedSupplierIds,
  onToggle,
  onSelectAll,
  onClose,
}) => {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (open && triggerRef.current != null) {
      setRect(triggerRef.current.getBoundingClientRect());
    }
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (triggerRef.current != null)
        setRect(triggerRef.current.getBoundingClientRect());
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, triggerRef]);

  if (!open || !rect) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: "absolute",
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
        zIndex: 9999,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Pilih Supplier
          </span>
          {selectedSupplierIds.length > 0 && (
            <button
              type="button"
              onClick={onSelectAll}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
        <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 transition-colors">
          <input
            type="checkbox"
            checked={selectedSupplierIds.length === 0}
            onChange={onSelectAll}
            className="w-4 h-4 rounded accent-blue-600"
          />
          <span className="text-sm font-semibold text-gray-700">
            Semua Supplier
          </span>
        </label>
        <div className="max-h-52 overflow-y-auto">
          {supplierList.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedSupplierIds.includes(s.id)}
                onChange={() => onToggle(s.id)}
                className="w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-sm text-gray-800">{s.namaSupplier}</span>
            </label>
          ))}
        </div>
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md font-medium transition-colors"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
const LaporanStokPeriodePage = () => {
  // Default range: bulan ini
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [dataList, setDataList] = useState<StokPeriodeItem[]>([]);
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState(toInputDate(firstOfMonth));
  const [endDate, setEndDate] = useState(toInputDate(today));
  const [loading, setLoading] = useState(false);
  const [supplierLoading, setSupplierLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setSupplierDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  useEffect(() => {
    fetchSupplier();
  }, []);

  const selectedSupplierName = useMemo(() => {
    if (selectedSupplierIds.length === 0) return "Semua Supplier";
    if (selectedSupplierIds.length === 1)
      return (
        supplierList.find((s) => s.id === selectedSupplierIds[0])
          ?.namaSupplier || "1 Supplier"
      );
    return `${selectedSupplierIds.length} Supplier dipilih`;
  }, [selectedSupplierIds, supplierList]);

  const fetchSupplier = async () => {
    setSupplierLoading(true);
    try {
      const res = await fetch("/api/supplier");
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error || "Gagal mengambil data supplier");
      setSupplierList(data.data);
    } catch {
      toast.error("Gagal mengambil data supplier");
    } finally {
      setSupplierLoading(false);
    }
  };

  const fetchData = async () => {
    if (!startDate || !endDate) {
      toast.error("Tanggal mulai dan selesai harus diisi");
      return;
    }
    if (startDate > endDate) {
      toast.error("Tanggal mulai tidak boleh lebih besar dari tanggal selesai");
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("startDate", startDate);
      params.append("endDate", endDate);
      if (selectedSupplierIds.length > 0)
        params.append("supplierIds", selectedSupplierIds.join(","));
      if (searchTerm.trim()) params.append("search", searchTerm.trim());

      const res = await fetch(`/api/laporan/stok_periode?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Gagal mengambil data");

      setDataList(json.data);
      setSummary(json.summary || initialSummary);
      setHasFetched(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengambil data");
      setDataList([]);
      setSummary(initialSummary);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleClearFilters = () => {
    setSelectedSupplierIds([]);
    setSupplierDropdownOpen(false);
    setSearchTerm("");
    setStartDate(toInputDate(firstOfMonth));
    setEndDate(toInputDate(today));
    setDataList([]);
    setSummary(initialSummary);
    setHasFetched(false);
  };

  const toggleSupplier = (id: number) =>
    setSelectedSupplierIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleExportExcel = async () => {
    if (!hasFetched || dataList.length === 0) {
      toast.error("Tampilkan data terlebih dahulu sebelum export");
      return;
    }
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.append("startDate", startDate);
      params.append("endDate", endDate);
      if (selectedSupplierIds.length > 0)
        params.append("supplierIds", selectedSupplierIds.join(","));
      if (searchTerm.trim()) params.append("search", searchTerm.trim());

      const res = await fetch(
        `/api/laporan/stok_periode/export?${params.toString()}`,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Gagal generate laporan Excel");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="([^"]+)"/);
      link.download =
        match?.[1] ?? `Laporan-Stok-Periode-${startDate}-sd-${endDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Laporan Excel berhasil didownload");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal export Excel");
    } finally {
      setExporting(false);
    }
  };

  const formatRupiah = (v: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(v || 0);

  const formatNumber = (v: number) =>
    new Intl.NumberFormat("id-ID").format(v || 0);

  const marginPct =
    summary.totalNilaiTerjual > 0
      ? ((summary.totalLabaKotor / summary.totalNilaiTerjual) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="w-full max-w-7xl mx-auto pb-20">
      <Toaster position="top-right" />

      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 text-indigo-50 rounded-full px-3 py-1 text-sm font-medium mb-3">
              <Warehouse className="w-4 h-4" />
              Laporan Gudang
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Laporan Stok Per Periode
            </h1>
            <p className="text-indigo-100">
              Lihat stok awal estimasi, jumlah terjual, dan stok akhir dalam
              rentang tanggal tertentu.
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="bg-white/15 hover:bg-white/25 disabled:opacity-60 text-white border border-white/25 px-5 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      {hasFetched && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-5 shadow-md border-l-4 border-indigo-500">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Jenis Barang</p>
                <p className="font-bold text-xl text-gray-900">
                  {formatNumber(summary.jumlahBarang)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-5 shadow-md border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Terjual</p>
                <p className="font-bold text-xl text-gray-900">
                  {formatNumber(summary.totalTerjual)} pcs
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-5 shadow-md border-l-4 border-purple-500">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Nilai Terjual</p>
                <p className="font-bold text-base text-gray-900">
                  {formatRupiah(summary.totalNilaiTerjual)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-5 shadow-md border-l-4 border-emerald-500">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Laba Kotor</p>
                <p className="font-bold text-base text-gray-900">
                  {formatRupiah(summary.totalLabaKotor)}
                </p>
                <p className="text-xs text-emerald-600 font-medium">
                  Margin {marginPct}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Filter Card ── */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-6">
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-5 border-b border-gray-200 rounded-t-xl">
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            Filter Laporan
          </h2>
          <p className="text-sm text-gray-600">
            {hasFetched
              ? `${toDisplayDate(startDate)} s/d ${toDisplayDate(endDate)} • ${selectedSupplierName} • ${formatNumber(summary.jumlahBarang)} barang`
              : "Pilih periode dan klik Tampilkan"}
          </p>
        </div>

        <div className="p-6">
          <form onSubmit={handleSearch} className="space-y-4">
            {/* Baris 1: Tanggal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-2">
                  Tanggal Mulai
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-2">
                  Tanggal Selesai
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Baris 2: Supplier + Search + Tombol */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_auto_auto] gap-4 items-end">
              {/* Supplier multi-select */}
              <div ref={wrapperRef}>
                <label className="block text-xs text-gray-500 mb-2">
                  Supplier
                </label>
                <button
                  ref={triggerRef}
                  type="button"
                  onClick={() => setSupplierDropdownOpen((v) => !v)}
                  disabled={supplierLoading}
                  className="w-full flex items-center gap-2 pl-11 pr-4 py-3 border border-gray-300 rounded-lg bg-white text-left disabled:opacity-60 transition-all hover:border-indigo-400 focus:ring-2 focus:ring-indigo-400 focus:outline-none relative"
                >
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                  <span
                    className={`flex-1 truncate text-sm ${selectedSupplierIds.length === 0 ? "text-gray-400" : "text-gray-900 font-medium"}`}
                  >
                    {supplierLoading ? "Memuat..." : selectedSupplierName}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectedSupplierIds.length > 0 && (
                      <span className="bg-indigo-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {selectedSupplierIds.length}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${supplierDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>

                <SupplierDropdownPortal
                  open={supplierDropdownOpen}
                  triggerRef={triggerRef}
                  supplierList={supplierList}
                  selectedSupplierIds={selectedSupplierIds}
                  onToggle={toggleSupplier}
                  onSelectAll={() => setSelectedSupplierIds([])}
                  onClose={() => setSupplierDropdownOpen(false)}
                />

                {selectedSupplierIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedSupplierIds.map((id) => {
                      const s = supplierList.find((x) => x.id === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full"
                        >
                          {s?.namaSupplier || id}
                          <button
                            type="button"
                            onClick={() => toggleSupplier(id)}
                            className="hover:text-indigo-900 ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Search */}
              <div>
                <label className="block text-xs text-gray-500 mb-2">
                  Cari Barang atau Supplier
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Nama barang atau supplier"
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Tampilkan */}
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
                Tampilkan
              </button>

              {/* Reset */}
              <button
                type="button"
                onClick={handleClearFilters}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap"
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Tabel ── */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Data Stok Per Periode
            </h2>
            {hasFetched && (
              <p className="text-sm text-gray-600 mt-1">
                {toDisplayDate(startDate)} s/d {toDisplayDate(endDate)}{" "}
                &nbsp;•&nbsp; {formatNumber(dataList.length)} barang
              </p>
            )}
          </div>
          <button
            onClick={handleExportExcel}
            disabled={
              exporting || loading || !hasFetched || dataList.length === 0
            }
            className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:from-gray-400 disabled:to-gray-500 text-white px-5 py-3 rounded-lg font-semibold transition-all shadow-md flex items-center justify-center gap-2"
          >
            {exporting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            Export Excel
          </button>
        </div>

        {/* State: belum pernah fetch */}
        {!hasFetched && !loading && (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400">
            <Calendar className="w-14 h-14 text-gray-200 mb-4" />
            <p className="font-semibold text-gray-600 text-lg">
              Pilih periode terlebih dahulu
            </p>
            <p className="text-sm mt-1">
              Atur tanggal dan klik tombol <strong>Tampilkan</strong>
            </p>
          </div>
        )}

        {/* State: loading */}
        {loading && (
          <div className="py-16 flex flex-col items-center justify-center text-gray-500">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-3" />
            <p className="font-medium">Mengambil data...</p>
          </div>
        )}

        {/* State: data kosong */}
        {hasFetched && !loading && dataList.length === 0 && (
          <div className="py-16 flex flex-col items-center justify-center text-gray-500">
            <AlertTriangle className="w-12 h-12 text-gray-300 mb-3" />
            <p className="font-semibold text-gray-700">Data tidak ditemukan</p>
            <p className="text-sm mt-1">
              Coba ubah filter atau rentang tanggal.
            </p>
          </div>
        )}

        {/* State: ada data */}
        {hasFetched && !loading && dataList.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {/* Baris grup header */}
                <tr className="border-b border-gray-200">
                  <th
                    rowSpan={2}
                    className="px-4 py-3 bg-gray-700 text-white text-xs font-semibold text-center w-10"
                  >
                    No
                  </th>
                  <th
                    rowSpan={2}
                    className="px-4 py-3 bg-gray-700 text-white text-xs font-semibold text-left"
                  >
                    Nama Barang
                  </th>
                  <th
                    rowSpan={2}
                    className="px-4 py-3 bg-gray-700 text-white text-xs font-semibold text-left"
                  >
                    Supplier
                  </th>
                  <th
                    rowSpan={2}
                    className="px-4 py-3 bg-gray-700 text-white text-xs font-semibold text-center"
                  >
                    Kemasan
                  </th>
                  <th
                    colSpan={3}
                    className="px-4 py-2 bg-blue-700 text-white text-xs font-semibold text-center border-x border-blue-600"
                  >
                    Terjual ({toDisplayDate(startDate)} s/d{" "}
                    {toDisplayDate(endDate)})
                  </th>
                  <th
                    colSpan={3}
                    className="px-4 py-2 bg-purple-700 text-white text-xs font-semibold text-center border-x border-purple-600"
                  >
                    Stok Akhir (Sekarang)
                  </th>
                  <th
                    colSpan={3}
                    className="px-4 py-2 bg-red-800 text-white text-xs font-semibold text-center border-x border-red-700"
                  >
                    Nilai Periode
                  </th>
                </tr>
                {/* Baris sub-header */}
                <tr className="border-b-2 border-gray-300">
                  {/* Terjual */}
                  <th className="px-3 py-2 bg-blue-600 text-white text-xs font-medium text-right">
                    Kmsan
                  </th>
                  <th className="px-3 py-2 bg-blue-600 text-white text-xs font-medium text-right">
                    PCS
                  </th>
                  <th className="px-3 py-2 bg-blue-600 text-white text-xs font-medium text-right border-r border-blue-500">
                    Total
                  </th>
                  {/* Stok Akhir */}
                  <th className="px-3 py-2 bg-purple-600 text-white text-xs font-medium text-right">
                    Kmsan
                  </th>
                  <th className="px-3 py-2 bg-purple-600 text-white text-xs font-medium text-right">
                    PCS
                  </th>
                  <th className="px-3 py-2 bg-purple-600 text-white text-xs font-medium text-right border-r border-purple-500">
                    Total
                  </th>
                  {/* Nilai */}
                  <th className="px-3 py-2 bg-red-700 text-white text-xs font-medium text-right">
                    Nilai Jual
                  </th>
                  <th className="px-3 py-2 bg-red-700 text-white text-xs font-medium text-right">
                    Modal
                  </th>
                  <th className="px-3 py-2 bg-red-700 text-white text-xs font-medium text-right">
                    Laba
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dataList.map((item, idx) => (
                  <tr
                    key={item.barangId}
                    className="hover:bg-indigo-50/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-center text-gray-500">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">
                        {item.namaBarang}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.jumlahPerKemasan} pcs/{item.satuanKemasan}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {item.namaSupplier}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {item.jumlahPerKemasan} pcs/{item.satuanKemasan}
                    </td>

                    {/* Terjual */}
                    <td className="px-3 py-3 text-right text-blue-800 bg-blue-50/60">
                      {formatNumber(item.terjualKemasan)}
                    </td>
                    <td className="px-3 py-3 text-right text-blue-800 bg-blue-50/60 text-xs">
                      {formatNumber(item.terjualPcs)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right font-semibold bg-blue-50/60 border-r border-blue-100 ${item.totalTerjual === 0 ? "text-gray-300" : "text-blue-800"}`}
                    >
                      {formatNumber(item.totalTerjual)}
                    </td>

                    {/* Stok Akhir */}
                    <td className="px-3 py-3 text-right text-purple-800 bg-purple-50/60">
                      {formatNumber(item.stokAkhirKemasan)}
                    </td>
                    <td className="px-3 py-3 text-right text-purple-800 bg-purple-50/60 text-xs">
                      {formatNumber(item.stokAkhirPcs)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-purple-800 bg-purple-50/60 border-r border-purple-100">
                      {formatNumber(item.stokAkhir)}
                    </td>

                    {/* Nilai */}
                    <td className="px-3 py-3 text-right text-gray-700">
                      {formatRupiah(item.nilaiTerjual)}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-500 text-xs">
                      {formatRupiah(item.modalTerjual)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right font-bold ${item.labaKotor >= 0 ? "text-emerald-600" : "text-red-500"}`}
                    >
                      {formatRupiah(item.labaKotor)}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Footer total */}
              <tfoot>
                <tr className="bg-indigo-700 text-white">
                  <td colSpan={4} className="px-4 py-3 font-bold text-sm">
                    TOTAL
                  </td>
                  <td colSpan={2} className="px-3 py-3 text-right font-bold">
                    {" "}
                  </td>
                  <td className="px-3 py-3 text-right font-bold border-r border-indigo-500">
                    {formatNumber(summary.totalTerjual)}
                  </td>
                  <td
                    colSpan={3}
                    className="px-3 py-3 text-right font-bold border-r border-indigo-500"
                  >
                    {" "}
                  </td>
                  <td className="px-3 py-3 text-right font-bold">
                    {formatRupiah(summary.totalNilaiTerjual)}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-indigo-200">
                    {formatRupiah(summary.totalModalTerjual)}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-emerald-300">
                    {formatRupiah(summary.totalLabaKotor)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LaporanStokPeriodePage;
