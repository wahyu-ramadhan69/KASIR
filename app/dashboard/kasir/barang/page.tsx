"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Package,
  RefreshCw,
  X,
  Store,
  DollarSign,
  Box,
  AlertCircle,
  Eye,
  Filter,
  Calendar,
  Activity,
  BarChart3,
  ShoppingBag,
} from "lucide-react";

import toast, { Toaster } from "react-hot-toast";

interface Supplier {
  id: number;
  namaSupplier: string;
  alamat: string;
  noHp: string;
  limitHutang: number;
  limitPembelian: number;
}

interface Barang {
  id: number;
  namaBarang: string;
  hargaBeli: number;
  hargaJual: number;
  stok: number;
  jenisKemasan: string;
  jumlahPerKemasan: number;
  supplierId: number;
  berat: number;
  limitPenjualan: number;
  createdAt: string;
  updatedAt: string;
  supplier: Supplier;
}

interface BarangFormData {
  namaBarang: string;
  hargaBeli: string;
  hargaJual: string;
  jenisKemasan: string;
  jumlahPerKemasan: string;
  supplierId: string;
  berat: string;
  limitPenjualan: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasMore: boolean;
}

interface PenjualanBarang {
  barangId: number;
  namaBarang: string;
  jenisKemasan: string;
  jumlahPerKemasan: number;
  totalTerjualPcs: number;
  totalTerjualKemasan: number;
}

type ViewMode = "products" | "sales";
type PenjualanFilterMode = "date" | "range";

const DataBarangPage = () => {
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");
  const [filterSupplier, setFilterSupplier] = useState<string>("all");
  const [filterStok, setFilterStok] = useState<
    "all" | "low" | "medium" | "high"
  >("all");
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedBarang, setSelectedBarang] = useState<Barang | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 12,
    hasMore: false,
  });

  const [view, setView] = useState<ViewMode>("products");

  const [penjualanBarang, setPenjualanBarang] = useState<PenjualanBarang[]>(
    []
  );
  const [loadingPenjualanBarang, setLoadingPenjualanBarang] = useState(false);
  const [penjualanFilterMode, setPenjualanFilterMode] =
    useState<PenjualanFilterMode>("date");
  const [penjualanDate, setPenjualanDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [penjualanStartDate, setPenjualanStartDate] = useState<string>("");
  const [penjualanEndDate, setPenjualanEndDate] = useState<string>("");
  const [penjualanQuery, setPenjualanQuery] = useState<{
    mode: PenjualanFilterMode;
    date: string;
    startDate: string;
    endDate: string;
  }>({
    mode: "date",
    date: new Date().toISOString().split("T")[0],
    startDate: "",
    endDate: "",
  });

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchBarang();
  }, []);

  const formatInputRupiah = (value: string): string => {
    const numbers = value.replace(/\D/g, "");
    if (numbers === "") return "";
    const formatted = new Intl.NumberFormat("id-ID").format(parseInt(numbers));
    return `Rp ${formatted}`;
  };

  const parseRupiahToNumber = (value: string): number => {
    const numbers = value.replace(/\D/g, "");
    return numbers === "" ? 0 : parseInt(numbers);
  };

  const normalizeDecimalInput = (value: string): string => {
    const cleaned = value.replace(/[^0-9,\.]/g, "");
    const normalized = cleaned.replace(/\./g, ",");
    const [whole, ...rest] = normalized.split(",");
    return rest.length > 0 ? `${whole},${rest.join("")}` : whole;
  };

  const parseKgToGrams = (value: string): number => {
    const normalized = normalizeDecimalInput(value);
    const numberValue = Number(normalized.replace(",", "."));
    if (!Number.isFinite(numberValue)) return 0;
    return Math.round(numberValue * 1000);
  };

  const formatGramsToKg = (grams: number): string => {
    if (!Number.isFinite(grams)) return "";
    const kg = grams / 1000;
    const formatted = kg.toFixed(3).replace(/\.?0+$/, "");
    return formatted.replace(".", ",");
  };

  const fetchBarang = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/barang");
      const data = await res.json();

      if (data.success) {
        setBarangList(data.data);
      }
    } catch (error) {
      console.error("Error fetching barang:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (number: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const formatRupiahSimple = (amount: number): string => {
    const absAmount = Math.abs(amount);
    if (absAmount >= 1_000_000_000) {
      return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`;
    } else if (absAmount >= 1_000_000) {
      return `Rp ${(amount / 1_000_000).toFixed(1)}Jt`;
    } else if (absAmount >= 1_000) {
      return `Rp ${(amount / 1_000).toFixed(0)}Rb`;
    } else {
      return `Rp ${amount}`;
    }
  };

  const calculateProfit = (hargaBeli: number, hargaJual: number) => {
    const profit = hargaJual - hargaBeli;
    const percentage = ((profit / hargaBeli) * 100).toFixed(1);
    return { profit, percentage };
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

  const resetPenjualanFilter = () => {
    const today = new Date().toISOString().split("T")[0];
    setPenjualanFilterMode("date");
    setPenjualanDate(today);
    setPenjualanStartDate("");
    setPenjualanEndDate("");
    setPenjualanQuery({
      mode: "date",
      date: today,
      startDate: "",
      endDate: "",
    });
  };

  const fetchPenjualanBarang = async () => {
    setLoadingPenjualanBarang(true);
    try {
      const params = new URLSearchParams();
      if (penjualanQuery.mode === "date" && penjualanQuery.date) {
        params.set("date", penjualanQuery.date);
      }
      if (penjualanQuery.mode === "range") {
        if (penjualanQuery.startDate) {
          params.set("startDate", penjualanQuery.startDate);
        }
        if (penjualanQuery.endDate) {
          params.set("endDate", penjualanQuery.endDate);
        }
      }

      const response = await fetch(
        `/api/barang/penjualan${params.toString() ? `?${params}` : ""}`
      );
      const result = await response.json();
      if (result.success) {
        setPenjualanBarang(result.data || []);
      } else {
        setPenjualanBarang([]);
      }
    } catch (error) {
      console.error("Error fetching penjualan barang:", error);
    } finally {
      setLoadingPenjualanBarang(false);
    }
  };

  useEffect(() => {
    if (view === "sales") {
      fetchPenjualanBarang();
    }
  }, [view, penjualanQuery]);

  useEffect(() => {
    setPenjualanQuery({
      mode: penjualanFilterMode,
      date: penjualanDate,
      startDate: penjualanStartDate,
      endDate: penjualanEndDate,
    });
  }, [
    penjualanFilterMode,
    penjualanDate,
    penjualanStartDate,
    penjualanEndDate,
  ]);

  const getProfitColor = (profit: number) => {
    if (profit > 0) return "text-green-600";
    if (profit < 0) return "text-red-600";
    return "text-yellow-600";
  };

  const getPercentagePrefix = (profit: number) => {
    if (profit > 0) return "+";
    if (profit < 0) return "";
    return "";
  };

  const getStokStatus = (stok: number, jumlahPerKemasan: number) => {
    if (stok / jumlahPerKemasan < 10)
      return {
        color: "bg-red-100 text-red-800",
        label: "Stok Rendah",
        badgeColor: "bg-red-500",
      };
    if (stok / jumlahPerKemasan < 20)
      return {
        color: "bg-yellow-100 text-yellow-800",
        label: "Stok Sedang",
        badgeColor: "bg-yellow-500",
      };
    return {
      color: "bg-green-100 text-green-800",
      label: "Stok Aman",
      badgeColor: "bg-green-500",
    };
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  const filteredBarang = barangList.filter((item) => {
    const matchSearch =
      item.namaBarang
        .toLowerCase()
        .includes(debouncedSearchTerm.toLowerCase()) ||
      item.supplier?.namaSupplier
        ?.toLowerCase()
        .includes(debouncedSearchTerm.toLowerCase());
    const matchSupplier =
      filterSupplier === "all" ||
      item.supplier?.id.toString() === filterSupplier;

    let matchStok = true;
    if (filterStok === "low")
      matchStok = item.stok / item.jumlahPerKemasan < 50;
    if (filterStok === "medium")
      matchStok = item.stok / item.jumlahPerKemasan >= 50 && item.stok < 100;
    if (filterStok === "high")
      matchStok = item.stok / item.jumlahPerKemasan >= 100;

    return matchSearch && matchSupplier && matchStok;
  });

  const uniqueSuppliers = Array.from(
    new Map(
      barangList.map((item) => [item.supplier?.id, item.supplier])
    ).values()
  ).filter((supplier): supplier is Supplier => supplier !== undefined);

  const getTotalNilaiBarang = () => {
    return barangList.reduce(
      (sum, item) => sum + item.hargaBeli * item.stok,
      0
    );
  };

  const getTotalProfit = () => {
    return barangList.reduce((sum, item) => {
      const profit = (item.hargaJual - item.hargaBeli) * item.stok;
      return sum + profit;
    }, 0);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("id-ID").format(value);
  };

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

        {/* Enhanced Header Section */}
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
            <div className="flex gap-3">
              <div className="flex items-center bg-white/10 backdrop-blur-sm p-1 rounded-xl shadow-lg">
                <button
                  onClick={() => setView("products")}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                    view === "products"
                      ? "bg-white text-blue-700 shadow-md"
                      : "text-white/90 hover:bg-white/20"
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  Barang
                </button>
                <button
                  onClick={() => setView("sales")}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                    view === "sales"
                      ? "bg-white text-blue-700 shadow-md"
                      : "text-white/90 hover:bg-white/20"
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Terjual
                </button>
              </div>
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

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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

          {/* <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Nilai Inventori
                </p>
                <p
                  className="text-2xl font-bold text-indigo-600 mt-2 cursor-help"
                  title={formatRupiah(getTotalNilaiBarang())}
                >
                  {formatRupiahSimple(getTotalNilaiBarang())}
                </p>
                <p className="text-xs text-indigo-400 mt-2">
                  Total nilai barang
                </p>
              </div>
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <DollarSign className="w-8 h-8 text-white" />
              </div>
            </div>
          </div> */}

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Supplier
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {uniqueSuppliers.length}
                </p>
                <p className="text-xs text-gray-400 mt-2">Supplier aktif</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <Store className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>
        {view === "products" ? (
          <>
            {/* Search and Filter Section */}
            <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Cari nama barang atau supplier..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="flex gap-3">
                  <select
                    value={filterSupplier}
                    onChange={(e) => setFilterSupplier(e.target.value)}
                    className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all bg-white"
                  >
                    <option value="all">Semua Supplier</option>
                    {uniqueSuppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id.toString()}>
                        {supplier.namaSupplier}
                      </option>
                    ))}
                  </select>

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
              </div>

              {debouncedSearchTerm && (
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-4 py-2 rounded-lg">
                  <Search className="w-4 h-4 text-blue-600" />
                  <span>
                    Menampilkan hasil pencarian untuk:{" "}
                    <span className="font-semibold text-blue-700">
                      "{debouncedSearchTerm}"
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* Barang Table */}
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

                        <th className="px-6 py-4 text-right text-xs font-bold text-white uppercase tracking-wider">
                          Harga Jual
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
                        const { profit, percentage } = calculateProfit(
                          item.hargaBeli,
                          item.hargaJual
                        );
                        const stokStatus = getStokStatus(
                          item.stok,
                          item.jumlahPerKemasan
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

                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="text-sm font-semibold text-blue-600">
                                {formatRupiahSimple(item.hargaJual)}
                              </div>
                              <div className="text-xs text-blue-500">
                                {formatRupiah(item.hargaJual)}
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
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedBarang(item);
                                    setShowDetailModal(true);
                                  }}
                                  className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-all"
                                  title="Lihat Detail"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer Info */}
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
            <div className="mb-6 bg-white rounded-xl p-4 shadow-md border border-gray-100">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPenjualanFilterMode("date")}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      penjualanFilterMode === "date"
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Tanggal Tertentu
                  </button>
                  <button
                    onClick={() => setPenjualanFilterMode("range")}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      penjualanFilterMode === "range"
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Rentang Tanggal
                  </button>
                </div>

                <div className="flex-1 flex flex-col sm:flex-row gap-3">
                  {penjualanFilterMode === "date" ? (
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <input
                        type="date"
                        value={penjualanDate}
                        onChange={(e) => setPenjualanDate(e.target.value)}
                        className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <input
                          type="date"
                          value={penjualanStartDate}
                          onChange={(e) =>
                            setPenjualanStartDate(e.target.value)
                          }
                          className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <input
                          type="date"
                          value={penjualanEndDate}
                          onChange={(e) => setPenjualanEndDate(e.target.value)}
                          className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                        />
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={resetPenjualanFilter}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
                >
                  Reset
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-4 py-2 rounded-lg">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>
                  {penjualanQuery.mode === "date" && penjualanQuery.date
                    ? `Tanggal: ${penjualanQuery.date}`
                    : penjualanQuery.mode === "range" &&
                      (penjualanQuery.startDate || penjualanQuery.endDate)
                    ? `Rentang: ${penjualanQuery.startDate || "-"} s/d ${
                        penjualanQuery.endDate || "-"
                      }`
                    : "Semua tanggal"}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              {loadingPenjualanBarang ? (
                <div className="flex justify-center items-center py-24">
                  <div className="text-center">
                    <div className="relative">
                      <div className="w-20 h-20 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                      <BarChart3 className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="text-gray-500 mt-6 text-lg font-medium">
                      Memuat data terjual...
                    </p>
                  </div>
                </div>
              ) : penjualanBarang.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShoppingBag className="w-12 h-12 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-lg font-medium">
                    Tidak ada data penjualan pada periode ini
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
                          Terjual (Kemasan)
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                          Terjual (PCS)
                        </th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">
                          Kemasan
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {penjualanBarang.map((row, index) => (
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
                              {formatDecimal(row.totalTerjualKemasan)}{" "}
                              {row.jenisKemasan}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-sm font-semibold text-gray-700">
                              {formatNumber(row.totalTerjualPcs)} pcs
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

            {penjualanBarang.length > 0 && (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Total Barang
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {penjualanBarang.length}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Total Terjual (Kemasan)
                  </p>
                  <p className="text-2xl font-bold text-indigo-600 mt-2">
                    {formatDecimal(
                      penjualanBarang.reduce(
                        (sum, item) => sum + item.totalTerjualKemasan,
                        0
                      )
                    )}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Total Terjual (PCS)
                  </p>
                  <p className="text-2xl font-bold text-blue-600 mt-2">
                    {formatNumber(
                      penjualanBarang.reduce(
                        (sum, item) => sum + item.totalTerjualPcs,
                        0
                      )
                    )}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedBarang && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={() => setShowDetailModal(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in duration-200"
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wider mb-2">
                      Harga Beli
                    </p>
                    <p className="text-gray-900 text-xl font-bold">
                      {formatRupiah(selectedBarang.hargaBeli)}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wider mb-2">
                      Harga Jual
                    </p>
                    <p className="text-blue-600 text-xl font-bold">
                      {formatRupiah(selectedBarang.hargaJual)}
                    </p>
                  </div>
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
                  className="w-full mt-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-4 rounded-xl transition-all font-bold text-base shadow-lg hover:shadow-xl"
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
