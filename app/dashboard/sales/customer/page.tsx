"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Users,
  RefreshCw,
  Phone,
  MapPin,
  Store,
  CreditCard,
  Plus,
  X,
  Loader2,
  Filter,
  Eye,
  Calendar,
  AlertCircle,
  CheckCircle,
  Activity,
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
    null,
  );
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<
    "all" | "high" | "medium" | "low" | "hutang" | "tanpaHutang"
  >("all");
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 12,
    hasMore: false,
  });
  const [formData, setFormData] = useState<CustomerFormData>({
    nik: "",
    nama: "",
    alamat: "",
    namaToko: "",
    noHp: "",
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
    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      let url: string;
      if (debouncedSearchTerm.trim()) {
        url = `/api/customer/search/${encodeURIComponent(debouncedSearchTerm)}?page=${page}&limit=12`;
      } else {
        url = `/api/customer?page=${page}&limit=12`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        if (reset) setCustomerList(data.data);
        else setCustomerList((prev) => [...prev, ...data.data]);
        setPagination(data.pagination);
      }
    } catch (error) {
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
      { threshold: 0.1 },
    );
    const currentTarget = observerTarget.current;
    if (currentTarget) observer.observe(currentTarget);
    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [pagination, loading, loadingMore]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const submitData = { ...formData };
      const res = await fetch("/api/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        });
        setCustomerList([]);
        setPagination((prev) => ({ ...prev, currentPage: 1 }));
        fetchCustomer(1, true);
      } else {
        toast.error(data.error || "Gagal menambahkan customer");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan saat menambahkan customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefresh = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setCustomerList([]);
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    fetchCustomer(1, true);
  };

  const formatPhoneNumber = (phone: string): string =>
    phone.replace(/(\d{4})(\d{4})(\d+)/, "$1-$2-$3");

  const formatNIK = (nik: string): string =>
    nik.replace(/(\d{6})(\d{6})(\d{4})/, "$1-$2-$3");

  const formatDate = (dateString: string): string =>
    new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(dateString));

  const getPiutangPercentage = (piutang: number, limit: number): number => {
    if (limit === 0) return 0;
    return Math.min((piutang / limit) * 100, 100);
  };

  const getPiutangStatus = (
    piutang: number,
    limit: number,
  ): { color: string; label: string } => {
    const p = getPiutangPercentage(piutang, limit);
    if (p >= 90) return { color: "text-red-600", label: "Kritis" };
    if (p >= 70) return { color: "text-yellow-600", label: "Peringatan" };
    return { color: "text-green-600", label: "Aman" };
  };

  const filteredCustomers = customerList.filter((customer) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "hutang") return customer.piutang > 0;
    if (filterStatus === "tanpaHutang") return customer.piutang <= 0;
    const p = getPiutangPercentage(customer.piutang, customer.limit_piutang);
    if (filterStatus === "high") return p >= 90;
    if (filterStatus === "medium") return p >= 70 && p < 90;
    if (filterStatus === "low") return p < 70;
    return true;
  });

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="w-full px-4 sm:px-6 pb-8">
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
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 sm:p-8 mb-6 sm:mb-8 shadow-2xl mt-3">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24 pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur-sm p-3 sm:p-4 rounded-xl shrink-0">
                <Users className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
                  Data Customer
                </h1>
                <p className="text-blue-100 text-sm sm:text-lg">
                  Kelola informasi pelanggan dan toko Anda
                </p>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setShowAddModal(true)}
                className="group bg-white hover:bg-blue-50 text-blue-600 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl flex items-center gap-2 transition-all font-semibold shadow-lg hover:shadow-xl hover:scale-105 transform text-sm sm:text-base"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-90 transition-transform" />
                Tambah Customer
              </button>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg text-sm sm:text-base"
              >
                <RefreshCw
                  className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-6 mb-6 sm:mb-8">
          {[
            {
              label: "Total Customer",
              value: pagination.totalCount,
              sub: "Pelanggan terdaftar",
              icon: <Users className="w-6 h-6 sm:w-8 sm:h-8 text-white" />,
              color: "from-blue-500 to-blue-600",
              textColor: "text-gray-900",
              valueText: pagination.totalCount.toString(),
            },
            {
              label: "Total Toko",
              value: pagination.totalCount,
              sub: "Toko aktif",
              icon: <Store className="w-6 h-6 sm:w-8 sm:h-8 text-white" />,
              color: "from-purple-500 to-purple-600",
              textColor: "text-gray-900",
              valueText: pagination.totalCount.toString(),
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="group bg-white rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-gray-500 text-[10px] sm:text-sm font-semibold uppercase tracking-wide mb-1 truncate">
                    {stat.label}
                  </p>
                  <p
                    className={`text-xl sm:text-3xl font-bold mt-1 sm:mt-2 ${stat.textColor}`}
                  >
                    {stat.valueText}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-400 mt-1 sm:mt-2 truncate">
                    {stat.sub}
                  </p>
                </div>
                <div
                  className={`bg-gradient-to-br ${stat.color} p-2.5 sm:p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform shrink-0 ml-2`}
                >
                  {stat.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-lg border border-gray-100">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari nama, NIK, toko, alamat, atau HP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all text-sm"
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
            <div className="flex gap-2 sm:gap-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none bg-white text-sm"
              >
                <option value="all">Semua Status</option>
                <option value="high">Risiko Tinggi</option>
                <option value="medium">Risiko Sedang</option>
                <option value="low">Risiko Rendah</option>
                <option value="hutang">Dengan Hutang</option>
                <option value="tanpaHutang">Tanpa Hutang</option>
              </select>
              <button className="px-3 sm:px-4 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-600" />
                <span className="hidden lg:inline text-gray-700 font-medium text-sm">
                  Filter
                </span>
              </button>
            </div>
          </div>
          {debouncedSearchTerm && (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-4 py-2 rounded-lg">
              <Search className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Hasil untuk:{" "}
                <span className="font-semibold text-blue-700">
                  "{debouncedSearchTerm}"
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Customer Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="text-center">
              <div className="relative">
                <div className="w-24 h-24 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
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
                ? `Tidak ada customer untuk "${debouncedSearchTerm}"`
                : "Tidak ada data customer"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {filteredCustomers.map((customer) => {
                const status = getPiutangStatus(
                  customer.piutang,
                  customer.limit_piutang,
                );
                return (
                  <div
                    key={customer.id}
                    className="group bg-white rounded-xl shadow-md border border-gray-100 hover:shadow-xl transition-all duration-300 overflow-hidden hover:-translate-y-1"
                  >
                    {/* Card Header */}
                    <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-4">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full -mr-12 -mt-12 pointer-events-none" />
                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-base font-bold text-white pr-2 line-clamp-1">
                            {customer.nama}
                          </h3>
                          <div
                            className={`px-2 py-1 rounded-full text-[10px] font-semibold shrink-0 ${status.color === "text-red-600" ? "bg-red-100 text-red-700" : status.color === "text-yellow-600" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}
                          >
                            {status.label}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-blue-100 text-xs">
                          <Store className="w-3 h-3 shrink-0" />
                          <span className="truncate font-medium">
                            {customer.namaToko}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4">
                      {/* NIK */}
                      <div className="mb-3 pb-3 border-b border-gray-100">
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

                      {/* Contact */}
                      <div className="space-y-2 mb-3">
                        <div className="flex items-start gap-2">
                          <div className="bg-gray-100 p-1.5 rounded-lg shrink-0">
                            <MapPin className="w-3 h-3 text-gray-600" />
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                            {customer.alamat}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="bg-gray-100 p-1.5 rounded-lg shrink-0">
                            <Phone className="w-3 h-3 text-gray-600" />
                          </div>
                          <p className="text-xs text-gray-700 font-semibold">
                            {formatPhoneNumber(customer.noHp)}
                          </p>
                        </div>
                      </div>

                      {/* Date */}
                      <div className="mb-3 pt-3 border-t border-gray-100">
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

                      {/* Action: only view detail */}
                      <button
                        onClick={() => setSelectedCustomer(customer)}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-3 py-2 rounded-lg transition-all font-semibold text-xs shadow-md hover:shadow-lg flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Lihat Detail
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Infinite scroll trigger */}
            <div ref={observerTarget} className="mt-10">
              {loadingMore && (
                <div className="flex justify-center py-12">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
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

        {/* Footer */}
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
            onClick={() => setSelectedCustomer(null)}
          >
            <div
              className="bg-white w-full sm:max-w-3xl sm:rounded-2xl rounded-t-3xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-6 sm:p-8 rounded-t-3xl sm:rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="bg-white/20 backdrop-blur-sm p-2.5 sm:p-3 rounded-xl">
                      <Eye className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    </div>
                    <h2 className="text-xl sm:text-3xl font-bold text-white">
                      Detail Customer
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-white hover:bg-white/20 p-2.5 sm:p-3 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>
              <div className="p-5 sm:p-8 space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 sm:p-5">
                    <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1.5">
                      Nama Customer
                    </p>
                    <p className="text-gray-900 text-lg sm:text-xl font-bold">
                      {selectedCustomer.nama}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 sm:p-5">
                    <p className="text-xs text-purple-600 font-bold uppercase tracking-wider mb-1.5">
                      Nama Toko
                    </p>
                    <p className="text-gray-900 text-lg sm:text-xl font-bold">
                      {selectedCustomer.namaToko}
                    </p>
                  </div>
                </div>
                {[
                  {
                    icon: <CreditCard className="w-5 h-5 text-gray-600" />,
                    label: "NIK",
                    value: formatNIK(selectedCustomer.nik),
                    mono: true,
                  },
                  {
                    icon: <MapPin className="w-5 h-5 text-gray-600" />,
                    label: "Alamat",
                    value: selectedCustomer.alamat,
                  },
                  {
                    icon: <Phone className="w-5 h-5 text-gray-600" />,
                    label: "Nomor HP",
                    value: formatPhoneNumber(selectedCustomer.noHp),
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 sm:p-5"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-white p-2 rounded-lg">{item.icon}</div>
                      <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">
                        {item.label}
                      </p>
                    </div>
                    <p
                      className={`text-gray-900 font-semibold pl-11 ${item.mono ? "font-mono text-base sm:text-lg" : "leading-relaxed"}`}
                    >
                      {item.value}
                    </p>
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {[
                    {
                      label: "Tanggal Daftar",
                      value: formatDate(selectedCustomer.createdAt),
                    },
                    {
                      label: "Terakhir Update",
                      value: formatDate(selectedCustomer.updatedAt),
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 sm:p-4"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Calendar className="w-4 h-4 text-gray-600" />
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">
                          {item.label}
                        </p>
                      </div>
                      <p className="text-gray-900 font-semibold text-sm">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-3 sm:py-4 rounded-xl transition-all font-bold shadow-lg hover:shadow-xl"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
            onClick={() => setShowAddModal(false)}
          >
            <div
              className="bg-white w-full sm:max-w-3xl sm:rounded-2xl rounded-t-3xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-6 sm:p-8 rounded-t-3xl sm:rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="bg-white/20 backdrop-blur-sm p-2.5 sm:p-3 rounded-xl">
                      <Plus className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    </div>
                    <h2 className="text-xl sm:text-3xl font-bold text-white">
                      Tambah Customer Baru
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="text-white hover:bg-white/20 p-2.5 sm:p-3 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmitAdd} className="p-5 sm:p-8">
                <div className="space-y-4 sm:space-y-5">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2 sm:mb-3 uppercase tracking-wide">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      NIK <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="nik"
                      value={formData.nik}
                      onChange={handleInputChange}
                      className="w-full px-4 sm:px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all text-sm"
                      placeholder="Masukkan NIK (16 digit)"
                      maxLength={16}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2 sm:mb-3 uppercase tracking-wide">
                        <Users className="w-4 h-4 text-blue-600" />
                        Nama <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="nama"
                        value={formData.nama}
                        onChange={handleInputChange}
                        className="w-full px-4 sm:px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all text-sm"
                        placeholder="Nama lengkap"
                        required
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2 sm:mb-3 uppercase tracking-wide">
                        <Store className="w-4 h-4 text-blue-600" />
                        Toko <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="namaToko"
                        value={formData.namaToko}
                        onChange={handleInputChange}
                        className="w-full px-4 sm:px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all text-sm"
                        placeholder="Nama toko"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2 sm:mb-3 uppercase tracking-wide">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      Alamat <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="alamat"
                      value={formData.alamat}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-4 sm:px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none resize-none transition-all text-sm"
                      placeholder="Alamat lengkap"
                      required
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2 sm:mb-3 uppercase tracking-wide">
                      <Phone className="w-4 h-4 text-blue-600" />
                      Nomor HP <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="noHp"
                      value={formData.noHp}
                      onChange={handleInputChange}
                      className="w-full px-4 sm:px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all text-sm"
                      placeholder="Contoh: 081234567890"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6 sm:mt-8">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 sm:px-6 py-3 sm:py-4 rounded-xl transition-all font-bold shadow-md hover:shadow-lg text-sm sm:text-base"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base"
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
      </div>
    </div>
  );
};

export default DataCustomerPage;
