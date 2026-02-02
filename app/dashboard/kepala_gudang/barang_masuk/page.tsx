"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  Package,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface BarangMasuk {
  barangId: number;
  namaBarang: string;
  jenisKemasan: string;
  jumlahPerKemasan: number;
  totalMasukPcs: number;
  totalMasukKemasan: number;
}

type FilterMode = "date" | "range";

const BarangMasukPage = () => {
  const [barangMasuk, setBarangMasuk] = useState<BarangMasuk[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>("date");
  const [date, setDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [query, setQuery] = useState<{
    mode: FilterMode;
    date: string;
    startDate: string;
    endDate: string;
  }>({
    mode: "date",
    date: new Date().toISOString().split("T")[0],
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    setQuery({
      mode: filterMode,
      date,
      startDate,
      endDate,
    });
  }, [filterMode, date, startDate, endDate]);

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("id-ID").format(value);
  };

  const formatDecimal = (value: number) => {
    if (Number.isInteger(value)) {
      return formatNumber(value);
    }
    return new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const resetFilter = () => {
    const today = new Date().toISOString().split("T")[0];
    setFilterMode("date");
    setDate(today);
    setStartDate("");
    setEndDate("");
    setQuery({
      mode: "date",
      date: today,
      startDate: "",
      endDate: "",
    });
  };

  const fetchBarangMasuk = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.mode === "date" && query.date) {
        params.set("date", query.date);
      }
      if (query.mode === "range") {
        if (query.startDate) {
          params.set("startDate", query.startDate);
        }
        if (query.endDate) {
          params.set("endDate", query.endDate);
        }
      }

      const response = await fetch(
        `/api/barang/pembelian${params.toString() ? `?${params}` : ""}`
      );
      const result = await response.json();
      if (result.success) {
        setBarangMasuk(result.data || []);
      } else {
        setBarangMasuk([]);
      }
    } catch (error) {
      console.error("Error fetching barang masuk:", error);
      toast.error("Gagal mengambil data barang masuk");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBarangMasuk();
  }, [query]);

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

        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-8 mb-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/kepala_gudang/barang"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-2.5 rounded-lg transition-all shadow-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                  Barang Masuk
                </h1>
                <p className="text-blue-100 text-lg">
                  Ringkasan barang masuk berdasarkan periode pembelian
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchBarangMasuk}
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

        <div className="mb-6 bg-white rounded-xl p-4 shadow-md border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setFilterMode("date")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  filterMode === "date"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Tanggal Tertentu
              </button>
              <button
                onClick={() => setFilterMode("range")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  filterMode === "range"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Rentang Tanggal
              </button>
            </div>

            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              {filterMode === "date" ? (
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </>
              )}
            </div>

            <button
              onClick={resetFilter}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
            >
              Reset
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-4 py-2 rounded-lg">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>
              {query.mode === "date" && query.date
                ? `Tanggal: ${query.date}`
                : query.mode === "range" && (query.startDate || query.endDate)
                ? `Rentang: ${query.startDate || "-"} s/d ${
                    query.endDate || "-"
                  }`
                : "Semua tanggal"}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-24">
              <div className="text-center">
                <div className="relative">
                  <div className="w-20 h-20 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                  <BarChart3 className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-gray-500 mt-6 text-lg font-medium">
                  Memuat data barang masuk...
                </p>
              </div>
            </div>
          ) : barangMasuk.length === 0 ? (
            <div className="p-16 text-center">
              <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="w-12 h-12 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg font-medium">
                Tidak ada data pembelian pada periode ini
              </p>
            </div>
          ) : (
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
                  {barangMasuk.map((row, index) => (
                    <tr
                      key={row.barangId}
                      className="hover:bg-blue-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="bg-blue-100 p-2 rounded-lg">
                            <Package className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {row.namaBarang}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-bold text-indigo-700">
                          {formatDecimal(row.totalMasukKemasan)} {row.jenisKemasan}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-semibold text-gray-700">
                          {formatNumber(row.totalMasukPcs)} pcs
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm text-gray-700">
                          {row.jumlahPerKemasan} pcs / {row.jenisKemasan}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {barangMasuk.length > 0 && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase">
                Total Barang
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {barangMasuk.length}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase">
                Total Masuk (Kemasan)
              </p>
              <p className="text-2xl font-bold text-indigo-600 mt-2">
                {formatDecimal(
                  barangMasuk.reduce(
                    (sum, item) => sum + item.totalMasukKemasan,
                    0
                  )
                )}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase">
                Total Masuk (PCS)
              </p>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                {formatNumber(
                  barangMasuk.reduce((sum, item) => sum + item.totalMasukPcs, 0)
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BarangMasukPage;
