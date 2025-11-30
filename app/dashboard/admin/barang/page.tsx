"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Package,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  X,
  Store,
  DollarSign,
  Box,
  AlertCircle,
  CheckCircle,
  Eye,
  Filter,
  Loader2,
  Calendar,
  Activity,
  BarChart3,
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
  jumlahPerkardus: number;
  ukuran: number;
  satuan: string;
  supplierId: number;
  createdAt: string;
  updatedAt: string;
  supplier: Supplier;
}

interface BarangFormData {
  namaBarang: string;
  hargaBeli: string;
  hargaJual: string;
  jumlahPerkardus: string;
  ukuran: string;
  satuan: string;
  supplierId: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasMore: boolean;
}

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
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedBarang, setSelectedBarang] = useState<Barang | null>(null);
  const [editingBarang, setEditingBarang] = useState<{
    id: number;
    data: BarangFormData;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState<string>("");
  const [showSupplierDropdown, setShowSupplierDropdown] =
    useState<boolean>(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [selectedSupplierName, setSelectedSupplierName] = useState<string>("");
  const [editSupplierSearch, setEditSupplierSearch] = useState<string>("");
  const [showEditSupplierDropdown, setShowEditSupplierDropdown] =
    useState<boolean>(false);
  const [addFormHargaBeli, setAddFormHargaBeli] = useState<string>("");
  const [addFormHargaJual, setAddFormHargaJual] = useState<string>("");
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 12,
    hasMore: false,
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
    fetchSuppliers();
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

  const fetchSuppliers = async () => {
    try {
      const res = await fetch("/api/supplier");
      const data = await res.json();
      if (data.success) {
        setSuppliersList(data.data);
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
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

  const handleEdit = (barang: Barang) => {
    setEditingBarang({
      id: barang.id,
      data: {
        namaBarang: barang.namaBarang,
        hargaBeli: formatInputRupiah(barang.hargaBeli.toString()),
        hargaJual: formatInputRupiah(barang.hargaJual.toString()),
        jumlahPerkardus: barang.jumlahPerkardus.toString(),
        ukuran: barang.ukuran.toString(),
        satuan: barang.satuan,
        supplierId: barang.supplierId.toString(),
      },
    });
    setEditSupplierSearch(barang.supplier?.namaSupplier || "");
    setShowEditModal(true);
  };

  const handleDelete = async (id: number, namaBarang: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus barang "${namaBarang}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/barang/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Barang berhasil dihapus!");
        fetchBarang();
      } else {
        toast.error(data.error || "Gagal menghapus barang");
      }
    } catch (error) {
      console.error("Error deleting barang:", error);
      toast.error("Terjadi kesalahan saat menghapus barang");
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (editingBarang) {
      if (name === "hargaBeli" || name === "hargaJual") {
        const formattedValue = formatInputRupiah(value);
        setEditingBarang({
          ...editingBarang,
          data: {
            ...editingBarang.data,
            [name]: formattedValue,
          },
        });
      } else {
        setEditingBarang({
          ...editingBarang,
          data: {
            ...editingBarang.data,
            [name]: value,
          },
        });
      }
    }
  };

  const handleSubmitAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedSupplierId) {
      toast.error("Silakan pilih supplier terlebih dahulu");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/barang", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          namaBarang: formData.get("namaBarang"),
          hargaBeli: parseRupiahToNumber(addFormHargaBeli),
          hargaJual: parseRupiahToNumber(addFormHargaJual),
          jumlahPerkardus: parseInt(formData.get("jumlahPerkardus") as string),
          ukuran: parseInt(formData.get("ukuran") as string),
          satuan: formData.get("satuan"),
          supplierId: parseInt(selectedSupplierId),
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Barang berhasil ditambahkan!");
        setShowAddModal(false);
        setSupplierSearch("");
        setSelectedSupplierId("");
        setSelectedSupplierName("");
        setAddFormHargaBeli("");
        setAddFormHargaJual("");
        fetchBarang();
      } else {
        toast.error(data.error || "Gagal menambahkan barang");
      }
    } catch (error) {
      console.error("Error adding barang:", error);
      toast.error("Terjadi kesalahan saat menambahkan barang");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingBarang) return;

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/barang/${editingBarang.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          namaBarang: editingBarang.data.namaBarang,
          hargaBeli: parseRupiahToNumber(editingBarang.data.hargaBeli),
          hargaJual: parseRupiahToNumber(editingBarang.data.hargaJual),
          jumlahPerkardus: parseInt(editingBarang.data.jumlahPerkardus),
          ukuran: parseInt(editingBarang.data.ukuran),
          satuan: editingBarang.data.satuan,
          supplierId: parseInt(editingBarang.data.supplierId),
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Barang berhasil diupdate!");
        setShowEditModal(false);
        setEditingBarang(null);
        fetchBarang();
      } else {
        toast.error(data.error || "Gagal mengupdate barang");
      }
    } catch (error) {
      console.error("Error updating barang:", error);
      toast.error("Terjadi kesalahan saat mengupdate barang");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSupplierSearch = (value: string) => {
    setSupplierSearch(value);
    if (value.length >= 3) {
      setShowSupplierDropdown(true);
    } else {
      setShowSupplierDropdown(false);
      setSelectedSupplierId("");
      setSelectedSupplierName("");
    }
  };

  const handleSelectSupplier = (supplier: Supplier) => {
    setSelectedSupplierId(supplier.id.toString());
    setSelectedSupplierName(supplier.namaSupplier);
    setSupplierSearch(supplier.namaSupplier);
    setShowSupplierDropdown(false);
  };

  const handleEditSupplierSearch = (value: string) => {
    setEditSupplierSearch(value);
    if (value.length >= 3) {
      setShowEditSupplierDropdown(true);
    } else {
      setShowEditSupplierDropdown(false);
    }
  };

  const handleSelectEditSupplier = (supplier: Supplier) => {
    if (editingBarang) {
      setEditingBarang({
        ...editingBarang,
        data: {
          ...editingBarang.data,
          supplierId: supplier.id.toString(),
        },
      });
    }
    setEditSupplierSearch(supplier.namaSupplier);
    setShowEditSupplierDropdown(false);
  };

  const filteredEditSuppliersList = suppliersList.filter((supplier) =>
    supplier.namaSupplier
      .toLowerCase()
      .includes(editSupplierSearch.toLowerCase())
  );

  const filteredSuppliersList = suppliersList.filter((supplier) =>
    supplier.namaSupplier.toLowerCase().includes(supplierSearch.toLowerCase())
  );

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

  const getStokStatus = (stok: number) => {
    if (stok < 50)
      return {
        color: "bg-red-100 text-red-800",
        label: "Stok Rendah",
        badgeColor: "bg-red-500",
      };
    if (stok < 100)
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
    if (filterStok === "low") matchStok = item.stok < 50;
    if (filterStok === "medium") matchStok = item.stok >= 50 && item.stok < 100;
    if (filterStok === "high") matchStok = item.stok >= 100;

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
              <button
                onClick={() => setShowAddModal(true)}
                className="group bg-white hover:bg-blue-50 text-blue-600 px-6 py-3 rounded-xl flex items-center gap-2 transition-all font-semibold shadow-lg hover:shadow-xl hover:scale-105 transform"
              >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                Tambah Barang
              </button>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
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
          </div>

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

        {/* Barang Cards Grid */}
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
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredBarang.map((item) => {
                const { profit, percentage } = calculateProfit(
                  item.hargaBeli,
                  item.hargaJual
                );
                const stokStatus = getStokStatus(item.stok);

                return (
                  <div
                    key={item.id}
                    className="group bg-white rounded-xl shadow-md border border-gray-100 hover:shadow-xl transition-all duration-300 overflow-hidden hover:-translate-y-1"
                  >
                    {/* Card Header */}
                    <div className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 p-4">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full -mr-12 -mt-12"></div>
                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-base font-bold text-white pr-2 line-clamp-1">
                            {item.namaBarang}
                          </h3>
                          <div
                            className={`w-2 h-2 rounded-full ${stokStatus.badgeColor} flex-shrink-0 mt-2`}
                          ></div>
                        </div>
                        <div className="flex items-center gap-2 text-blue-100 text-xs">
                          <Store className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate font-medium">
                            {item.supplier?.namaSupplier || "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-4">
                      {/* Harga Section */}
                      <div className="mb-3 pb-3 border-b border-gray-200">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-500 font-semibold uppercase">
                              Harga Beli
                            </span>
                            <span className="text-xs font-bold text-gray-900">
                              {formatRupiahSimple(item.hargaBeli)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-500 font-semibold uppercase">
                              Harga Jual
                            </span>
                            <span className="text-xs font-bold text-blue-600">
                              {formatRupiahSimple(item.hargaJual)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                            <span className="text-[10px] text-gray-500 font-semibold uppercase">
                              Profit
                            </span>
                            <div className="text-right">
                              <span
                                className={`text-xs font-bold ${getProfitColor(
                                  profit
                                )}`}
                              >
                                {formatRupiahSimple(profit)}
                              </span>
                              <div
                                className={`text-[10px] ${getProfitColor(
                                  profit
                                )} opacity-75`}
                              >
                                {getPercentagePrefix(profit)}
                                {percentage}%
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stok & Ukuran Section */}
                      <div className="mb-3 pb-3 border-b border-gray-200">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-500 font-semibold uppercase">
                              Stok
                            </span>
                            <span
                              className={`px-2 py-1 rounded-full text-[10px] font-semibold ${stokStatus.color}`}
                            >
                              {item.stok} {item.satuan}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-500 font-semibold uppercase">
                              Ukuran
                            </span>
                            <span className="text-xs font-semibold text-gray-700">
                              {item.ukuran} {item.satuan}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-500 font-semibold uppercase">
                              Per Kardus
                            </span>
                            <span className="text-xs font-semibold text-gray-700">
                              {item.jumlahPerkardus} pcs
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="group/btn bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-2 py-2 rounded-lg transition-all font-semibold text-xs flex items-center justify-center gap-1 shadow-md hover:shadow-lg"
                        >
                          <Edit className="w-3 h-3 group-hover/btn:rotate-12 transition-transform" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.namaBarang)}
                          className="group/btn bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-2 py-2 rounded-lg transition-all font-semibold text-xs flex items-center justify-center gap-1 shadow-md hover:shadow-lg"
                        >
                          <Trash2 className="w-3 h-3 group-hover/btn:scale-110 transition-transform" />
                          Hapus
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedBarang(item);
                          setShowDetailModal(true);
                        }}
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
          </>
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

                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-white p-2 rounded-lg">
                      <Store className="w-5 h-5 text-gray-600" />
                    </div>
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">
                      Supplier
                    </p>
                  </div>
                  <p className="text-gray-900 text-lg font-semibold pl-11">
                    {selectedBarang.supplier?.namaSupplier || "-"}
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

                <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 rounded-2xl p-6 border-2 border-blue-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-blue-600 p-3 rounded-xl">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">
                      Informasi Profit
                    </h3>
                  </div>

                  <div className="bg-white rounded-xl p-4 shadow-md">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700">
                        Profit per Unit
                      </span>
                      <div className="text-right">
                        <span
                          className={`text-xl font-bold ${getProfitColor(
                            calculateProfit(
                              selectedBarang.hargaBeli,
                              selectedBarang.hargaJual
                            ).profit
                          )}`}
                        >
                          {formatRupiah(
                            calculateProfit(
                              selectedBarang.hargaBeli,
                              selectedBarang.hargaJual
                            ).profit
                          )}
                        </span>
                        <div
                          className={`text-sm ${getProfitColor(
                            calculateProfit(
                              selectedBarang.hargaBeli,
                              selectedBarang.hargaJual
                            ).profit
                          )}`}
                        >
                          {getPercentagePrefix(
                            calculateProfit(
                              selectedBarang.hargaBeli,
                              selectedBarang.hargaJual
                            ).profit
                          )}
                          {
                            calculateProfit(
                              selectedBarang.hargaBeli,
                              selectedBarang.hargaJual
                            ).percentage
                          }
                          %
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wider mb-2">
                      Stok
                    </p>
                    <p className="text-gray-900 text-xl font-bold">
                      {selectedBarang.stok} {selectedBarang.satuan}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wider mb-2">
                      Ukuran
                    </p>
                    <p className="text-gray-900 text-xl font-bold">
                      {selectedBarang.ukuran} {selectedBarang.satuan}
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wider mb-2">
                      Per Kardus
                    </p>
                    <p className="text-gray-900 text-xl font-bold">
                      {selectedBarang.jumlahPerkardus}
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

        {/* Add Modal - sama seperti sebelumnya tapi dengan styling yang diperbarui */}
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
                      Tambah Barang Baru
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setSupplierSearch("");
                      setSelectedSupplierId("");
                      setSelectedSupplierName("");
                      setAddFormHargaBeli("");
                      setAddFormHargaJual("");
                    }}
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
                      <Package className="w-4 h-4 text-blue-600" />
                      Nama Barang <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="namaBarang"
                      className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                      placeholder="Masukkan nama barang"
                      required
                    />
                  </div>

                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                      <Store className="w-4 h-4 text-blue-600" />
                      Supplier <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={supplierSearch}
                        onChange={(e) => handleSupplierSearch(e.target.value)}
                        onFocus={() => {
                          if (supplierSearch.length >= 3)
                            setShowSupplierDropdown(true);
                        }}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                        placeholder="Ketik minimal 3 huruf untuk mencari supplier..."
                        required
                      />
                      {showSupplierDropdown && supplierSearch.length >= 3 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                          {filteredSuppliersList.length > 0 ? (
                            filteredSuppliersList.map((supplier) => (
                              <div
                                key={supplier.id}
                                onClick={() => handleSelectSupplier(supplier)}
                                className="px-5 py-3 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
                              >
                                <p className="font-semibold text-gray-900">
                                  {supplier.namaSupplier}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {supplier.alamat}
                                </p>
                              </div>
                            ))
                          ) : (
                            <div className="px-5 py-4 text-gray-500 text-sm text-center">
                              Supplier tidak ditemukan
                            </div>
                          )}
                        </div>
                      )}
                      {supplierSearch.length > 0 &&
                        supplierSearch.length < 3 && (
                          <p className="text-xs text-gray-500 mt-2">
                            Ketik minimal 3 karakter untuk mencari
                          </p>
                        )}
                      {selectedSupplierName && (
                        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-green-50 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <p className="text-sm text-green-700 font-semibold">
                            {selectedSupplierName} dipilih
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <TrendingDown className="w-4 h-4 text-red-600" />
                        Harga Beli <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="hargaBeli"
                        value={addFormHargaBeli}
                        onChange={(e) =>
                          setAddFormHargaBeli(formatInputRupiah(e.target.value))
                        }
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                        placeholder="Rp 12.000"
                        required
                      />
                    </div>

                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        Harga Jual <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="hargaJual"
                        value={addFormHargaJual}
                        onChange={(e) =>
                          setAddFormHargaJual(formatInputRupiah(e.target.value))
                        }
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                        placeholder="Rp 15.000"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <Box className="w-4 h-4 text-blue-600" />
                        Ukuran <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="ukuran"
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                        placeholder="1"
                        required
                      />
                    </div>

                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        Satuan <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="satuan"
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all bg-white group-hover:border-gray-300"
                        required
                      >
                        <option value="">Pilih Satuan</option>
                        <option value="kg">KG</option>
                        <option value="liter">Liter</option>
                        <option value="pcs">PCS</option>
                        <option value="pack">Pack</option>
                        <option value="sak">Sak</option>
                      </select>
                    </div>
                  </div>

                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                      Jumlah Per Kardus <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="jumlahPerkardus"
                      className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                      placeholder="20"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setSupplierSearch("");
                      setSelectedSupplierId("");
                      setSelectedSupplierName("");
                      setAddFormHargaBeli("");
                      setAddFormHargaJual("");
                    }}
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
                        Simpan Barang
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal - similar styling updates */}
        {showEditModal && editingBarang && (
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
                      Edit Barang
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setEditSupplierSearch("");
                      setShowEditSupplierDropdown(false);
                    }}
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
                      <Package className="w-4 h-4 text-yellow-600" />
                      Nama Barang <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="namaBarang"
                      value={editingBarang.data.namaBarang}
                      onChange={handleInputChange}
                      className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                      required
                    />
                  </div>

                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                      <Store className="w-4 h-4 text-yellow-600" />
                      Supplier <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={editSupplierSearch}
                        onChange={(e) =>
                          handleEditSupplierSearch(e.target.value)
                        }
                        onFocus={() => {
                          if (editSupplierSearch.length >= 3)
                            setShowEditSupplierDropdown(true);
                        }}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                        placeholder="Ketik minimal 3 huruf untuk mencari supplier..."
                        required
                      />
                      {showEditSupplierDropdown &&
                        editSupplierSearch.length >= 3 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                            {filteredEditSuppliersList.length > 0 ? (
                              filteredEditSuppliersList.map((supplier) => (
                                <div
                                  key={supplier.id}
                                  onClick={() =>
                                    handleSelectEditSupplier(supplier)
                                  }
                                  className="px-5 py-3 hover:bg-yellow-50 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
                                >
                                  <p className="font-semibold text-gray-900">
                                    {supplier.namaSupplier}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {supplier.alamat}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <div className="px-5 py-4 text-gray-500 text-sm text-center">
                                Supplier tidak ditemukan
                              </div>
                            )}
                          </div>
                        )}
                      {editSupplierSearch.length > 0 &&
                        editSupplierSearch.length < 3 && (
                          <p className="text-xs text-gray-500 mt-2">
                            Ketik minimal 3 karakter untuk mencari
                          </p>
                        )}
                      {editingBarang.data.supplierId &&
                        editSupplierSearch.length >= 3 && (
                          <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-green-50 rounded-lg">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <p className="text-sm text-green-700 font-semibold">
                              Supplier dipilih
                            </p>
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <TrendingDown className="w-4 h-4 text-red-600" />
                        Harga Beli <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="hargaBeli"
                        value={editingBarang.data.hargaBeli}
                        onChange={handleInputChange}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                        required
                      />
                    </div>

                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        Harga Jual <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="hargaJual"
                        value={editingBarang.data.hargaJual}
                        onChange={handleInputChange}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        <Box className="w-4 h-4 text-yellow-600" />
                        Ukuran <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="ukuran"
                        value={editingBarang.data.ukuran}
                        onChange={handleInputChange}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                        required
                      />
                    </div>

                    <div className="group">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                        Satuan <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="satuan"
                        value={editingBarang.data.satuan}
                        onChange={handleInputChange}
                        className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all bg-white group-hover:border-gray-300"
                        required
                      >
                        <option value="">Pilih Satuan</option>
                        <option value="kg">KG</option>
                        <option value="liter">Liter</option>
                        <option value="pcs">PCS</option>
                        <option value="pack">Pack</option>
                        <option value="sak">Sak</option>
                      </select>
                    </div>
                  </div>

                  <div className="group">
                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                      Jumlah Per Kardus <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="jumlahPerkardus"
                      value={editingBarang.data.jumlahPerkardus}
                      onChange={handleInputChange}
                      className="w-full px-5 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all group-hover:border-gray-300"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-8">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditSupplierSearch("");
                      setShowEditSupplierDropdown(false);
                    }}
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
                        Update Barang
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

export default DataBarangPage;
