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

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset pagination and fetch when search term changes
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
        // Search API
        url = `/api/customer/search/${encodeURIComponent(
          debouncedSearchTerm
        )}?page=${page}&limit=12`;
      } else {
        // Regular API with pagination
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

  // Infinite scroll observer
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
        // Reset and refresh data
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
        // Update the customer in the list
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
        // Remove from list
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

  const getTotalPiutang = (): number => {
    return customerList.reduce((sum, customer) => sum + customer.piutang, 0);
  };

  const getTotalLimitPiutang = (): number => {
    return customerList.reduce(
      (sum, customer) => sum + customer.limit_piutang,
      0
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto pb-8">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: "#333", color: "#fff" },
          success: { style: { background: "#22c55e" } },
          error: { style: { background: "#ef4444" } },
        }}
      />

      {/* Header Section */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Data Customer
            </h1>
            <p className="text-blue-100">Kelola informasi pelanggan dan toko</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-white hover:bg-blue-50 text-blue-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
            >
              <Plus className="w-4 h-4" />
              Tambah Customer
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">
                Total Customer
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {pagination.totalCount}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Toko</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {pagination.totalCount}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Store className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Piutang</p>
              <p
                className="text-lg font-bold text-red-600 mt-1 cursor-help"
                title={formatRupiah(getTotalPiutang())}
              >
                {formatRupiahSimple(getTotalPiutang())}
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <Wallet className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">
                Total Limit Piutang
              </p>
              <p
                className="text-lg font-bold text-green-600 mt-1 cursor-help"
                title={formatRupiah(getTotalLimitPiutang())}
              >
                {formatRupiahSimple(getTotalLimitPiutang())}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-lg p-4 mb-6 shadow-md border border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Cari nama customer, NIK, nama toko, alamat, atau nomor HP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {debouncedSearchTerm && (
          <p className="text-sm text-gray-500 mt-2">
            Menampilkan hasil pencarian untuk:{" "}
            <span className="font-semibold">"{debouncedSearchTerm}"</span>
          </p>
        )}
      </div>

      {/* Customer Cards Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-500">Memuat data customer...</p>
          </div>
        </div>
      ) : customerList.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md border border-gray-100 p-12 text-center">
          <p className="text-gray-500">
            {debouncedSearchTerm
              ? `Tidak ada customer ditemukan untuk "${debouncedSearchTerm}"`
              : "Tidak ada data customer"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customerList.map((customer) => (
              <div
                key={customer.id}
                className="bg-white rounded-xl shadow-md border border-gray-100 hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                {/* Card Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
                  <h3 className="text-lg font-bold text-white mb-1">
                    {customer.nama}
                  </h3>
                  <div className="flex items-center gap-2 text-blue-100 text-sm">
                    <Store className="w-4 h-4" />
                    <span className="truncate">{customer.namaToko}</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5">
                  {/* NIK */}
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-500 font-medium">
                        NIK
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 font-mono pl-6">
                      {formatNIK(customer.nik)}
                    </p>
                  </div>

                  {/* Piutang Info */}
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-500 font-medium">
                          Piutang
                        </span>
                      </div>
                      <span
                        className="text-sm font-bold text-red-600 cursor-help"
                        title={formatRupiah(customer.piutang)}
                      >
                        {formatRupiahSimple(customer.piutang)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-500 font-medium">
                          Limit Piutang
                        </span>
                      </div>
                      <span
                        className="text-sm font-bold text-green-600 cursor-help"
                        title={formatRupiah(customer.limit_piutang)}
                      >
                        {formatRupiahSimple(customer.limit_piutang)}
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${getPiutangColor(
                            customer.piutang,
                            customer.limit_piutang
                          )}`}
                          style={{
                            width: `${getPiutangPercentage(
                              customer.piutang,
                              customer.limit_piutang
                            )}%`,
                          }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 text-right">
                        {getPiutangPercentage(
                          customer.piutang,
                          customer.limit_piutang
                        ).toFixed(1)}
                        % dari limit
                      </p>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {customer.alamat}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <p className="text-sm text-gray-600 font-medium">
                        {formatPhoneNumber(customer.noHp)}
                      </p>
                    </div>
                  </div>

                  {/* Date Info */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Terdaftar</span>
                      <span className="font-medium">
                        {formatDate(customer.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleEdit(customer)}
                      className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg transition-all font-medium text-sm flex items-center justify-center gap-1"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(customer.id, customer.nama)}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg transition-all font-medium text-sm flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Hapus
                    </button>
                  </div>
                  <button
                    onClick={() => setSelectedCustomer(customer)}
                    className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all font-medium text-sm"
                  >
                    Lihat Detail
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Infinite Scroll Trigger */}
          <div ref={observerTarget} className="mt-8">
            {loadingMore && (
              <div className="flex justify-center items-center py-8">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    Memuat lebih banyak...
                  </p>
                </div>
              </div>
            )}
            {!pagination.hasMore && customerList.length > 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">
                  Semua data telah ditampilkan
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Footer Info */}
      <div className="mt-6 text-center text-sm text-gray-500">
        Menampilkan {customerList.length} dari {pagination.totalCount} customer
        {debouncedSearchTerm && " (hasil pencarian)"}
      </div>

      {/* Detail Modal */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCustomer(null)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Detail Customer</h2>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="text-sm text-gray-500 mb-1 font-medium">
                  Nama Customer
                </p>
                <p className="text-gray-900 text-lg font-semibold">
                  {selectedCustomer.nama}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1 font-medium">NIK</p>
                <p className="text-gray-900 font-mono">
                  {formatNIK(selectedCustomer.nik)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1 font-medium">
                  Nama Toko
                </p>
                <p className="text-gray-900 text-lg">
                  {selectedCustomer.namaToko}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1 font-medium">Alamat</p>
                <p className="text-gray-900">{selectedCustomer.alamat}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1 font-medium">
                  Nomor HP
                </p>
                <p className="text-gray-900">
                  {formatPhoneNumber(selectedCustomer.noHp)}
                </p>
              </div>

              {/* Piutang Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Informasi Piutang
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Piutang</p>
                    <p className="text-xl font-bold text-red-600">
                      {formatRupiah(selectedCustomer.piutang)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatRupiahSimple(selectedCustomer.piutang)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Limit Piutang</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatRupiah(selectedCustomer.limit_piutang)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatRupiahSimple(selectedCustomer.limit_piutang)}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">Penggunaan Limit</span>
                    <span className="font-medium">
                      {getPiutangPercentage(
                        selectedCustomer.piutang,
                        selectedCustomer.limit_piutang
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${getPiutangColor(
                        selectedCustomer.piutang,
                        selectedCustomer.limit_piutang
                      )}`}
                      style={{
                        width: `${getPiutangPercentage(
                          selectedCustomer.piutang,
                          selectedCustomer.limit_piutang
                        )}%`,
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Sisa Limit:{" "}
                    <span className="font-semibold text-gray-900">
                      {formatRupiah(
                        selectedCustomer.limit_piutang -
                          selectedCustomer.piutang
                      )}
                    </span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <p className="text-sm text-gray-500 mb-1 font-medium">
                    Tanggal Daftar
                  </p>
                  <p className="text-gray-900">
                    {formatDate(selectedCustomer.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1 font-medium">
                    Terakhir Update
                  </p>
                  <p className="text-gray-900">
                    {formatDate(selectedCustomer.updatedAt)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="w-full mt-6 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg transition-all font-medium"
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
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                Tambah Customer Baru
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    NIK <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nik"
                    value={formData.nik}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                    placeholder="Masukkan NIK (16 digit)"
                    maxLength={16}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nama Customer <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nama"
                    value={formData.nama}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                    placeholder="Masukkan nama lengkap"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nama Toko <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="namaToko"
                    value={formData.namaToko}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                    placeholder="Masukkan nama toko"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Alamat <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="alamat"
                    value={formData.alamat}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none resize-none"
                    placeholder="Masukkan alamat lengkap"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nomor HP <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="noHp"
                    value={formData.noHp}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                    placeholder="Contoh: 081234567890"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Limit Piutang
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
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
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Piutang Awal
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                        Rp
                      </span>
                      <input
                        type="text"
                        name="piutang"
                        value={
                          formData.piutang
                            ? parseInt(formData.piutang).toLocaleString("id-ID")
                            : ""
                        }
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg transition-all font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-3 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditModal && editingCustomer && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Edit Customer</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    NIK <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nik"
                    value={editingCustomer.data.nik}
                    onChange={handleEditInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                    placeholder="Masukkan NIK (16 digit)"
                    maxLength={16}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nama Customer <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nama"
                    value={editingCustomer.data.nama}
                    onChange={handleEditInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                    placeholder="Masukkan nama lengkap"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nama Toko <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="namaToko"
                    value={editingCustomer.data.namaToko}
                    onChange={handleEditInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                    placeholder="Masukkan nama toko"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Alamat <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="alamat"
                    value={editingCustomer.data.alamat}
                    onChange={handleEditInputChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none resize-none"
                    placeholder="Masukkan alamat lengkap"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nomor HP <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="noHp"
                    value={editingCustomer.data.noHp}
                    onChange={handleEditInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                    placeholder="Contoh: 081234567890"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Limit Piutang
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
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
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Piutang
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
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
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg transition-all font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-4 py-3 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Menyimpan..." : "Update Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataCustomerPage;
