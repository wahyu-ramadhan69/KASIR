"use client";
import React, { useState, useEffect } from "react";
import {
  Search,
  Package,
  RefreshCw,
  X,
  Box,
  AlertCircle,
  Eye,
  Filter,
  Calendar,
  Activity,
  SquareArrowOutUpRight,
  SquareArrowOutDownRight,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  ClipboardList,
} from "lucide-react";

import { Toaster } from "react-hot-toast";
import Link from "next/link";

interface Barang {
  id: number;
  namaBarang: string;
  hargaBeli: number;
  hargaJual: number;
  stok: number;
  jenisKemasan: string;
  jumlahPerKemasan: number;
  berat: number;
  limitPenjualan: number;
  createdAt: string;
  updatedAt: string;
}

interface StokHarianPerhitungan {
  barangId: number;
  namaBarang: string;
  jenisKemasan: string;
  jumlahPerKemasan: number;
  totalTerjualPcs: number; // ⭐ Baru: hasil perhitungan
  totalTerjualKemasan: number; // ⭐ Baru: hasil perhitungan
  totalMasukPcs: number; // ⭐ Baru: hasil perhitungan
  totalMasukKemasan: number; // ⭐ Baru: hasil perhitungan
  stokPadaTanggalPcs: number;
  stokPadaTanggalKemasan: number;
  masukSetelahTanggal: number; // ⭐ Asli dari API
  keluarSetelahTanggal: number; // ⭐ Asli dari API
}

type ViewMode = "barang" | "stok-harian";

const getTodayWib = () => {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return wib.toISOString().split("T")[0];
};

const DataBarangPage = () => {
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");
  const [filterStok, setFilterStok] = useState<
    "all" | "low" | "medium" | "high"
  >("all");
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedBarang, setSelectedBarang] = useState<Barang | null>(null);

  // View toggle
  const [viewMode, setViewMode] = useState<ViewMode>("barang");

  // Stok harian state
  const [stokHarianDate, setStokHarianDate] = useState<string>(getTodayWib());
  const [stokHarianData, setStokHarianData] = useState<StokHarianPerhitungan[]>(
    [],
  );
  const [loadingStokHarian, setLoadingStokHarian] = useState<boolean>(false);
  const [stokHarianSearch, setStokHarianSearch] = useState<string>("");

  const addDays = (dateStr: string, delta: number) => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + delta);
    return d.toISOString().split("T")[0];
  };

  const toNumber = (value: any) => {
    if (typeof value === "bigint") return Number(value);
    if (typeof value === "string") return Number(value);
    return Number(value || 0);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchBarang();
  }, []);

  useEffect(() => {
    if (viewMode === "stok-harian") {
      fetchStokHarian();
    }
  }, [viewMode, stokHarianDate]);

  const fetchBarang = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/barang");
      const data = await res.json();
      if (data.success) setBarangList(data.data);
    } catch (error) {
      console.error("Error fetching barang:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStokHarian = async () => {
    setLoadingStokHarian(true);
    try {
      const fetchHistoris = async (date: string) => {
        const response = await fetch(
          `/api/stok-harian/historis?tanggal=${date}`,
        );
        const result = await response.json();
        if (!result.success || !Array.isArray(result.data)) {
          return [];
        }
        return result.data as any[];
      };

      const mapById = (rows: any[]) => {
        const map = new Map<number, any>();
        rows.forEach((row) => map.set(row.barangId, row));
        return map;
      };

      // ⭐ Ambil tanggal SEBELUMNYA (sama seperti kode atas)
      const prevDateStr = addDays(stokHarianDate, -1);

      // ⭐ Fetch DUA kali: tanggal sebelumnya DAN tanggal target
      const [prevRows, endRows] = await Promise.all([
        fetchHistoris(prevDateStr),
        fetchHistoris(stokHarianDate),
      ]);

      const prevMap = mapById(prevRows);

      // ⭐ Hitung selisih seperti kode atas
      const result: StokHarianPerhitungan[] = [];
      endRows.forEach((row: any) => {
        const barangId = row.barangId;
        const prevRow = prevMap.get(barangId);
        const jumlahPerKemasan = Number(row.jumlahPerKemasan || 1);

        const masukSetelahEnd = toNumber(row.masukSetelahTanggal);
        const keluarSetelahEnd = toNumber(row.keluarSetelahTanggal);
        const masukSetelahPrev = prevRow
          ? toNumber(prevRow.masukSetelahTanggal)
          : masukSetelahEnd;
        const keluarSetelahPrev = prevRow
          ? toNumber(prevRow.keluarSetelahTanggal)
          : keluarSetelahEnd;

        // ⭐ Hitung selisih (sama seperti kode atas)
        const totalMasukPcs = Math.max(0, masukSetelahPrev - masukSetelahEnd);
        const totalTerjualPcs = Math.max(
          0,
          keluarSetelahPrev - keluarSetelahEnd,
        );

        result.push({
          barangId,
          namaBarang: row.namaBarang || "-",
          jenisKemasan: row.jenisKemasan || "-",
          jumlahPerKemasan,
          totalTerjualPcs,
          totalTerjualKemasan: jumlahPerKemasan
            ? totalTerjualPcs / jumlahPerKemasan
            : 0,
          totalMasukPcs,
          totalMasukKemasan: jumlahPerKemasan
            ? totalMasukPcs / jumlahPerKemasan
            : 0,
          stokPadaTanggalPcs: toNumber(row.stokPadaTanggal),
          stokPadaTanggalKemasan: jumlahPerKemasan
            ? toNumber(row.stokPadaTanggal) / jumlahPerKemasan
            : 0,
          // ⭐ Simpan data asli juga untuk referensi
          masukSetelahTanggal: masukSetelahEnd,
          keluarSetelahTanggal: keluarSetelahEnd,
        });
      });

      // ⭐ Sorting sama seperti kode atas
      result.sort((a, b) => {
        if (b.totalMasukPcs !== a.totalMasukPcs) {
          return b.totalMasukPcs - a.totalMasukPcs;
        }
        return b.totalTerjualPcs - a.totalTerjualPcs;
      });

      setStokHarianData(result);
    } catch (error) {
      console.error("Error fetching stok harian:", error);
      setStokHarianData([]);
    } finally {
      setLoadingStokHarian(false);
    }
  };

  const navigateDate = (delta: number) => {
    const d = new Date(stokHarianDate);
    d.setDate(d.getDate() + delta);
    setStokHarianDate(d.toISOString().split("T")[0]);
  };

  const isToday = (dateStr: string) => dateStr === getTodayWib();

  const formatGramsToKg = (grams: number): string => {
    if (!Number.isFinite(grams)) return "";
    const kg = grams / 1000;
    return kg
      .toFixed(3)
      .replace(/\.?0+$/, "")
      .replace(".", ",");
  };

  const formatNumber = (val: string | number) =>
    new Intl.NumberFormat("id-ID").format(Number(val));

  const formatDecimal = (val: number) => {
    if (Number.isInteger(val)) return formatNumber(val);
    return new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const formatDate = (dateString: string): string => {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(dateString));
  };

  const formatDateLong = (dateStr: string) =>
    new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(dateStr));

  const getStokStatus = (stok: number, jumlahPerKemasan: number) => {
    if (stok / jumlahPerKemasan < 10)
      return { color: "bg-red-100 text-red-800", badgeColor: "bg-red-500" };
    if (stok / jumlahPerKemasan < 20)
      return {
        color: "bg-yellow-100 text-yellow-800",
        badgeColor: "bg-yellow-500",
      };
    return { color: "bg-green-100 text-green-800", badgeColor: "bg-green-500" };
  };

  const filteredBarang = barangList.filter((item) => {
    const matchSearch = item.namaBarang
      .toLowerCase()
      .includes(debouncedSearchTerm.toLowerCase());
    let matchStok = true;
    if (filterStok === "low")
      matchStok = item.stok / item.jumlahPerKemasan < 50;
    if (filterStok === "medium")
      matchStok = item.stok / item.jumlahPerKemasan >= 50 && item.stok < 100;
    if (filterStok === "high")
      matchStok = item.stok / item.jumlahPerKemasan >= 100;
    return matchSearch && matchStok;
  });

  const filteredStokHarian = stokHarianData.filter((item) =>
    item.namaBarang.toLowerCase().includes(stokHarianSearch.toLowerCase()),
  );

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="w-full px-6 pb-8">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { background: "#333", color: "#fff" },
            success: { style: { background: "#22c55e" } },
            error: { style: { background: "#ef4444" } },
          }}
        />

        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-8 mb-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
                <Package className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                  Data Barang
                </h1>
                <p className="text-blue-100 text-lg">
                  Kelola dan pantau inventori barang Anda
                </p>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap justify-end">
              <Link
                href="/dashboard/kepala_gudang/barang_keluar"
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 bg-white/10 text-white hover:bg-white/20 shadow-lg"
              >
                <SquareArrowOutUpRight className="w-4 h-4" />
                Barang Keluar
              </Link>
              <Link
                href="/dashboard/kepala_gudang/barang_masuk"
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 bg-white/10 text-white hover:bg-white/20 shadow-lg"
              >
                <SquareArrowOutDownRight className="w-4 h-4" />
                Barang Masuk
              </Link>
              <button
                onClick={fetchBarang}
                disabled={loading}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg"
              >
                <RefreshCw
                  className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Total Barang
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {barangList.length}
                </p>
                <p className="text-xs text-gray-400 mt-2">Item terdaftar</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <Package className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Total Stok
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {barangList.reduce((acc, item) => acc + item.stok, 0)}
                </p>
                <p className="text-xs text-gray-400 mt-2">Unit tersedia</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <Box className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* FILTER BAR — berubah tergantung viewMode                      */}
        {/* ============================================================ */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4">
            {viewMode === "barang" ? (
              <>
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Cari nama barang..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Right controls */}
                <div className="flex gap-3">
                  {/* Tombol Stok Harian */}
                  <button
                    onClick={() => setViewMode("stok-harian")}
                    className="px-4 py-3 border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl flex items-center gap-2 transition-all font-semibold"
                  >
                    <ClipboardList className="w-5 h-5" />
                    <span className="hidden sm:inline">Stok Harian</span>
                  </button>

                  <select
                    value={filterStok}
                    onChange={(e) => setFilterStok(e.target.value as any)}
                    className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all bg-white"
                  >
                    <option value="all">Semua Stok</option>
                    <option value="low">Stok Rendah</option>
                    <option value="medium">Stok Sedang</option>
                    <option value="high">Stok Aman</option>
                  </select>

                  <button className="px-4 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2">
                    <Filter className="w-5 h-5 text-gray-600" />
                    <span className="hidden lg:inline text-gray-700 font-medium">
                      Filter
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Search stok harian */}
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Cari nama barang..."
                    value={stokHarianSearch}
                    onChange={(e) => setStokHarianSearch(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                  />
                  {stokHarianSearch && (
                    <button
                      onClick={() => setStokHarianSearch("")}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Date navigator */}
                <div className="flex items-center gap-2">
                  {/* Tombol kembali ke tabel barang */}
                  <button
                    onClick={() => setViewMode("barang")}
                    className="px-4 py-3 border-2 border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl flex items-center gap-2 transition-all font-semibold"
                  >
                    <Package className="w-5 h-5" />
                    <span className="hidden sm:inline">Data Barang</span>
                  </button>

                  {/* Navigasi tanggal */}
                  <div className="flex items-center gap-1 border-2 border-blue-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => navigateDate(-1)}
                      className="px-3 py-3 hover:bg-blue-50 text-blue-600 transition-all border-r border-blue-200"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2 px-3">
                      <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <input
                        type="date"
                        value={stokHarianDate}
                        onChange={(e) => setStokHarianDate(e.target.value)}
                        className="py-2 text-sm font-semibold text-blue-700 outline-none cursor-pointer bg-transparent"
                      />
                    </div>

                    <button
                      onClick={() => navigateDate(1)}
                      disabled={isToday(stokHarianDate)}
                      className="px-3 py-3 hover:bg-blue-50 text-blue-600 transition-all border-l border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {isToday(stokHarianDate) && (
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-green-200">
                      Hari Ini
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Info strip */}
          {viewMode === "barang" && debouncedSearchTerm && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-4 py-2 rounded-lg">
              <Search className="w-4 h-4 text-blue-600" />
              <span>
                Hasil pencarian:{" "}
                <span className="font-semibold text-blue-700">
                  "{debouncedSearchTerm}"
                </span>
              </span>
            </div>
          )}

          {viewMode === "stok-harian" && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-4 py-2 rounded-lg">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>
                Menampilkan stok harian:{" "}
                <span className="font-semibold text-blue-700">
                  {formatDateLong(stokHarianDate)}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* TABEL — berubah tergantung viewMode                           */}
        {/* ============================================================ */}

        {viewMode === "barang" ? (
          <>
            {loading ? (
              <div className="flex justify-center items-center py-32">
                <div className="text-center">
                  <div className="relative">
                    <div className="w-24 h-24 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                    <Package className="w-10 h-10 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-gray-500 mt-6 text-lg font-medium">
                    Memuat data barang...
                  </p>
                </div>
              </div>
            ) : filteredBarang.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-16 text-center">
                <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Package className="w-12 h-12 text-gray-400" />
                </div>
                <p className="text-gray-500 text-lg font-medium">
                  {debouncedSearchTerm
                    ? `Tidak ada barang ditemukan untuk "${debouncedSearchTerm}"`
                    : "Tidak ada data barang"}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-blue-600 to-indigo-700">
                        <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                          No
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Nama Barang
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                          Stok
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                          Berat (KG)
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                          Kemasan
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider sticky right-0 bg-gradient-to-r from-blue-600 to-indigo-700">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredBarang.map((item, index) => {
                        const stokStatus = getStokStatus(
                          item.stok,
                          item.jumlahPerKemasan,
                        );
                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-blue-50 transition-colors group"
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {index + 1}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="bg-blue-100 p-2 rounded-lg group-hover:bg-blue-200 transition-colors">
                                  <Package className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-gray-900">
                                    {item.namaBarang}
                                  </div>
                                  <div className="text-xs flex items-center gap-1">
                                    {item.limitPenjualan > 0 ? (
                                      <>
                                        <AlertCircle className="w-3 h-3 text-orange-500" />
                                        <span className="text-orange-600 font-semibold">
                                          Limit: {item.limitPenjualan} item
                                          perhari
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-green-600 font-medium">
                                        ♾️ Unlimited
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${stokStatus.color}`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${stokStatus.badgeColor} mr-2`}
                                ></span>
                                {item.stok / item.jumlahPerKemasan}{" "}
                                {item.jenisKemasan}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="text-sm font-semibold text-gray-700">
                                {formatGramsToKg(item.berat)} KG
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-sm font-bold text-purple-700 bg-purple-100 px-3 py-1 rounded-lg">
                                  {item.jumlahPerKemasan} pcs
                                </span>
                                <span className="text-xs font-semibold text-gray-600">
                                  per {item.jenisKemasan}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center sticky right-0 bg-white group-hover:bg-blue-50 transition-colors">
                              <button
                                onClick={() => {
                                  setSelectedBarang(item);
                                  setShowDetailModal(true);
                                }}
                                className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-all"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-full shadow-md border border-gray-100">
                <Activity className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-600">
                  Menampilkan{" "}
                  <span className="font-bold text-gray-900">
                    {filteredBarang.length}
                  </span>{" "}
                  dari{" "}
                  <span className="font-bold text-gray-900">
                    {barangList.length}
                  </span>{" "}
                  barang
                  {debouncedSearchTerm && (
                    <span className="text-blue-600 font-semibold">
                      {" "}
                      (hasil pencarian)
                    </span>
                  )}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            {loadingStokHarian ? (
              <div className="flex justify-center items-center py-32">
                <div className="text-center">
                  <div className="relative">
                    <div className="w-24 h-24 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                    <ClipboardList className="w-10 h-10 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <p className="text-gray-500 mt-6 text-lg font-medium">
                    Memuat data stok harian...
                  </p>
                </div>
              </div>
            ) : stokHarianData.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-16 text-center">
                <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ClipboardList className="w-12 h-12 text-gray-400" />
                </div>
                <p className="text-gray-700 text-lg font-bold mb-2">
                  Tidak ada data snapshot
                </p>
                <p className="text-gray-500 text-sm max-w-sm mx-auto">
                  Belum ada snapshot stok untuk{" "}
                  <span className="font-semibold text-blue-600">
                    {formatDateLong(stokHarianDate)}
                  </span>
                  . Pastikan cron job sudah berjalan.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-blue-600 to-indigo-700">
                        <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                          No
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Nama Barang
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                          Stok (Kemasan)
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                          Stok (PCS)
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                          Terjual (Kemasan)
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                          Terjual (PCS)
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                          Masuk (Kemasan)
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                          Masuk (PCS)
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                          Kemasan
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredStokHarian.map((item, index) => {
                        return (
                          <tr
                            key={item.barangId}
                            className="hover:bg-blue-50 transition-colors group"
                          >
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              {index + 1}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="bg-blue-100 p-2 rounded-lg group-hover:bg-blue-200 transition-colors">
                                  <Package className="w-4 h-4 text-blue-600" />
                                </div>
                                <span className="text-sm font-semibold text-gray-900">
                                  {item.namaBarang}
                                </span>
                              </div>
                            </td>

                            {/* Stok (Kemasan) */}
                            <td className="px-6 py-4 text-center">
                              <span className="text-sm font-bold text-amber-700">
                                {formatDecimal(item.stokPadaTanggalKemasan)}{" "}
                                {item.jenisKemasan}
                              </span>
                            </td>

                            {/* Stok (PCS) */}
                            <td className="px-6 py-4 text-center">
                              <span className="text-sm font-semibold text-gray-700">
                                {formatNumber(item.stokPadaTanggalPcs)} pcs
                              </span>
                            </td>

                            {/* Terjual (Kemasan) */}
                            <td className="px-6 py-4 text-center">
                              <span className="text-sm font-bold text-indigo-700">
                                {formatDecimal(item.totalTerjualKemasan)}{" "}
                                {item.jenisKemasan}
                              </span>
                            </td>

                            {/* Terjual (PCS) */}
                            <td className="px-6 py-4 text-center">
                              {item.totalTerjualPcs > 0 ? (
                                <span className="inline-flex items-center gap-1 text-sm font-bold text-red-700 bg-red-50 px-3 py-1 rounded-lg">
                                  <TrendingDown className="w-3.5 h-3.5" />
                                  {formatNumber(item.totalTerjualPcs)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-sm text-gray-400">
                                  <Minus className="w-3.5 h-3.5" /> 0
                                </span>
                              )}
                            </td>

                            {/* Masuk (Kemasan) */}
                            <td className="px-6 py-4 text-center">
                              <span className="text-sm font-bold text-emerald-700">
                                {formatDecimal(item.totalMasukKemasan)}{" "}
                                {item.jenisKemasan}
                              </span>
                            </td>

                            {/* Masuk (PCS) */}
                            <td className="px-6 py-4 text-center">
                              {item.totalMasukPcs > 0 ? (
                                <span className="inline-flex items-center gap-1 text-sm font-bold text-green-700 bg-green-50 px-3 py-1 rounded-lg">
                                  <TrendingUp className="w-3.5 h-3.5" />
                                  {formatNumber(item.totalMasukPcs)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-sm text-gray-400">
                                  <Minus className="w-3.5 h-3.5" /> 0
                                </span>
                              )}
                            </td>

                            {/* Kemasan */}
                            <td className="px-6 py-4 text-center">
                              <span className="text-xs text-gray-500">
                                {item.jumlahPerKemasan} pcs /{" "}
                                {item.jenisKemasan}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {stokHarianData.length > 0 && (
              <div className="mt-8 text-center">
                <div className="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-full shadow-md border border-gray-100">
                  <Activity className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-gray-600">
                    Menampilkan{" "}
                    <span className="font-bold text-gray-900">
                      {filteredStokHarian.length}
                    </span>{" "}
                    dari{" "}
                    <span className="font-bold text-gray-900">
                      {stokHarianData.length}
                    </span>{" "}
                    barang
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedBarang && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowDetailModal(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                      <Eye className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white">
                      Detail Barang
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="text-white hover:bg-white/20 p-3 rounded-xl transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-8 space-y-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5">
                  <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-2">
                    Nama Barang
                  </p>
                  <p className="text-gray-900 text-2xl font-bold">
                    {selectedBarang.namaBarang}
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wider mb-2">
                      Stok
                    </p>
                    <p className="text-gray-900 text-xl font-bold">
                      {selectedBarang.stok} pcs
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wider mb-2">
                      Berat
                    </p>
                    <p className="text-gray-900 text-xl font-bold">
                      {formatGramsToKg(selectedBarang.berat)} KG
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                    <p className="text-xs text-purple-600 font-bold uppercase tracking-wider mb-2">
                      Kemasan
                    </p>
                    <p className="text-purple-900 text-xl font-bold">
                      {selectedBarang.jumlahPerKemasan} pcs
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      per {selectedBarang.jenisKemasan}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">
                        Tanggal Dibuat
                      </p>
                    </div>
                    <p className="text-gray-900 font-semibold">
                      {formatDate(selectedBarang.createdAt)}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-gray-600" />
                      <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">
                        Terakhir Update
                      </p>
                    </div>
                    <p className="text-gray-900 font-semibold">
                      {formatDate(selectedBarang.updatedAt)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="w-full mt-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-4 rounded-xl transition-all font-bold text-base shadow-lg"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataBarangPage;
