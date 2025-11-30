"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Users,
  RefreshCw,
  Phone,
  MapPin,
  Building2,
  CreditCard,
  Plus,
  Edit,
  Trash2,
  X,
  Wallet,
  TrendingUp,
  Loader2,
  Filter,
  Eye,
  Calendar,
  AlertCircle,
  CheckCircle,
  Activity,
  BarChart3,
  TrendingDown,
  ShoppingCart,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface Sales {
  id: number;
  namaSales: string;
  nik: string;
  alamat: string;
  noHp: string;
  limitHutang: number;
  hutang: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SalesFormData {
  namaSales: string;
  nik: string;
  alamat: string;
  noHp: string;
  limitHutang: string;
  hutang: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasMore: boolean;
}

const DataSalesPage = () => {
  const [salesList, setSalesList] = useState<Sales[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");
  const [selectedSales, setSelectedSales] = useState<Sales | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 12,
    hasMore: false,
  });
  const [editingSales, setEditingSales] = useState<{
    id: number;
    data: SalesFormData;
  } | null>(null);
  const [formData, setFormData] = useState<SalesFormData>({
    namaSales: "",
    nik: "",
    alamat: "",
    noHp: "",
    limitHutang: "",
    hutang: "",
  });

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setSalesList([]);
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    fetchSales(1, true);
  }, [debouncedSearchTerm]);

  const fetchSales = async (page: number = 1, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let url: string;

      if (debouncedSearchTerm.trim()) {
        url = `/api/sales/search/${encodeURIComponent(
          debouncedSearchTerm
        )}?page=${page}&limit=12`;
      } else {
        url = `/api/sales?page=${page}&limit=12`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        if (reset) {
          setSalesList(data.data);
        } else {
          setSalesList((prev) => [...prev, ...data.data]);
        }
        setPagination(data.pagination);
      } else {
        console.error("Failed to fetch data");
      }
    } catch (error) {
      console.error("Error fetching sales:", error);
      toast.error("Gagal mengambil data sales");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          pagination.hasMore &&
          !loading &&
          !loadingMore
        ) {
          fetchSales(pagination.currentPage + 1, false);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [pagination, loading, loadingMore]);

  const formatRupiah = (amount: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
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

  const parseRupiahInput = (value: string): string => {
    return value.replace(/[^0-9]/g, "");
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === "limitHutang" || name === "hutang") {
      setFormData((prev) => ({
        ...prev,
        [name]: parseRupiahInput(value),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleEditInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (editingSales) {
      if (name === "limitHutang" || name === "hutang") {
        setEditingSales({
          ...editingSales,
          data: {
            ...editingSales.data,
            [name]: parseRupiahInput(value),
          },
        });
      } else {
        setEditingSales({
          ...editingSales,
          data: {
            ...editingSales.data,
            [name]: value,
          },
        });
      }
    }
  };

  const handleSubmitAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const submitData = {
        ...formData,
        limitHutang: formData.limitHutang || "0",
        hutang: formData.hutang || "0",
      };

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Sales berhasil ditambahkan!");
        setShowAddModal(false);
        setFormData({
          namaSales: "",
          nik: "",
          alamat: "",
          noHp: "",
          limitHutang: "",
          hutang: "",
        });
        setSalesList([]);
        setPagination((prev) => ({ ...prev, currentPage: 1 }));
        fetchSales(1, true);
      } else {
        toast.error(data.error || "Gagal menambahkan sales");
      }
    } catch (error) {
      console.error("Error adding sales:", error);
      toast.error("Terjadi kesalahan saat menambahkan sales");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (sales: Sales) => {
    setEditingSales({
      id: sales.id,
      data: {
        namaSales: sales.namaSales,
        nik: sales.nik,
        alamat: sales.alamat,
        noHp: sales.noHp,
        limitHutang: sales.limitHutang.toString(),
        hutang: sales.hutang.toString(),
      },
    });
    setShowEditModal(true);
  };

  const handleSubmitEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSales) return;

    setIsSubmitting(true);

    try {
      const submitData = {
        ...editingSales.data,
        limitHutang: editingSales.data.limitHutang || "0",
        hutang: editingSales.data.hutang || "0",
      };

      const res = await fetch(`/api/sales/${editingSales.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Sales berhasil diupdate!");
        setShowEditModal(false);
        setEditingSales(null);
        setSalesList((prev) =>
          prev.map((s) => (s.id === data.data.id ? data.data : s))
        );
      } else {
        toast.error(data.error || "Gagal mengupdate sales");
      }
    } catch (error) {
      console.error("Error updating sales:", error);
      toast.error("Terjadi kesalahan saat mengupdate sales");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus sales "${nama}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/sales/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Sales berhasil dihapus!");
        setSalesList((prev) => prev.filter((s) => s.id !== id));
        setPagination((prev) => ({
          ...prev,
          totalCount: prev.totalCount - 1,
        }));
      } else {
        toast.error(data.error || "Gagal menghapus sales");
      }
    } catch (error) {
      console.error("Error deleting sales:", error);
      toast.error("Terjadi kesalahan saat menghapus sales");
    }
  };

  const handleRefresh = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setSalesList([]);
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    fetchSales(1, true);
  };

  const formatPhoneNumber = (phone: string): string => {
    return phone.replace(/(\d{4})(\d{4})(\d+)/, "$1-$2-$3");
  };

  const formatNIK = (nik: string): string => {
    return nik.replace(/(\d{6})(\d{6})(\d{4})/, "$1-$2-$3");
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  const getHutangPercentage = (hutang: number, limit: number): number => {
    if (limit === 0) return 0;
    return Math.min((hutang / limit) * 100, 100);
  };

  const getHutangColor = (hutang: number, limit: number): string => {
    const percentage = getHutangPercentage(hutang, limit);
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getHutangStatus = (
    hutang: number,
    limit: number
  ): { color: string; label: string } => {
    const percentage = getHutangPercentage(hutang, limit);
    if (percentage >= 90) return { color: "text-red-600", label: "Kritis" };
    if (percentage >= 70)
      return { color: "text-yellow-600", label: "Peringatan" };
    return { color: "text-green-600", label: "Aman" };
  };

  const getTotalHutang = (): number => {
    return salesList.reduce((sum, sales) => sum + sales.hutang, 0);
  };

  const getTotalLimitHutang = (): number => {
    return salesList.reduce((sum, sales) => sum + sales.limitHutang, 0);
  };

  const filteredSales = salesList.filter((sales) => {
    if (filterStatus === "all") return true;
    const percentage = getHutangPercentage(sales.hutang, sales.limitHutang);
    if (filterStatus === "high") return percentage >= 90;
    if (filterStatus === "medium") return percentage >= 70 && percentage < 90;
    if (filterStatus === "low") return percentage < 70;
    return true;
  });

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
                <ShoppingCart className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                  Data Sales
                </h1>
                <p className="text-blue-100 text-lg">
                  Kelola informasi sales dan supplier Anda
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="group bg-white hover:bg-blue-50 text-blue-600 px-6 py-3 rounded-xl flex items-center gap-2 transition-all font-semibold shadow-lg hover:shadow-xl hover:scale-105 transform"
              >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                Tambah Sales
              </button>
              <button
                onClick={handleRefresh}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Total Sales
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {pagination.totalCount}
                </p>
                <p className="text-xs text-gray-400 mt-2">Sales terdaftar</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <ShoppingCart className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Total Supplier
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {pagination.totalCount}
                </p>
                <p className="text-xs text-gray-400 mt-2">Supplier aktif</p>
              </div>
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <Building2 className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Total Hutang
                </p>
                <p
                  className="text-2xl font-bold text-red-600 mt-2 cursor-help"
                  title={formatRupiah(getTotalHutang())}
                >
                  {formatRupiahSimple(getTotalHutang())}
                </p>
                <p className="text-xs text-red-400 mt-2">Hutang aktif</p>
              </div>
              <div className="bg-gradient-to-br from-red-500 to-red-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <TrendingDown className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Limit Hutang
                </p>
                <p
                  className="text-2xl font-bold text-green-600 mt-2 cursor-help"
                  title={formatRupiah(getTotalLimitHutang())}
                >
                  {formatRupiahSimple(getTotalLimitHutang())}
                </p>
                <p className="text-xs text-green-400 mt-2">
                  Total limit tersedia
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari nama supplier, NIK, alamat, atau nomor HP..."
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
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all bg-white"
              >
                <option value="all">Semua Status</option>
                <option value="high">Risiko Tinggi</option>
                <option value="medium">Risiko Sedang</option>
                <option value="low">Risiko Rendah</option>
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

        {/* Sales Cards Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="text-center">
              <div className="relative">
                <div className="w-24 h-24 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                <ShoppingCart className="w-10 h-10 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-gray-500 mt-6 text-lg font-medium">
                Memuat data sales...
              </p>
            </div>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-16 text-center">
            <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingCart className="w-12 h-12 text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg font-medium">
              {debouncedSearchTerm
                ? `Tidak ada sales ditemukan untuk "${debouncedSearchTerm}"`
                : "Tidak ada data sales"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredSales.map((sales) => {
                const status = getHutangStatus(sales.hutang, sales.limitHutang);
                return (
                  <div
                    key={sales.id}
                    className="group bg-white rounded-xl shadow-md border border-gray-100 hover:shadow-xl transition-all duration-300 overflow-hidden hover:-translate-y-1"
                  >
                    {/* Card Header */}
                    <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-4">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full -mr-12 -mt-12"></div>
                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-base font-bold text-white pr-2 line-clamp-1">
                            {sales.namaSales}
                          </h3>
                          <div
                            className={`px-2 py-1 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                              status.color === "text-red-600"
                                ? "bg-red-100 text-red-700"
                                : status.color === "text-yellow-600"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {status.label}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-blue-100 text-xs">
                          <Building2 className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate font-medium">Supplier</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4">
                      {/* NIK */}
                      <div className="mb-3 pb-3 border-b border-gray-200">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="bg-gray-100 p-1.5 rounded-lg">
                            <CreditCard className="w-3 h-3 text-gray-600" />
                          </div>
                          <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
                            NIK
                          </span>
                        </div>
                        <p className="text-xs text-gray-900 font-mono font-semibold pl-7">
                          {formatNIK(sales.nik)}
                        </p>
                      </div>

                      {/* Hutang Info */}
                      <div className="mb-3 pb-3 border-b border-gray-200">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              <div className="bg-red-100 p-1.5 rounded-lg">
                                <TrendingDown className="w-3 h-3 text-red-600" />
                              </div>
                              <span className="text-[10px] text-gray-500 font-semibold uppercase">
                                Hutang
                              </span>
                            </div>
                            <span
                              className="text-xs font-bold text-red-600 cursor-help"
                              title={formatRupiah(sales.hutang)}
                            >
                              {formatRupiahSimple(sales.hutang)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              <div className="bg-green-100 p-1.5 rounded-lg">
                                <TrendingUp className="w-3 h-3 text-green-600" />
                              </div>
                              <span className="text-[10px] text-gray-500 font-semibold uppercase">
                                Limit
                              </span>
                            </div>
                            <span
                              className="text-xs font-bold text-green-600 cursor-help"
                              title={formatRupiah(sales.limitHutang)}
                            >
                              {formatRupiahSimple(sales.limitHutang)}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-gray-600 mb-1 font-semibold">
                            <span>Penggunaan</span>
                            <span className={status.color}>
                              {getHutangPercentage(
                                sales.hutang,
                                sales.limitHutang
                              ).toFixed(1)}
                              %
                            </span>
                          </div>
                          <div className="relative w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${getHutangColor(
                                sales.hutang,
                                sales.limitHutang
                              )} relative overflow-hidden`}
                              style={{
                                width: `${getHutangPercentage(
                                  sales.hutang,
                                  sales.limitHutang
                                )}%`,
                              }}
                            >
                              <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="space-y-2 mb-3">
                        <div className="flex items-start gap-2 group/item">
                          <div className="bg-gray-100 p-1.5 rounded-lg group-hover/item:bg-blue-100 transition-colors flex-shrink-0">
                            <MapPin className="w-3 h-3 text-gray-600 group-hover/item:text-blue-600 transition-colors" />
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                            {sales.alamat}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 group/item">
                          <div className="bg-gray-100 p-1.5 rounded-lg group-hover/item:bg-blue-100 transition-colors flex-shrink-0">
                            <Phone className="w-3 h-3 text-gray-600 group-hover/item:text-blue-600 transition-colors" />
                          </div>
                          <p className="text-xs text-gray-700 font-semibold">
                            {formatPhoneNumber(sales.noHp)}
                          </p>
                        </div>
                      </div>

                      {/* Date Info */}
                      <div className="mb-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1 text-gray-500">
                            <Calendar className="w-3 h-3" />
                            <span>Terdaftar</span>
                          </div>
                          <span className="font-semibold text-gray-700">
                            {formatDate(sales.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleEdit(sales)}
                          className="group/btn bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-2 py-2 rounded-lg transition-all font-semibold text-xs flex items-center justify-center gap-1 shadow-md hover:shadow-lg"
                        >
                          <Edit className="w-3 h-3 group-hover/btn:rotate-12 transition-transform" />
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            handleDelete(sales.id, sales.namaSales)
                          }
                          className="group/btn bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-2 py-2 rounded-lg transition-all font-semibold text-xs flex items-center justify-center gap-1 shadow-md hover:shadow-lg"
                        >
                          <Trash2 className="w-3 h-3 group-hover/btn:scale-110 transition-transform" />
                          Hapus
                        </button>
                      </div>

                      <button
                        onClick={() => setSelectedSales(sales)}
                        className="w-full mt-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-3 py-2 rounded-lg transition-all font-semibold text-xs shadow-md hover:shadow-lg flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Lihat Detail
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Infinite Scroll Trigger */}
            <div ref={observerTarget} className="mt-10">
              {loadingMore && (
                <div className="flex justify-center items-center py-12">
                  <div className="text-center">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                    </div>
                    <p className="text-sm text-gray-500 mt-4 font-medium">
                      Memuat lebih banyak...
                    </p>
                  </div>
                </div>
              )}
              {!pagination.hasMore && salesList.length > 0 && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 rounded-full">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-sm text-gray-600 font-medium">
                      Semua data telah ditampilkan
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-full shadow-md border border-gray-100">
            <Activity className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-600">
              Menampilkan{" "}
              <span className="font-bold text-gray-900">
                {filteredSales.length}
              </span>{" "}
              dari{" "}
              <span className="font-bold text-gray-900">
                {pagination.totalCount}
              </span>{" "}
              sales
              {debouncedSearchTerm && (
                <span className="text-blue-600 font-semibold">
                  {" "}
                  (hasil pencarian)
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Detail Modal */}
        {selectedSales && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={() => setSelectedSales(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                      <Eye className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white">
                      Detail Sales
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedSales(null)}
                    className="text-white hover:bg-white/20 p-3 rounded-xl transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5">
                    <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-2">
                      Nama Supplier
                    </p>
                    <p className="text-gray-900 text-xl font-bold">
                      {selectedSales.namaSales}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-5">
                    <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider mb-2">
                      Status
                    </p>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          selectedSales.isActive ? "bg-green-500" : "bg-red-500"
                        }`}
                      ></div>
                      <p className="text-gray-900 text-xl font-bold">
                        {selectedSales.isActive ? "Aktif" : "Tidak Aktif"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-white p-2 rounded-lg">
                      <CreditCard className="w-5 h-5 text-gray-600" />
                    </div>
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">
                      NIK
                    </p>
                  </div>
                  <p className="text-gray-900 font-mono font-bold text-lg pl-11">
                    {formatNIK(selectedSales.nik)}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-white p-2 rounded-lg">
                      <MapPin className="w-5 h-5 text-gray-600" />
                    </div>
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">
                      Alamat
                    </p>
                  </div>
                  <p className="text-gray-900 leading-relaxed pl-11">
                    {selectedSales.alamat}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-white p-2 rounded-lg">
                      <Phone className="w-5 h-5 text-gray-600" />
                    </div>
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">
                      Nomor HP
                    </p>
                  </div>
                  <p className="text-gray-900 font-semibold text-lg pl-11">
                    {formatPhoneNumber(selectedSales.noHp)}
                  </p>
                </div>

                {/* Hutang Section */}
                <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 rounded-2xl p-6 border-2 border-blue-200">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="bg-blue-600 p-3 rounded-xl">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">
                      Informasi Hutang
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="bg-white rounded-xl p-4 shadow-md">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="w-4 h-4 text-red-600" />
                        <p className="text-xs text-gray-500 font-semibold uppercase">
                          Hutang
                        </p>
                      </div>
                      <p className="text-2xl font-bold text-red-600">
                        {formatRupiah(selectedSales.hutang)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatRupiahSimple(selectedSales.hutang)}
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-4 shadow-md">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <p className="text-xs text-gray-500 font-semibold uppercase">
                          Limit
                        </p>
                      </div>
                      <p className="text-2xl font-bold text-green-600">
                        {formatRupiah(selectedSales.limitHutang)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatRupiahSimple(selectedSales.limitHutang)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-4 shadow-md">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-semibold text-gray-700">
                        Penggunaan Limit
                      </span>
                      <span
                        className={`text-lg font-bold ${
                          getHutangStatus(
                            selectedSales.hutang,
                            selectedSales.limitHutang
                          ).color
                        }`}
                      >
                        {getHutangPercentage(
                          selectedSales.hutang,
                          selectedSales.limitHutang
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                    <div className="relative w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-4 rounded-full transition-all duration-500 ${getHutangColor(
                          selectedSales.hutang,
                          selectedSales.limitHutang
                        )} relative overflow-hidden`}
                        style={{
                          width: `${getHutangPercentage(
                            selectedSales.hutang,
                            selectedSales.limitHutang
                          )}%`,
                        }}
                      >
                        <div className="absolute inset-0 bg-white opacity-30 animate-pulse"></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Sisa Limit:</span>
                      <span className="text-lg font-bold text-blue-600">
                        {formatRupiah(
                          selectedSales.limitHutang - selectedSales.hutang
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">
                        Tanggal Daftar
                      </p>
                    </div>
                    <p className="text-gray-900 font-semibold">
                      {formatDate(selectedSales.createdAt)}
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
                      {formatDate(selectedSales.updatedAt)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedSales(null)}
                  className="w-full mt-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-4 rounded-xl transition-all font-bold text-base shadow-lg hover:shadow-xl"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Sales Modal */}
        {showAddModal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={() => setShowAddModal(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                      <Plus className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white">
                      Tambah Sales Baru
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="text-white hover:bg-white/20 p-3 rounded-xl transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmitAdd} className="p-8">
                <div className="space-y-5">
                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      NIK <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="nik"
                      value={formData.nik}
                      onChange={handleInputChange}
                      className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                      placeholder="Masukkan NIK (16 digit)"
                      maxLength={16}
                      required
                    />
                  </div>

                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      Nama Supplier <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="namaSales"
                      value={formData.namaSales}
                      onChange={handleInputChange}
                      className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                      placeholder="Masukkan nama supplier"
                      required
                    />
                  </div>

                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      Alamat <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="alamat"
                      value={formData.alamat}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none resize-none transition-all group-hover:border-gray-300"
                      placeholder="Masukkan alamat lengkap"
                      required
                    />
                  </div>

                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                      <Phone className="w-4 h-4 text-blue-600" />
                      Nomor HP <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="noHp"
                      value={formData.noHp}
                      onChange={handleInputChange}
                      className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                      placeholder="Contoh: 081234567890"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        Limit Hutang
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          name="limitHutang"
                          value={
                            formData.limitHutang
                              ? parseInt(formData.limitHutang).toLocaleString(
                                  "id-ID"
                                )
                              : ""
                          }
                          onChange={handleInputChange}
                          className="w-full pl-12 pr-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <TrendingDown className="w-4 h-4 text-red-600" />
                        Hutang Awal
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          name="hutang"
                          value={
                            formData.hutang
                              ? parseInt(formData.hutang).toLocaleString(
                                  "id-ID"
                                )
                              : ""
                          }
                          onChange={handleInputChange}
                          className="w-full pl-12 pr-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-4 rounded-xl transition-all font-bold shadow-md hover:shadow-lg"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-4 rounded-xl transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Simpan Sales
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Sales Modal */}
        {showEditModal && editingSales && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={() => setShowEditModal(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-gradient-to-br from-yellow-500 via-yellow-600 to-orange-600 p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                      <Edit className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-white">
                      Edit Sales
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-white hover:bg-white/20 p-3 rounded-xl transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmitEdit} className="p-8">
                <div className="space-y-5">
                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                      <CreditCard className="w-4 h-4 text-yellow-600" />
                      NIK <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="nik"
                      value={editingSales.data.nik}
                      onChange={handleEditInputChange}
                      className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                      placeholder="Masukkan NIK (16 digit)"
                      maxLength={16}
                      required
                    />
                  </div>

                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                      <Building2 className="w-4 h-4 text-yellow-600" />
                      Nama Supplier <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="namaSales"
                      value={editingSales.data.namaSales}
                      onChange={handleEditInputChange}
                      className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                      placeholder="Masukkan nama supplier"
                      required
                    />
                  </div>

                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                      <MapPin className="w-4 h-4 text-yellow-600" />
                      Alamat <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="alamat"
                      value={editingSales.data.alamat}
                      onChange={handleEditInputChange}
                      rows={3}
                      className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none resize-none transition-all group-hover:border-gray-300"
                      placeholder="Masukkan alamat lengkap"
                      required
                    />
                  </div>

                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                      <Phone className="w-4 h-4 text-yellow-600" />
                      Nomor HP <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="noHp"
                      value={editingSales.data.noHp}
                      onChange={handleEditInputChange}
                      className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                      placeholder="Contoh: 081234567890"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        Limit Hutang
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          name="limitHutang"
                          value={
                            editingSales.data.limitHutang
                              ? parseInt(
                                  editingSales.data.limitHutang
                                ).toLocaleString("id-ID")
                              : ""
                          }
                          onChange={handleEditInputChange}
                          className="w-full pl-12 pr-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <TrendingDown className="w-4 h-4 text-red-600" />
                        Hutang
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          name="hutang"
                          value={
                            editingSales.data.hutang
                              ? parseInt(
                                  editingSales.data.hutang
                                ).toLocaleString("id-ID")
                              : ""
                          }
                          onChange={handleEditInputChange}
                          className="w-full pl-12 pr-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-4 rounded-xl transition-all font-bold shadow-md hover:shadow-lg"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-6 py-4 rounded-xl transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Update Sales
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataSalesPage;
