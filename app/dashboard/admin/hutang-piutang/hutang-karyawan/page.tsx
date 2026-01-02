"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CreditCard,
  Eye,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  History,
  List,
  User,
  Wallet,
  X,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

interface Karyawan {
  id: number;
  nama: string;
  nik: string;
  noHp: string | null;
  alamat: string | null;
  jenis: string;
  totalPinjaman: number;
  createdAt: string;
  updatedAt: string;
}

interface PinjamanItem {
  id: number;
  karyawanId: number;
  jumlahPinjaman: number;
  createdAt: string;
  karyawan?: {
    id: number;
    nama: string;
    nik: string;
  };
}

interface PembayaranItem {
  id: number;
  karyawanId: number;
  jumlahbayar: number;
  createdAt: string;
  karyawan?: {
    id: number;
    nama: string;
    nik: string;
  };
}

type ViewMode = "hutang" | "historyPinjaman" | "historyPembayaran";

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

const HutangKaryawanPage = () => {
  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("hutang");

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedKaryawan, setSelectedKaryawan] = useState<Karyawan | null>(
    null
  );
  const [pinjamanHistory, setPinjamanHistory] = useState<PinjamanItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [pinjamanGlobal, setPinjamanGlobal] = useState<PinjamanItem[]>([]);
  const [pembayaranGlobal, setPembayaranGlobal] = useState<PembayaranItem[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);

  const [showTambahPinjamanModal, setShowTambahPinjamanModal] = useState(false);
  const [showPembayaranModal, setShowPembayaranModal] = useState(false);
  const [showEditPinjamanModal, setShowEditPinjamanModal] = useState(false);
  const [showEditPembayaranModal, setShowEditPembayaranModal] = useState(false);
  const [jumlahPinjaman, setJumlahPinjaman] = useState("");
  const [jumlahBayar, setJumlahBayar] = useState("");
  const [editJumlahPinjaman, setEditJumlahPinjaman] = useState("");
  const [editJumlahBayar, setEditJumlahBayar] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingPinjaman, setEditingPinjaman] = useState<PinjamanItem | null>(
    null
  );
  const [editingPembayaran, setEditingPembayaran] =
    useState<PembayaranItem | null>(null);

  const [stats, setStats] = useState({
    totalPinjaman: 0,
    totalKaryawan: 0,
    rataRataHutang: 0,
  });
  const [karyawanOptions, setKaryawanOptions] = useState<Karyawan[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (viewMode !== "hutang") return;
    fetchKaryawan(1, true);
    fetchStats();
    fetchKaryawanOptions();
  }, [debouncedSearch, viewMode]);

  useEffect(() => {
    if (viewMode === "historyPinjaman") fetchGlobalPinjaman();
    if (viewMode === "historyPembayaran") fetchGlobalPembayaran();
  }, [viewMode]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          pagination?.hasMore &&
          !loadingMore &&
          !loading
        ) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [pagination, loadingMore, loading]);

  const buildQueryParams = (page: number) => {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", "20");
    if (debouncedSearch) params.append("search", debouncedSearch);
    return params.toString();
  };

  const fetchKaryawan = async (page = 1, reset = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const queryParams = buildQueryParams(page);
      const res = await fetch(`/api/karyawan/hutang?${queryParams}`);
      const data = await res.json();

      if (data.success) {
        const list: Karyawan[] = data.data || [];
        if (reset) setKaryawanList(list);
        else setKaryawanList((prev) => [...prev, ...list]);
        setPagination(data.pagination);
      } else {
        toast.error(data.error || "Gagal mengambil data karyawan");
      }
    } catch (error) {
      console.error("Error fetching karyawan:", error);
      toast.error("Gagal mengambil data karyawan");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/karyawan/hutang?limit=1000");
      const data = await res.json();
      if (data.success) {
        const list: Karyawan[] = data.data || [];
        const totalPinjaman = list.reduce(
          (sum, k) => sum + k.totalPinjaman,
          0
        );
        const totalKaryawan = list.length;
        const rataRataHutang =
          totalKaryawan > 0 ? Math.round(totalPinjaman / totalKaryawan) : 0;
        setStats({
          totalPinjaman,
          totalKaryawan,
          rataRataHutang,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchKaryawanOptions = async () => {
    try {
      const res = await fetch("/api/karyawan?limit=1000");
      const data = await res.json();
      if (data.data) {
        setKaryawanOptions(data.data as Karyawan[]);
      }
    } catch (error) {
      console.error("Error fetching karyawan options:", error);
    }
  };

  const loadMore = () => {
    if (viewMode === "hutang" && pagination && pagination.hasMore && !loadingMore) {
      fetchKaryawan(pagination.page + 1, false);
    }
  };

  const handleViewDetail = (karyawan: Karyawan) => {
    setSelectedKaryawan(karyawan);
    setShowDetailModal(true);
    fetchPinjamanHistory(karyawan.id);
  };

  const handleOpenTambahPinjaman = (karyawan?: Karyawan) => {
    const nextKaryawan =
      karyawan || karyawanOptions[0] || karyawanList[0] || null;
    if (!nextKaryawan) {
      toast.error("Data karyawan tidak ditemukan");
      return;
    }
    setSelectedKaryawan(nextKaryawan);
    setJumlahPinjaman("");
    setShowTambahPinjamanModal(true);
  };

  const handleOpenPembayaran = (karyawan?: Karyawan) => {
    const nextKaryawan =
      karyawan ||
      karyawanList.find((item) => item.totalPinjaman > 0) ||
      null;
    if (!nextKaryawan) {
      toast.error("Tidak ada karyawan dengan hutang");
      return;
    }
    setSelectedKaryawan(nextKaryawan);
    setJumlahBayar(nextKaryawan.totalPinjaman.toString());
    setShowPembayaranModal(true);
  };

  const handleOpenEditPinjaman = (item: PinjamanItem) => {
    setEditingPinjaman(item);
    setEditJumlahPinjaman(item.jumlahPinjaman.toString());
    setShowEditPinjamanModal(true);
  };

  const handleOpenEditPembayaran = (item: PembayaranItem) => {
    setEditingPembayaran(item);
    setEditJumlahBayar(item.jumlahbayar.toString());
    setShowEditPembayaranModal(true);
  };

  const handlePembayaran = async () => {
    if (!selectedKaryawan || !jumlahBayar) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(
        `/api/karyawan/${selectedKaryawan.id}/bayar-hutang`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jumlahBayar: parseInt(jumlahBayar) }),
        }
      );
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Pembayaran berhasil");
        setShowPembayaranModal(false);
        setSelectedKaryawan(null);
        setJumlahBayar("");
        fetchKaryawan(1, true);
        fetchStats();
      } else {
        toast.error(data.error || "Gagal melakukan pembayaran");
      }
    } catch (error) {
      console.error("Error paying debt:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePinjaman = async () => {
    if (!editingPinjaman || !editJumlahPinjaman) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/karyawan/pinjaman/${editingPinjaman.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jumlahPinjaman: parseInt(editJumlahPinjaman),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Pinjaman berhasil diperbarui");
        setShowEditPinjamanModal(false);
        setEditingPinjaman(null);
        setEditJumlahPinjaman("");
        fetchGlobalPinjaman();
        fetchKaryawan(1, true);
        fetchStats();
        if (selectedKaryawan?.id === editingPinjaman.karyawanId) {
          fetchPinjamanHistory(selectedKaryawan.id);
        }
      } else {
        toast.error(data.error || "Gagal memperbarui pinjaman");
      }
    } catch (error) {
      console.error("Error updating pinjaman:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePembayaran = async () => {
    if (!editingPembayaran || !editJumlahBayar) return;
    setIsUpdating(true);
    try {
      const res = await fetch(
        `/api/karyawan/pembayaran-hutang/${editingPembayaran.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jumlahBayar: parseInt(editJumlahBayar),
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Pembayaran berhasil diperbarui");
        setShowEditPembayaranModal(false);
        setEditingPembayaran(null);
        setEditJumlahBayar("");
        fetchGlobalPembayaran();
        fetchKaryawan(1, true);
        fetchStats();
      } else {
        toast.error(data.error || "Gagal memperbarui pembayaran");
      }
    } catch (error) {
      console.error("Error updating pembayaran:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTambahPinjaman = async () => {
    if (!selectedKaryawan || !jumlahPinjaman) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(
        `/api/karyawan/${selectedKaryawan.id}/pinjaman`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jumlahPinjaman: parseInt(jumlahPinjaman),
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Pinjaman berhasil ditambahkan");
        setShowTambahPinjamanModal(false);
        setSelectedKaryawan(null);
        setJumlahPinjaman("");
        fetchKaryawan(1, true);
        fetchStats();
      } else {
        toast.error(data.error || "Gagal menambahkan pinjaman");
      }
    } catch (error) {
      console.error("Error adding loan:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
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
    }
    return `Rp ${amount}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const parseRupiahInput = (value: string): string => {
    return value.replace(/[^0-9]/g, "");
  };

  const fetchPinjamanHistory = async (karyawanId: number) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/karyawan/${karyawanId}/pinjaman`);
      const data = await res.json();
      if (data.success) {
        setPinjamanHistory(data.data || []);
      } else {
        setPinjamanHistory([]);
      }
    } catch (error) {
      console.error("Error fetching pinjaman history:", error);
      setPinjamanHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchGlobalPinjaman = async () => {
    setLoadingGlobal(true);
    try {
      const res = await fetch("/api/karyawan/pinjaman?limit=200");
      const data = await res.json();
      if (data.success) {
        setPinjamanGlobal(data.data || []);
      } else {
        setPinjamanGlobal([]);
      }
    } catch (error) {
      console.error("Error fetching pinjaman global:", error);
      setPinjamanGlobal([]);
    } finally {
      setLoadingGlobal(false);
    }
  };

  const fetchGlobalPembayaran = async () => {
    setLoadingGlobal(true);
    try {
      const res = await fetch("/api/karyawan/pembayaran-hutang?limit=200");
      const data = await res.json();
      if (data.success) {
        setPembayaranGlobal(data.data || []);
      } else {
        setPembayaranGlobal([]);
      }
    } catch (error) {
      console.error("Error fetching pembayaran global:", error);
      setPembayaranGlobal([]);
    } finally {
      setLoadingGlobal(false);
    }
  };

  const handleChangeMode = (mode: ViewMode) => {
    setViewMode(mode);
    setSearchTerm("");
    setDebouncedSearch("");
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="w-full max-w-7xl mx-auto px-6 pb-8">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { background: "#333", color: "#fff" },
            success: { style: { background: "#22c55e" } },
            error: { style: { background: "#ef4444" } },
          }}
        />

        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl p-5 mb-6 shadow-xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -mr-24 -mt-24"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -ml-16 -mb-16"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/admin/hutang-piutang"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white p-2.5 rounded-lg transition-all shadow-lg"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Hutang Karyawan
                </h1>
                <p className="text-blue-100 text-sm">
                  Kelola pinjaman dan pembayaran hutang karyawan
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleChangeMode("hutang")}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg text-sm ${
                  viewMode === "hutang"
                    ? "bg-white text-blue-600"
                    : "bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white"
                }`}
              >
                <Wallet className="w-4 h-4" />
                Hutang Karyawan
              </button>
              <button
                onClick={() => handleChangeMode("historyPinjaman")}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg text-sm ${
                  viewMode === "historyPinjaman"
                    ? "bg-white text-blue-600"
                    : "bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white"
                }`}
              >
                <History className="w-4 h-4" />
                History Pinjaman
              </button>
              <button
                onClick={() => handleChangeMode("historyPembayaran")}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg text-sm ${
                  viewMode === "historyPembayaran"
                    ? "bg-white text-blue-600"
                    : "bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white"
                }`}
              >
                <List className="w-4 h-4" />
                History Pembayaran
              </button>
              <button
                onClick={() => {
                  if (viewMode === "hutang") fetchKaryawan(1, true);
                  if (viewMode === "historyPinjaman") fetchGlobalPinjaman();
                  if (viewMode === "historyPembayaran") fetchGlobalPembayaran();
                }}
                disabled={viewMode === "hutang" ? loading : loadingGlobal}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg disabled:opacity-50 text-sm"
              >
                <RefreshCw
                  className={`w-4 h-4 ${
                    (viewMode === "hutang" ? loading : loadingGlobal)
                      ? "animate-spin"
                      : ""
                  }`}
                />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className="group bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Total Pinjaman
                </p>
                <p className="text-lg font-bold text-red-600">
                  {formatRupiahSimple(stats.totalPinjaman)}
                </p>
                <p className="text-[11px] text-gray-400">Belum lunas</p>
              </div>
              <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-2.5 rounded-lg shadow-md">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Karyawan Berhutang
                </p>
                <p className="text-xl font-bold text-indigo-700">
                  {stats.totalKaryawan}
                </p>
                <p className="text-[11px] text-gray-400">Aktif</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-2.5 rounded-lg shadow-md">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-xl p-4 shadow-md border border-gray-100 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-1">
                  Rata-rata Hutang
                </p>
                <p className="text-xl font-bold text-orange-600">
                  {formatRupiahSimple(stats.rataRataHutang)}
                </p>
                <p className="text-[11px] text-gray-400">Per karyawan</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2.5 rounded-lg shadow-md">
                <User className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={
                  viewMode === "hutang"
                    ? "Cari nama atau NIK karyawan..."
                    : "Cari nama atau NIK..."
                }
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
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {viewMode === "hutang" && (
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Daftar Hutang Karyawan
                </h2>
                <p className="text-sm text-gray-500">
                  Kelola data hutang karyawan
                </p>
              </div>
              <button
                onClick={() => handleOpenTambahPinjaman()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-all text-sm font-semibold flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Tambah Piutang
              </button>
            </div>
          )}
          {viewMode === "hutang" && loading && karyawanList.length === 0 ? (
            <div className="flex justify-center items-center py-24">
              <div className="text-center">
                <div className="relative">
                  <div className="w-24 h-24 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                  <Wallet className="w-10 h-10 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-gray-500 mt-6 text-lg font-medium">
                  Memuat data karyawan...
                </p>
              </div>
            </div>
          ) : viewMode === "hutang" ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Nama
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      NIK
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Jenis
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Total Pinjaman
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {karyawanList.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        <Wallet className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Tidak ada data hutang karyawan ditemukan</p>
                      </td>
                    </tr>
                  ) : (
                    karyawanList.map((karyawan) => (
                      <tr key={karyawan.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium text-gray-900 text-sm">
                            {karyawan.nama}
                          </p>
                          {karyawan.noHp && (
                            <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-medium">
                              {karyawan.noHp}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {karyawan.nik}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {karyawan.jenis}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-medium text-red-600">
                            {formatRupiah(karyawan.totalPinjaman)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleViewDetail(karyawan)}
                              className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all"
                              title="Lihat Detail"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {karyawan.totalPinjaman > 0 && (
                              <button
                                onClick={() => handleOpenPembayaran(karyawan)}
                                className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all"
                                title="Bayar Hutang"
                              >
                                <Banknote className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : viewMode === "historyPinjaman" ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tanggal
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Karyawan
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Nominal
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loadingGlobal ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        Memuat riwayat pinjaman...
                      </td>
                    </tr>
                  ) : pinjamanGlobal.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        Tidak ada riwayat pinjaman ditemukan
                      </td>
                    </tr>
                  ) : (
                    pinjamanGlobal
                      .filter((item) => {
                        if (!debouncedSearch) return true;
                        const label = item.karyawan
                          ? `${item.karyawan.nama} ${item.karyawan.nik}`
                          : `${item.karyawanId}`;
                        return label
                          .toLowerCase()
                          .includes(debouncedSearch.toLowerCase());
                      })
                      .map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDate(item.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {item.karyawan
                              ? `${item.karyawan.nama} - ${item.karyawan.nik}`
                              : `#${item.karyawanId}`}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-red-600">
                            {formatRupiah(item.jumlahPinjaman)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleOpenEditPinjaman(item)}
                              className="p-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-all"
                              title="Edit Pinjaman"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tanggal
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Karyawan
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Nominal
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loadingGlobal ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        Memuat riwayat pembayaran...
                      </td>
                    </tr>
                  ) : pembayaranGlobal.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        Tidak ada riwayat pembayaran ditemukan
                      </td>
                    </tr>
                  ) : (
                    pembayaranGlobal
                      .filter((item) => {
                        if (!debouncedSearch) return true;
                        const label = item.karyawan
                          ? `${item.karyawan.nama} ${item.karyawan.nik}`
                          : `${item.karyawanId}`;
                        return label
                          .toLowerCase()
                          .includes(debouncedSearch.toLowerCase());
                      })
                      .map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDate(item.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {item.karyawan
                              ? `${item.karyawan.nama} - ${item.karyawan.nik}`
                              : `#${item.karyawanId}`}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                            {formatRupiah(item.jumlahbayar)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleOpenEditPembayaran(item)}
                              className="p-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-all"
                              title="Edit Pembayaran"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div ref={loadMoreRef} className="h-10"></div>
      </div>

      {showDetailModal && selectedKaryawan && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Detail Karyawan</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)] space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Nama</p>
                    <p className="font-semibold">{selectedKaryawan.nama}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">NIK</p>
                    <p className="font-semibold">{selectedKaryawan.nik}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Jenis</p>
                    <p className="font-semibold">{selectedKaryawan.jenis}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tanggal Update</p>
                    <p className="font-semibold">
                      {formatDate(selectedKaryawan.updatedAt)}
                    </p>
                  </div>
                  {selectedKaryawan.alamat && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">Alamat</p>
                      <p className="font-semibold">
                        {selectedKaryawan.alamat}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Pinjaman</span>
                  <span className="font-semibold text-red-600">
                    {formatRupiah(selectedKaryawan.totalPinjaman)}
                  </span>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b">
                  <p className="text-sm font-semibold text-gray-700">
                    Riwayat Penambahan Hutang
                  </p>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {loadingHistory ? (
                    <div className="py-6 text-center text-sm text-gray-500">
                      Memuat riwayat...
                    </div>
                  ) : pinjamanHistory.length === 0 ? (
                    <div className="py-6 text-center text-sm text-gray-500">
                      Belum ada riwayat pinjaman
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                            Tanggal
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                            Nominal
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {pinjamanHistory.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-2 text-gray-600">
                              {formatDate(item.createdAt)}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-red-600">
                              {formatRupiah(item.jumlahPinjaman)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {selectedKaryawan.totalPinjaman > 0 && (
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleOpenPembayaran(selectedKaryawan);
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <Banknote className="w-5 h-5" />
                    Bayar Hutang
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showTambahPinjamanModal && selectedKaryawan && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTambahPinjamanModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Tambah Pinjaman</h2>
              <button
                onClick={() => setShowTambahPinjamanModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Karyawan</p>
                <select
                  value={selectedKaryawan.id}
                  onChange={(e) => {
                    const next = karyawanOptions.find(
                      (item) => item.id === Number(e.target.value)
                    );
                    if (next) setSelectedKaryawan(next);
                  }}
                  className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none transition-all"
                >
                  {karyawanOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nama} - {item.nik}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Nominal Pinjaman
                </label>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={
                      jumlahPinjaman
                        ? parseInt(jumlahPinjaman).toLocaleString("id-ID")
                        : ""
                    }
                    onChange={(e) =>
                      setJumlahPinjaman(parseRupiahInput(e.target.value))
                    }
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none transition-all"
                    placeholder="0"
                  />
                </div>
              </div>
              <button
                onClick={handleTambahPinjaman}
                disabled={isSubmitting}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4" />
                    Simpan Pinjaman
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPembayaranModal && selectedKaryawan && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPembayaranModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Pembayaran Hutang</h2>
              <button
                onClick={() => setShowPembayaranModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Karyawan</p>
                <select
                  value={selectedKaryawan.id}
                  onChange={(e) => {
                    const next = karyawanList.find(
                      (item) => item.id === Number(e.target.value)
                    );
                    if (next) {
                      setSelectedKaryawan(next);
                      setJumlahBayar(next.totalPinjaman.toString());
                    }
                  }}
                  className="mt-2 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none transition-all"
                >
                  {karyawanList
                    .filter((item) => item.totalPinjaman > 0)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nama} - {item.nik}
                      </option>
                    ))}
                </select>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Sisa Hutang</span>
                  <span className="font-semibold text-red-600">
                    {formatRupiah(selectedKaryawan.totalPinjaman)}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Nominal Pembayaran
                </label>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={
                      jumlahBayar
                        ? parseInt(jumlahBayar).toLocaleString("id-ID")
                        : ""
                    }
                    onChange={(e) =>
                      setJumlahBayar(parseRupiahInput(e.target.value))
                    }
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none transition-all"
                    placeholder="0"
                  />
                </div>
              </div>
              <button
                onClick={handlePembayaran}
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Banknote className="w-4 h-4" />
                    Simpan Pembayaran
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditPinjamanModal && editingPinjaman && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowEditPinjamanModal(false);
            setEditingPinjaman(null);
            setEditJumlahPinjaman("");
          }}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Edit Pinjaman</h2>
              <button
                onClick={() => {
                  setShowEditPinjamanModal(false);
                  setEditingPinjaman(null);
                  setEditJumlahPinjaman("");
                }}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Karyawan</p>
                <p className="mt-1 font-semibold text-gray-800">
                  {editingPinjaman.karyawan
                    ? `${editingPinjaman.karyawan.nama} - ${editingPinjaman.karyawan.nik}`
                    : `#${editingPinjaman.karyawanId}`}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Nominal Pinjaman
                </label>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={
                      editJumlahPinjaman
                        ? parseInt(editJumlahPinjaman).toLocaleString("id-ID")
                        : ""
                    }
                    onChange={(e) =>
                      setEditJumlahPinjaman(parseRupiahInput(e.target.value))
                    }
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none transition-all"
                    placeholder="0"
                  />
                </div>
              </div>
              <button
                onClick={handleUpdatePinjaman}
                disabled={isUpdating}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4" />
                    Simpan Perubahan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditPembayaranModal && editingPembayaran && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowEditPembayaranModal(false);
            setEditingPembayaran(null);
            setEditJumlahBayar("");
          }}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Edit Pembayaran</h2>
              <button
                onClick={() => {
                  setShowEditPembayaranModal(false);
                  setEditingPembayaran(null);
                  setEditJumlahBayar("");
                }}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Karyawan</p>
                <p className="mt-1 font-semibold text-gray-800">
                  {editingPembayaran.karyawan
                    ? `${editingPembayaran.karyawan.nama} - ${editingPembayaran.karyawan.nik}`
                    : `#${editingPembayaran.karyawanId}`}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Nominal Pembayaran
                </label>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={
                      editJumlahBayar
                        ? parseInt(editJumlahBayar).toLocaleString("id-ID")
                        : ""
                    }
                    onChange={(e) =>
                      setEditJumlahBayar(parseRupiahInput(e.target.value))
                    }
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none transition-all"
                    placeholder="0"
                  />
                </div>
              </div>
              <button
                onClick={handleUpdatePembayaran}
                disabled={isUpdating}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4" />
                    Simpan Perubahan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HutangKaryawanPage;
