"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Calendar,
  TrendingDown,
  DollarSign,
  Package,
  Eye,
  X,
  FileSpreadsheet,
  Loader2,
  Building2,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface Barang {
  id: number;
  namaBarang: string;
  ukuran: number;
  satuan: string;
  jumlahPerkardus: number;
}

interface PembelianItem {
  id: number;
  barangId: number;
  jumlahDus: number;
  hargaPokok: number;
  diskonPerItem: number;
  barang: Barang;
}

interface Supplier {
  id: number;
  namaSupplier: string;
  alamat: string;
  noHp: string;
}

interface PembelianHeader {
  id: number;
  kodePembelian: string;
  supplierId: number;
  subtotal: number;
  diskonNota: number;
  totalHarga: number;
  jumlahDibayar: number;
  statusPembayaran: string;
  statusTransaksi: string;
  createdAt: string;
  supplier: Supplier;
  items: PembelianItem[];
}

interface Stats {
  totalPembelian: number;
  totalDiskon: number;
  jumlahTransaksi: number;
  jumlahItem: number;
  totalDus: number;
}

const LaporanPembelianPage = () => {
  const [pembelianList, setPembelianList] = useState<PembelianHeader[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [stats, setStats] = useState<Stats>({
    totalPembelian: 0,
    totalDiskon: 0,
    jumlahTransaksi: 0,
    jumlahItem: 0,
    totalDus: 0,
  });

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);

  // Filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedPembelian, setSelectedPembelian] =
    useState<PembelianHeader | null>(null);

  // Export loading
  const [exportingSummary, setExportingSummary] = useState<boolean>(false);
  const [exportingDetail, setExportingDetail] = useState<boolean>(false);
  const [exportingYearly, setExportingYearly] = useState<boolean>(false);

  // Ref untuk infinite scroll
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPembelianList([]);
    setPage(1);
    setHasMore(true);
    fetchData(1, true);
  }, [startDate, endDate, searchTerm, statusFilter]);

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

  const fetchData = async (
    pageNum: number,
    reset: boolean = false,
    retryCount: number = 0
  ) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let url = `/api/laporan/pembelian?page=${pageNum}&limit=20`;

      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (searchTerm) url += `&search=${searchTerm}`;
      if (statusFilter !== "all") url += `&statusPembayaran=${statusFilter}`;

      const res = await fetch(url);

      // Handle 404 with retry logic (max 5 attempts)
      if (res.status === 404 && retryCount < 5) {
        console.warn(
          `Attempt ${retryCount + 1}/5 failed (404). Retrying in 2s...`
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return fetchData(pageNum, reset, retryCount + 1);
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      if (data.success) {
        if (reset) {
          setPembelianList(data.data);
        } else {
          setPembelianList((prev) => [...prev, ...data.data]);
        }

        setHasMore(data.pagination.hasMore);
        setStats(data.stats.overall);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      if (retryCount >= 5) {
        toast.error("Gagal mengambil data pembelian setelah 5 percobaan");
      } else {
        toast.error("Gagal mengambil data pembelian");
      }
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

  const handleViewDetail = (pembelian: PembelianHeader) => {
    setSelectedPembelian(pembelian);
    setShowDetailModal(true);
  };

  const handleClearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSearchTerm("");
    setStatusFilter("all");
  };

  const handleExport = async (exportType: "summary" | "detail" = "detail") => {
    if (exportType === "summary") {
      setExportingSummary(true);
    } else {
      setExportingDetail(true);
    }

    try {
      let url = `/api/laporan/pembelian/export?format=excel`;

      if (exportType === "summary") {
        url += `&detail=false`;
      } else {
        url += `&detail=true`;
      }

      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (searchTerm) url += `&search=${searchTerm}`;

      const res = await fetch(url);
      const blob = await res.blob();

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

      let filename = "Laporan-Pembelian";
      if (exportType === "summary") {
        filename += "-Summary";
      } else {
        filename += "-Detail";
      }

      if (startDate && endDate) {
        filename += `-${startDate}-sd-${endDate}`;
      } else if (startDate) {
        filename += `-sejak-${startDate}`;
      } else if (endDate) {
        filename += `-sampai-${endDate}`;
      }

      filename += `-${Date.now()}.xlsx`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Laporan Excel berhasil didownload");
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Gagal export laporan");
    } finally {
      setExportingSummary(false);
      setExportingDetail(false);
    }
  };

  const handleExportYearly = async () => {
    setExportingYearly(true);

    try {
      const year = new Date().getFullYear();
      const url = `/api/laporan/pembelian/export?period=yearly&year=${year}`;

      const res = await fetch(url);
      const blob = await res.blob();

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Laporan-Pembelian-Tahunan-${year}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Laporan Tahunan berhasil didownload");
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Gagal export laporan tahunan");
    } finally {
      setExportingYearly(false);
    }
  };

  const formatRupiah = (number: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto pb-20">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Laporan Pembelian
            </h1>
            <p className="text-blue-100">
              Analisis detail setiap transaksi pembelian
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport("summary")}
              disabled={exportingSummary}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
            >
              {exportingSummary ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Excel Summary
            </button>
            <button
              onClick={() => handleExport("detail")}
              disabled={exportingDetail}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
            >
              {exportingDetail ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Excel Detail
            </button>
            <button
              onClick={handleExportYearly}
              disabled={exportingYearly}
              className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
            >
              {exportingYearly ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Tahunan
            </button>
          </div>
        </div>

        {(startDate || endDate) && (
          <div className="mt-4 bg-blue-700/50 rounded-lg px-4 py-2">
            <p className="text-sm text-blue-100">
              📅 Export akan menggunakan filter:{" "}
              <span className="font-semibold text-white">
                {startDate && `Dari ${formatDate(startDate)}`}
                {startDate && endDate && " "}
                {endDate && `Sampai ${formatDate(endDate)}`}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Total Pembelian</p>
            <DollarSign className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatRupiah(stats.totalPembelian)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {stats.jumlahTransaksi} transaksi
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-red-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Total Diskon</p>
            <TrendingDown className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatRupiah(stats.totalDiskon)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Potongan harga</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Total Item</p>
            <Package className="w-8 h-8 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.jumlahItem}</p>
          <p className="text-xs text-gray-500 mt-1">Item dibeli</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-indigo-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Total Dus</p>
            <Package className="w-8 h-8 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats.totalDus?.toLocaleString() || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">Dus terbeli</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 mb-6 shadow-md border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari kode pembelian atau supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
              />
            </div>
            <span className="flex items-center text-gray-500">-</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="LUNAS">Lunas</option>
            <option value="HUTANG">Hutang</option>
          </select>

          {(startDate || endDate || searchTerm || statusFilter !== "all") && (
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
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Kode
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Tanggal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Items
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Subtotal
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Diskon
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Total
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pembelianList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>Tidak ada data pembelian</p>
                    </td>
                  </tr>
                ) : (
                  pembelianList.map((pb) => (
                    <tr
                      key={pb.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-sm">
                          {pb.kodePembelian}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(pb.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">
                          {pb.supplier?.namaSupplier || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">
                        {pb.items?.length || 0} item
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                        {formatRupiah(pb.subtotal)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-red-600">
                        {formatRupiah(pb.diskonNota)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-blue-600">
                        {formatRupiah(pb.totalHarga)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                            pb.statusPembayaran === "LUNAS"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {pb.statusPembayaran}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleViewDetail(pb)}
                          className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all"
                          title="Lihat Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {hasMore && (
          <div ref={observerTarget} className="flex justify-center py-4">
            {loadingMore && (
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            )}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedPembelian && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Detail Pembelian
                </h2>
                <p className="text-blue-100 text-sm">
                  {selectedPembelian.kodePembelian}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="bg-gray-50 rounded-lg p-4 mb-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Tanggal</p>
                  <p className="font-semibold">
                    {formatDateTime(selectedPembelian.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Supplier</p>
                  <p className="font-semibold">
                    {selectedPembelian.supplier?.namaSupplier || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status Pembayaran</p>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                      selectedPembelian.statusPembayaran === "LUNAS"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {selectedPembelian.statusPembayaran}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Item</p>
                  <p className="font-semibold">
                    {selectedPembelian.items?.length || 0} item
                  </p>
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 mb-3">
                Detail Per Item
              </h3>
              <div className="border rounded-lg overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Barang</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-right">Harga Pokok</th>
                      <th className="px-3 py-2 text-right">Diskon/Item</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedPembelian.items?.map((item) => {
                      const totalHarga = item.hargaPokok * item.jumlahDus;
                      const totalDiskon = item.diskonPerItem * item.jumlahDus;
                      const subtotal = totalHarga - totalDiskon;

                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <p className="font-medium">
                              {item.barang?.namaBarang}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {item.jumlahDus} dus
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatRupiah(item.hargaPokok)}
                          </td>
                          <td className="px-3 py-2 text-right text-red-600">
                            {formatRupiah(totalDiskon)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-blue-600">
                            {formatRupiah(subtotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold">
                    {formatRupiah(selectedPembelian.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Diskon Nota</span>
                  <span className="font-bold">
                    -{formatRupiah(selectedPembelian.diskonNota)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total Pembelian</span>
                  <span className="text-blue-600">
                    {formatRupiah(selectedPembelian.totalHarga)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaporanPembelianPage;
