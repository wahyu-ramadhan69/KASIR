"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  DollarSign,
  FileSpreadsheet,
  Package,
  RefreshCw,
  Search,
  TrendingUp,
  Loader2,
  X,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

type BarangLaba = {
  barangId: number;
  namaBarang: string;
  berat: number;
  jumlahPerKemasan: number;
  jenisKemasan: string;
  totalDus: number;
  totalPcs: number;
  totalPcsSetara: number;
  totalModal: number;
  totalPenjualan: number;
  totalLaba: number;
};

type Summary = {
  totalModal: number;
  totalPenjualan: number;
  totalLaba: number;
  totalPcsSetara: number;
  jumlahBarang: number;
};

const formatRupiah = (number: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(number || 0);

const formatNumber = (num: number): string => {
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  const formatShort = (value: number, suffix: string) => {
    const rounded = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
    return `${sign}${rounded} ${suffix}`;
  };

  if (abs >= 1000000000) return formatShort(abs / 1000000000, "M");
  if (abs >= 1000000) return formatShort(abs / 1000000, "jt");
  if (abs >= 1000) return formatShort(abs / 1000, "rb");
  return `${num}`;
};

const formatDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatBeratKg = (grams: number): string => {
  const kg = Number(grams || 0) / 1000;
  const trimmed = kg.toFixed(3).replace(/\.?0+$/, "");
  return trimmed.replace(".", ",");
};

const LaporanLabaBarangPage = () => {
  const [data, setData] = useState<BarangLaba[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalModal: 0,
    totalPenjualan: 0,
    totalLaba: 0,
    totalPcsSetara: 0,
    jumlahBarang: 0,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [statusPembayaran, setStatusPembayaran] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const marginPersen = useMemo(() => {
    if (!summary.totalPenjualan) return 0;
    return (summary.totalLaba / summary.totalPenjualan) * 100;
  }, [summary.totalLaba, summary.totalPenjualan]);

  const totalDus = useMemo(
    () => data.reduce((acc, item) => acc + (item.totalDus || 0), 0),
    [data]
  );

  const totalPcs = useMemo(
    () => data.reduce((acc, item) => acc + (item.totalPcs || 0), 0),
    [data]
  );

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter((item) =>
      `${item.namaBarang} ${formatBeratKg(item.berat)}`
        .toLowerCase()
        .includes(term)
    );
  }, [data, searchTerm]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (statusPembayaran && statusPembayaran !== "all") {
        params.set("statusPembayaran", statusPembayaran);
      }

      const res = await fetch(`/api/laporan/barang?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || res.statusText);
      }

      const body = await res.json();
      setData(body.data || []);
      setSummary(
        body.summary || {
          totalModal: 0,
          totalPenjualan: 0,
          totalLaba: 0,
          totalPcsSetara: 0,
          jumlahBarang: 0,
        }
      );
    } catch (error: any) {
      console.error("Gagal mengambil laporan laba barang:", error);
      toast.error(error?.message || "Gagal mengambil laporan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, statusPembayaran]);

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setStatusPembayaran("all");
    setSearchTerm("");
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (statusPembayaran && statusPembayaran !== "all") {
        params.set("statusPembayaran", statusPembayaran);
      }

      const res = await fetch(
        `/api/laporan/barang/export?${params.toString()}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || res.statusText);
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

      let filename = "Laporan-Laba-Barang";
      if (startDate && endDate) filename += `-${startDate}-sd-${endDate}`;
      else if (startDate) filename += `-sejak-${startDate}`;
      else if (endDate) filename += `-sampai-${endDate}`;
      filename += `-${Date.now()}.xlsx`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Laporan berhasil didownload");
    } catch (error: any) {
      console.error("Gagal export laporan laba barang:", error);
      toast.error(error?.message || "Gagal export laporan");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto pb-20">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Laporan Laba per Barang
            </h1>
            <p className="text-blue-100">
              Ringkasan profit per barang berdasarkan periode yang dipilih
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="bg-white/10 hover:bg-white/20 disabled:bg-white/10 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              Export Excel
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="bg-white/10 hover:bg-white/20 disabled:bg-white/10 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Muat Ulang
            </button>
          </div>
        </div>

        {/* Info periode */}
        <div className="mt-4 bg-black/10 rounded-lg px-4 py-2 text-sm text-blue-100">
          Periode:{" "}
          <span className="font-semibold text-white">
            {startDate ? `${formatDate(startDate)}` : "Semua waktu"}
            {endDate ? ` s/d ${formatDate(endDate)}` : ""}
          </span>{" "}
          | Status:{" "}
          <span className="font-semibold text-white">
            {statusPembayaran === "all"
              ? "Semua"
              : statusPembayaran === "LUNAS"
              ? "Lunas"
              : "Hutang"}
          </span>
        </div>
      </div>

      {/* Statistic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Total Penjualan</p>
            <DollarSign className="w-8 h-8 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            Rp {formatNumber(summary.totalPenjualan)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {summary.jumlahBarang} barang
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-orange-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Total Modal</p>
            <Package className="w-8 h-8 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            Rp {formatNumber(summary.totalModal)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Biaya pokok</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Total Laba</p>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600">
            Rp {formatNumber(summary.totalLaba)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Akumulasi profit</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-purple-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Margin</p>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {marginPersen.toFixed(2)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Laba / penjualan</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border-l-4 border-indigo-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-gray-500 text-sm font-medium">Total Terjual</p>
            <Package className="w-8 h-8 text-indigo-500" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {totalDus.toLocaleString()} kemasan
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {totalPcs.toLocaleString()} item (setara{" "}
            {summary.totalPcsSetara.toLocaleString()} item)
          </p>
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
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none"
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
                placeholder="Dari tanggal"
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
                placeholder="Sampai tanggal"
              />
            </div>
          </div>

          <select
            value={statusPembayaran}
            onChange={(e) => setStatusPembayaran(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="LUNAS">Lunas</option>
            <option value="HUTANG">Hutang</option>
          </select>

          {(statusPembayaran !== "all" ||
            searchTerm ||
            startDate ||
            endDate) && (
            <button
              onClick={handleReset}
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
                    Barang
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Penjualan
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Modal
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Laba
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                    Margin
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>Tidak ada data</p>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => {
                    const margin =
                      item.totalPenjualan > 0
                        ? (item.totalLaba / item.totalPenjualan) * 100
                        : 0;

                    return (
                      <tr
                        key={item.barangId}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 text-sm">
                            {item.namaBarang}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatBeratKg(item.berat)} kg /{" "}
                            {item.jumlahPerKemasan} item/
                            {item.jenisKemasan.toLowerCase()}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold">
                              {item.totalDus.toLocaleString()}{" "}
                              {item.jenisKemasan.toLowerCase()}
                            </span>
                            <span className="text-gray-500">
                              {item.totalPcs.toLocaleString()} item
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
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
                              margin >= 30
                                ? "bg-green-100 text-green-700"
                                : margin >= 20
                                ? "bg-blue-100 text-blue-700"
                                : margin >= 10
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LaporanLabaBarangPage;
