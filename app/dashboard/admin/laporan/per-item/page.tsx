"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  X,
  Download,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Loader2,
  ArrowUpDown,
  BarChart3,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

interface ItemData {
  barangId: number;
  namaBarang: string;
  ukuran: number;
  satuan: string;
  jumlahPerkardus: number;
  hargaBeliTerakhir: number;
  hargaJualTerakhir: number;
  totalDusTerjual: number;
  totalPcsTerjual: number;
  totalQtyTerjual: number;
  totalPenjualan: number;
  totalModal: number;
  totalLaba: number;
  totalDiskon: number;
  jumlahTransaksi: number;
  margin: number;
}

interface Stats {
  totalDus: number;
  totalPcs: number;
  totalPenjualan: number;
  totalModal: number;
  totalLaba: number;
  totalDiskon: number;
  margin: number;
  jumlahBarang: number;
}

const LaporanPerItemPage = () => {
  const [itemsList, setItemsList] = useState<ItemData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [stats, setStats] = useState<Stats>({
    totalDus: 0,
    totalPcs: 0,
    totalPenjualan: 0,
    totalModal: 0,
    totalLaba: 0,
    totalDiskon: 0,
    margin: 0,
    jumlahBarang: 0,
  });

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);

  // Filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("totalTerjual");
  const [sortOrder, setSortOrder] = useState<string>("desc");

  // Export loading
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);
  const [exportingPDF, setExportingPDF] = useState<boolean>(false);

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItemsList([]);
    setPage(1);
    setHasMore(true);
    fetchData(1, true);
  }, [startDate, endDate, searchTerm, sortBy, sortOrder]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, loading, loadingMore, page]);

  const fetchData = async (pageNum: number, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let url = `/api/laporan/per-item?page=${pageNum}&limit=20`;

      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (searchTerm) url += `&search=${searchTerm}`;
      if (sortBy) url += `&sortBy=${sortBy}`;
      if (sortOrder) url += `&sortOrder=${sortOrder}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        if (reset) {
          setItemsList(data.data);
        } else {
          setItemsList((prev) => [...prev, ...data.data]);
        }

        setHasMore(data.pagination.currentPage < data.pagination.totalPages);

        // Update stats dari summary
        setStats({
          totalDus: data.summary?.totalDus || 0,
          totalPcs: data.summary?.totalPcs || 0,
          totalPenjualan: data.summary?.totalPenjualan || 0,
          totalModal: data.summary?.totalModal || 0,
          totalLaba: data.summary?.totalLaba || 0,
          totalDiskon: data.summary?.totalDiskon || 0,
          margin: data.summary?.margin || 0,
          jumlahBarang: data.summary?.jumlahBarang || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Gagal mengambil data laporan");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchData(nextPage, false);
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSearchTerm("");
    setSortBy("totalTerjual");
    setSortOrder("desc");
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const handleExport = async (
    format: "excel" | "pdf",
    period: "monthly" | "yearly" = "monthly"
  ) => {
    if (format === "excel") {
      setExportingExcel(true);
    } else {
      setExportingPDF(true);
    }

    try {
      let url = `/api/laporan/per-item/export?period=${period}`;

      if (period === "monthly") {
        // Export bulan ini atau custom range
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
        if (searchTerm) url += `&search=${searchTerm}`;
      } else {
        // Export tahunan
        const year = new Date().getFullYear();
        url += `&year=${year}`;
      }

      const res = await fetch(url);
      const blob = await res.blob();

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

      let filename = "Laporan-Per-Item";
      if (period === "yearly") {
        filename += `-Tahunan-${new Date().getFullYear()}`;
      } else if (startDate || endDate) {
        filename += `-${startDate || "..."}-${endDate || "..."}`;
      } else {
        const now = new Date();
        const monthName = now.toLocaleDateString("id-ID", {
          month: "long",
          year: "numeric",
        });
        filename += `-${monthName}`;
      }
      filename += `-${Date.now()}.${format === "excel" ? "xlsx" : "pdf"}`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success(`Laporan ${format.toUpperCase()} berhasil didownload`);
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Gagal export laporan");
    } finally {
      setExportingExcel(false);
      setExportingPDF(false);
    }
  };

  const formatRupiah = (number: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  return (
    <div className="w-full max-w-7xl mx-auto pb-20">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Laporan Penjualan Per Item
            </h1>
            <p className="text-purple-100">
              Analisis performa penjualan setiap barang
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport("excel", "monthly")}
              disabled={exportingExcel}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
            >
              {exportingExcel ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Excel Bulan Ini
            </button>
            <button
              onClick={() => handleExport("excel", "yearly")}
              disabled={exportingExcel}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
            >
              {exportingExcel ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Excel Tahunan
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Total Penjualan</p>
            <DollarSign className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatRupiah(stats.totalPenjualan)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.jumlahBarang} item
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Total Modal</p>
            <Package className="w-8 h-8 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatRupiah(stats.totalModal)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Cost of goods</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Total Laba</p>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600">
            {formatRupiah(stats.totalLaba)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.margin.toFixed(2)}% margin
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Total Terjual</p>
            <BarChart3 className="w-8 h-8 text-purple-500" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {stats.totalDus?.toLocaleString() || 0} dus
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.totalPcs?.toLocaleString() || 0} pcs
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-indigo-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Total Diskon</p>
            <DollarSign className="w-8 h-8 text-indigo-500" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {formatRupiah(stats.totalDiskon)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Potongan harga</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 mb-6 shadow-md border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari nama barang..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
              />
            </div>
            <span className="flex items-center text-gray-500">-</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {(startDate || endDate || searchTerm) && (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Nama Barang
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                    Ukuran
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                    Dus
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                    Pcs
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("totalTerjual")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Total (pcs)
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                    Transaksi
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("totalPenjualan")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Penjualan
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Modal
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("totalLaba")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Laba
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("margin")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Margin
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {itemsList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>Tidak ada data penjualan item</p>
                    </td>
                  </tr>
                ) : (
                  itemsList.map((item, index) => (
                    <tr
                      key={item.barangId}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {(page - 1) * 20 + index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-sm">
                          {item.namaBarang}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {item.ukuran} {item.satuan}
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">
                        {item.totalDusTerjual}
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">
                        {item.totalPcsTerjual}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                        {item.totalQtyTerjual.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        {item.jumlahTransaksi}x
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-blue-600">
                        {formatRupiah(item.totalPenjualan)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-orange-600">
                        {formatRupiah(item.totalModal)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-green-600">
                        {formatRupiah(item.totalLaba)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                            item.margin >= 30
                              ? "bg-green-100 text-green-700"
                              : item.margin >= 20
                              ? "bg-blue-100 text-blue-700"
                              : item.margin >= 10
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {item.margin.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Infinite Scroll Trigger */}
        {hasMore && (
          <div ref={observerTarget} className="flex justify-center py-4">
            {loadingMore && (
              <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
            )}
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {itemsList.length > 0 && (
        <div className="mt-4 bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 mb-1">Jenis Barang</p>
              <p className="text-lg font-bold text-gray-900">
                {stats.jumlahBarang}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Dus</p>
              <p className="text-lg font-bold text-gray-900">
                {stats.totalDus?.toLocaleString() || 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Pcs</p>
              <p className="text-lg font-bold text-gray-900">
                {stats.totalPcs?.toLocaleString() || 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Penjualan</p>
              <p className="text-lg font-bold text-blue-600">
                {formatRupiah(stats.totalPenjualan)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Laba</p>
              <p className="text-lg font-bold text-green-600">
                {formatRupiah(stats.totalLaba)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaporanPerItemPage;
