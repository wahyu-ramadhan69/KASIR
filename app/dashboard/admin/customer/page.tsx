"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Users,
  RefreshCw,
  Phone,
  MapPin,
  Store,
  CreditCard,
  Plus,
  Edit,
  Trash2,
  X,
  Wallet,
  TrendingUp,
  Loader2,
  Filter,
  Download,
  Upload,
  Eye,
  Calendar,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  TrendingDown,
  DollarSign,
  Activity,
  BarChart3,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface Customer {
  id: number;
  nik: string;
  nama: string;
  alamat: string;
  namaToko: string;
  noHp: string;
  limit_piutang: number;
  piutang: number;
  createdAt: string;
  updatedAt: string;
}

interface CustomerFormData {
  nik: string;
  nama: string;
  alamat: string;
  namaToko: string;
  noHp: string;
  limit_piutang: string;
  piutang: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasMore: boolean;
}

const DataCustomerPage = () => {
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "high" | "medium" | "low" | "hutang" | "tanpaHutang"
  >("all");
  const [sortBy, setSortBy] = useState<"name" | "piutang" | "limit" | "date">(
    "name"
  );
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 12,
    hasMore: false,
  });
  const [editingCustomer, setEditingCustomer] = useState<{
    id: number;
    data: CustomerFormData;
  } | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>({
    nik: "",
    nama: "",
    alamat: "",
    namaToko: "",
    noHp: "",
    limit_piutang: "",
    piutang: "",
  });

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCustomerList([]);
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    fetchCustomer(1, true);
  }, [debouncedSearchTerm]);

  const fetchCustomer = async (page: number = 1, reset: boolean = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let url: string;

      if (debouncedSearchTerm.trim()) {
        url = `/api/customer/search/${encodeURIComponent(
          debouncedSearchTerm
        )}?page=${page}&limit=12`;
      } else {
        url = `/api/customer?page=${page}&limit=12`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        if (reset) {
          setCustomerList(data.data);
        } else {
          setCustomerList((prev) => [...prev, ...data.data]);
        }
        setPagination(data.pagination);
      } else {
        console.error("Failed to fetch data");
      }
    } catch (error) {
      console.error("Error fetching customer:", error);
      toast.error("Gagal mengambil data customer");
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
          fetchCustomer(pagination.currentPage + 1, false);
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

    if (name === "limit_piutang" || name === "piutang") {
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
    if (editingCustomer) {
      if (name === "limit_piutang" || name === "piutang") {
        setEditingCustomer({
          ...editingCustomer,
          data: {
            ...editingCustomer.data,
            [name]: parseRupiahInput(value),
          },
        });
      } else {
        setEditingCustomer({
          ...editingCustomer,
          data: {
            ...editingCustomer.data,
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
        limit_piutang: formData.limit_piutang || "0",
        piutang: formData.piutang || "0",
      };

      const res = await fetch("/api/customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Customer berhasil ditambahkan!");
        setShowAddModal(false);
        setFormData({
          nik: "",
          nama: "",
          alamat: "",
          namaToko: "",
          noHp: "",
          limit_piutang: "",
          piutang: "",
        });
        setCustomerList([]);
        setPagination((prev) => ({ ...prev, currentPage: 1 }));
        fetchCustomer(1, true);
      } else {
        toast.error(data.error || "Gagal menambahkan customer");
      }
    } catch (error) {
      console.error("Error adding customer:", error);
      toast.error("Terjadi kesalahan saat menambahkan customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer({
      id: customer.id,
      data: {
        nik: customer.nik,
        nama: customer.nama,
        alamat: customer.alamat,
        namaToko: customer.namaToko,
        noHp: customer.noHp,
        limit_piutang: customer.limit_piutang.toString(),
        piutang: customer.piutang.toString(),
      },
    });
    setShowEditModal(true);
  };

  const handleSubmitEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCustomer) return;

    setIsSubmitting(true);

    try {
      const submitData = {
        ...editingCustomer.data,
        limit_piutang: editingCustomer.data.limit_piutang || "0",
        piutang: editingCustomer.data.piutang || "0",
      };

      const res = await fetch(`/api/customer/${editingCustomer.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Customer berhasil diupdate!");
        setShowEditModal(false);
        setEditingCustomer(null);
        setCustomerList((prev) =>
          prev.map((c) => (c.id === data.data.id ? data.data : c))
        );
      } else {
        toast.error(data.error || "Gagal mengupdate customer");
      }
    } catch (error) {
      console.error("Error updating customer:", error);
      toast.error("Terjadi kesalahan saat mengupdate customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus customer "${nama}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/customer/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Customer berhasil dihapus!");
        setCustomerList((prev) => prev.filter((c) => c.id !== id));
        setPagination((prev) => ({
          ...prev,
          totalCount: prev.totalCount - 1,
        }));
      } else {
        toast.error(data.error || "Gagal menghapus customer");
      }
    } catch (error) {
      console.error("Error deleting customer:", error);
      toast.error("Terjadi kesalahan saat menghapus customer");
    }
  };

  const handleRefresh = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setCustomerList([]);
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    fetchCustomer(1, true);
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

  const getPiutangPercentage = (piutang: number, limit: number): number => {
    if (limit === 0) return 0;
    return Math.min((piutang / limit) * 100, 100);
  };

  const getPiutangColor = (piutang: number, limit: number): string => {
    const percentage = getPiutangPercentage(piutang, limit);
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getPiutangStatus = (
    piutang: number,
    limit: number
  ): { icon: React.ReactNode; color: string; label: string } => {
    const percentage = getPiutangPercentage(piutang, limit);
    if (percentage >= 90)
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        color: "text-red-600",
        label: "Kritis",
      };
    if (percentage >= 70)
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        color: "text-yellow-600",
        label: "Peringatan",
      };
    return {
      icon: <CheckCircle className="w-4 h-4" />,
      color: "text-green-600",
      label: "Aman",
    };
  };

  const getTotalPiutang = (): number => {
    return customerList.reduce((sum, customer) => sum + customer.piutang, 0);
  };

  const getTotalLimitPiutang = (): number => {
    return customerList.reduce(
      (sum, customer) => sum + customer.limit_piutang,
      0
    );
  };

  const getHighRiskCustomers = (): number => {
    return customerList.filter(
      (c) => getPiutangPercentage(c.piutang, c.limit_piutang) >= 90
    ).length;
  };

  const filteredCustomers = customerList.filter((customer) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "hutang") return customer.piutang > 0;
    if (filterStatus === "tanpaHutang") return customer.piutang <= 0;
    const percentage = getPiutangPercentage(
      customer.piutang,
      customer.limit_piutang
    );
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
                <Users className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                  Data Customer
                </h1>
                <p className="text-blue-100 text-lg">
                  Kelola informasi pelanggan dan toko Anda
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="group bg-white hover:bg-blue-50 text-blue-600 px-6 py-3 rounded-xl flex items-center gap-2 transition-all font-semibold shadow-lg hover:shadow-xl hover:scale-105 transform"
              >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                Tambah Customer
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
                  Total Customer
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {pagination.totalCount}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Pelanggan terdaftar
                </p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Total Toko
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {pagination.totalCount}
                </p>
                <p className="text-xs text-gray-400 mt-2">Toko aktif</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <Store className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Total Piutang
                </p>
                <p
                  className="text-2xl font-bold text-red-600 mt-2 cursor-help"
                  title={formatRupiah(getTotalPiutang())}
                >
                  {formatRupiahSimple(getTotalPiutang())}
                </p>
                <p className="text-xs text-red-400 mt-2">Piutang aktif</p>
              </div>
              <div className="bg-gradient-to-br from-red-500 to-red-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <Wallet className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Limit Piutang
                </p>
                <p
                  className="text-2xl font-bold text-green-600 mt-2 cursor-help"
                  title={formatRupiah(getTotalLimitPiutang())}
                >
                  {formatRupiahSimple(getTotalLimitPiutang())}
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
                placeholder="Cari nama customer, NIK, nama toko, alamat, atau nomor HP..."
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
                <option value="hutang">Customer dengan Hutang</option>
                <option value="tanpaHutang">Customer Tanpa Hutang</option>
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

        {/* Customer Cards Grid - 4 columns */}
        {loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="text-center">
              <div className="relative">
                <div className="w-24 h-24 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                <Users className="w-10 h-10 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-gray-500 mt-6 text-lg font-medium">
                Memuat data customer...
              </p>
            </div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-16 text-center">
            <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-12 h-12 text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg font-medium">
              {debouncedSearchTerm
                ? `Tidak ada customer ditemukan untuk "${debouncedSearchTerm}"`
                : "Tidak ada data customer"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredCustomers.map((customer) => {
                const status = getPiutangStatus(
                  customer.piutang,
                  customer.limit_piutang
                );
                return (
                  <div
                    key={customer.id}
                    className="group bg-white rounded-xl shadow-md border border-gray-100 hover:shadow-xl transition-all duration-300 overflow-hidden hover:-translate-y-1"
                  >
                    {/* Card Header */}
                    <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-4">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full -mr-12 -mt-12"></div>
                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-base font-bold text-white pr-2 line-clamp-1">
                            {customer.nama}
                          </h3>
                          <div
                            className={`px-2 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1 flex-shrink-0 ${
                              status.color === "text-red-600"
                                ? "bg-red-100 text-red-700"
                                : status.color === "text-yellow-600"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            <span className="w-3 h-3">{status.icon}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-blue-100 text-xs">
                          <Store className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate font-medium">
                            {customer.namaToko}
                          </span>
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
                          {formatNIK(customer.nik)}
                        </p>
                      </div>

                      {/* Piutang Info */}
                      <div className="mb-3 pb-3 border-b border-gray-200">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              <div className="bg-red-100 p-1.5 rounded-lg">
                                <Wallet className="w-3 h-3 text-red-600" />
                              </div>
                              <span className="text-[10px] text-gray-500 font-semibold uppercase">
                                Piutang
                              </span>
                            </div>
                            <span
                              className="text-xs font-bold text-red-600 cursor-help"
                              title={formatRupiah(customer.piutang)}
                            >
                              {formatRupiahSimple(customer.piutang)}
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
                              title={formatRupiah(customer.limit_piutang)}
                            >
                              {formatRupiahSimple(customer.limit_piutang)}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-gray-600 mb-1 font-semibold">
                            <span>Penggunaan</span>
                            <span className={status.color}>
                              {getPiutangPercentage(
                                customer.piutang,
                                customer.limit_piutang
                              ).toFixed(1)}
                              %
                            </span>
                          </div>
                          <div className="relative w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${getPiutangColor(
                                customer.piutang,
                                customer.limit_piutang
                              )} relative overflow-hidden`}
                              style={{
                                width: `${getPiutangPercentage(
                                  customer.piutang,
                                  customer.limit_piutang
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
                            {customer.alamat}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 group/item">
                          <div className="bg-gray-100 p-1.5 rounded-lg group-hover/item:bg-blue-100 transition-colors flex-shrink-0">
                            <Phone className="w-3 h-3 text-gray-600 group-hover/item:text-blue-600 transition-colors" />
                          </div>
                          <p className="text-xs text-gray-700 font-semibold">
                            {formatPhoneNumber(customer.noHp)}
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
                            {formatDate(customer.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="group/btn bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-2 py-2 rounded-lg transition-all font-semibold text-xs flex items-center justify-center gap-1 shadow-md hover:shadow-lg"
                        >
                          <Edit className="w-3 h-3 group-hover/btn:rotate-12 transition-transform" />
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            handleDelete(customer.id, customer.nama)
                          }
                          className="group/btn bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-2 py-2 rounded-lg transition-all font-semibold text-xs flex items-center justify-center gap-1 shadow-md hover:shadow-lg"
                        >
                          <Trash2 className="w-3 h-3 group-hover/btn:scale-110 transition-transform" />
                          Hapus
                        </button>
                      </div>

                      <button
                        onClick={() => setSelectedCustomer(customer)}
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
              {!pagination.hasMore && customerList.length > 0 && (
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
                {filteredCustomers.length}
              </span>{" "}
              dari{" "}
              <span className="font-bold text-gray-900">
                {pagination.totalCount}
              </span>{" "}
              customer
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
        {selectedCustomer && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={() => setSelectedCustomer(null)}
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
                      Detail Customer
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedCustomer(null)}
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
                      Nama Customer
                    </p>
                    <p className="text-gray-900 text-xl font-bold">
                      {selectedCustomer.nama}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5">
                    <p className="text-xs text-purple-600 font-bold uppercase tracking-wider mb-2">
                      Nama Toko
                    </p>
                    <p className="text-gray-900 text-xl font-bold">
                      {selectedCustomer.namaToko}
                    </p>
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
                    {formatNIK(selectedCustomer.nik)}
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
                    {selectedCustomer.alamat}
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
                    {formatPhoneNumber(selectedCustomer.noHp)}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-200">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="bg-blue-600 p-3 rounded-xl">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">
                      Informasi Piutang
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="bg-white rounded-xl p-4 shadow-md">
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet className="w-4 h-4 text-red-600" />
                        <p className="text-xs text-gray-500 font-semibold uppercase">
                          Piutang
                        </p>
                      </div>
                      <p className="text-2xl font-bold text-red-600">
                        {formatRupiah(selectedCustomer.piutang)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatRupiahSimple(selectedCustomer.piutang)}
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
                        {formatRupiah(selectedCustomer.limit_piutang)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatRupiahSimple(selectedCustomer.limit_piutang)}
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
                          getPiutangStatus(
                            selectedCustomer.piutang,
                            selectedCustomer.limit_piutang
                          ).color
                        }`}
                      >
                        {getPiutangPercentage(
                          selectedCustomer.piutang,
                          selectedCustomer.limit_piutang
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                    <div className="relative w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-4 rounded-full transition-all duration-500 ${getPiutangColor(
                          selectedCustomer.piutang,
                          selectedCustomer.limit_piutang
                        )} relative overflow-hidden`}
                        style={{
                          width: `${getPiutangPercentage(
                            selectedCustomer.piutang,
                            selectedCustomer.limit_piutang
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
                          selectedCustomer.limit_piutang -
                            selectedCustomer.piutang
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
                      {formatDate(selectedCustomer.createdAt)}
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
                      {formatDate(selectedCustomer.updatedAt)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="w-full mt-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-4 rounded-xl transition-all font-bold text-base shadow-lg hover:shadow-xl"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Customer Modal */}
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
                      Tambah Customer Baru
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <Users className="w-4 h-4 text-blue-600" />
                        Nama Customer <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="nama"
                        value={formData.nama}
                        onChange={handleInputChange}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                        placeholder="Masukkan nama lengkap"
                        required
                      />
                    </div>

                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <Store className="w-4 h-4 text-blue-600" />
                        Nama Toko <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="namaToko"
                        value={formData.namaToko}
                        onChange={handleInputChange}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                        placeholder="Masukkan nama toko"
                        required
                      />
                    </div>
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
                        Limit Piutang
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          name="limit_piutang"
                          value={
                            formData.limit_piutang
                              ? parseInt(formData.limit_piutang).toLocaleString(
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
                        <Wallet className="w-4 h-4 text-red-600" />
                        Piutang Awal
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          name="piutang"
                          value={
                            formData.piutang
                              ? parseInt(formData.piutang).toLocaleString(
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
                        Simpan Customer
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Customer Modal */}
        {showEditModal && editingCustomer && (
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
                      Edit Customer
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
                      value={editingCustomer.data.nik}
                      onChange={handleEditInputChange}
                      className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                      placeholder="Masukkan NIK (16 digit)"
                      maxLength={16}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <Users className="w-4 h-4 text-yellow-600" />
                        Nama Customer <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="nama"
                        value={editingCustomer.data.nama}
                        onChange={handleEditInputChange}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                        placeholder="Masukkan nama lengkap"
                        required
                      />
                    </div>

                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <Store className="w-4 h-4 text-yellow-600" />
                        Nama Toko <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="namaToko"
                        value={editingCustomer.data.namaToko}
                        onChange={handleEditInputChange}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                        placeholder="Masukkan nama toko"
                        required
                      />
                    </div>
                  </div>

                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                      <MapPin className="w-4 h-4 text-yellow-600" />
                      Alamat <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="alamat"
                      value={editingCustomer.data.alamat}
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
                      value={editingCustomer.data.noHp}
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
                        Limit Piutang
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          name="limit_piutang"
                          value={
                            editingCustomer.data.limit_piutang
                              ? parseInt(
                                  editingCustomer.data.limit_piutang
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
                        <Wallet className="w-4 h-4 text-red-600" />
                        Piutang
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          name="piutang"
                          value={
                            editingCustomer.data.piutang
                              ? parseInt(
                                  editingCustomer.data.piutang
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
                        Update Customer
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

export default DataCustomerPage;
