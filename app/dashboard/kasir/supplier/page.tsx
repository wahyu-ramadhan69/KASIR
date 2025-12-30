"use client";
import React, { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Search,
  Users,
  TrendingUp,
  Package,
  RefreshCw,
  Phone,
  MapPin,
  CreditCard,
  ShoppingCart,
  Plus,
  Edit,
  Trash2,
  X,
} from "lucide-react";

interface Barang {
  id: number;
  namaBarang: string;
  hargaBeli: number;
  hargaJual: number;
  stok: number;
  jumlahPerKemasan: number;
  ukuran: number;
  satuan: string;
  supplierId: number;
  createdAt: string;
  updatedAt: string;
}

interface Supplier {
  id: number;
  namaSupplier: string;
  alamat: string;
  noHp: string;
  limitHutang: number;
  hutang: number;
  barang: Barang[];
}

const DataSupplierPage = () => {
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null
  );
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(
    null
  );

  const [formData, setFormData] = useState({
    namaSupplier: "",
    alamat: "",
    noHp: "",
    limitHutang: "",
    hutang: "",
  });

  useEffect(() => {
    fetchSupplier();
  }, []);

  const fetchSupplier = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/supplier");
      const data = await res.json();

      if (data.success) {
        setSupplierList(data.data);
      } else {
        console.error("Failed to fetch data");
      }
    } catch (error) {
      console.error("Error fetching supplier:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatInputRupiah = (value: string): string => {
    const numbers = value.replace(/\D/g, "");

    if (numbers === "") return "";

    const formatted = new Intl.NumberFormat("id-ID").format(parseInt(numbers));
    return `Rp ${formatted}`;
  };

  const parseRupiahToNumber = (value: string): number => {
    const numbers = value.replace(/\D/g, "");
    return numbers === "" ? 0 : parseInt(numbers, 10);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === "limitHutang" || name === "hutang") {
      const formattedValue = formatInputRupiah(value);
      setFormData((prev) => ({
        ...prev,
        [name]: formattedValue,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleOpenAddModal = () => {
    setFormData({
      namaSupplier: "",
      alamat: "",
      noHp: "",
      limitHutang: "",
      hutang: "",
    });
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setFormData({
      namaSupplier: "",
      alamat: "",
      noHp: "",
      limitHutang: "",
      hutang: "",
    });
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingSupplierId(null);
    setFormData({
      namaSupplier: "",
      alamat: "",
      noHp: "",
      limitHutang: "",
      hutang: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const limitHutangValue = parseRupiahToNumber(formData.limitHutang);
      const hutangValue = parseRupiahToNumber(formData.hutang);

      if (isNaN(limitHutangValue) || isNaN(hutangValue)) {
        toast.error("Format angka tidak valid", {
          duration: 4000,
          position: "top-right",
          style: {
            background: "#ef4444",
            color: "#fff",
            fontWeight: "500",
          },
        });
        setIsSubmitting(false);
        return;
      }

      const MAX_BIGINT = 9007199254740991;
      if (limitHutangValue > MAX_BIGINT || hutangValue > MAX_BIGINT) {
        toast.error("Nilai terlalu besar. Maksimal Rp 9.007.199.254.740.991", {
          duration: 4000,
          position: "top-right",
          style: {
            background: "#ef4444",
            color: "#fff",
            fontWeight: "500",
          },
        });
        setIsSubmitting(false);
        return;
      }

      const res = await fetch("/api/supplier", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          namaSupplier: formData.namaSupplier,
          alamat: formData.alamat,
          noHp: formData.noHp,
          limitHutang: limitHutangValue.toString(),
          hutang: hutangValue.toString(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Supplier berhasil ditambahkan!", {
          duration: 4000,
          position: "top-right",
          style: {
            background: "#10b981",
            color: "#fff",
            fontWeight: "500",
          },
          iconTheme: {
            primary: "#fff",
            secondary: "#10b981",
          },
        });
        handleCloseAddModal();
        fetchSupplier();
      } else {
        toast.error(data.error || "Gagal menambahkan supplier", {
          duration: 4000,
          position: "top-right",
          style: {
            background: "#ef4444",
            color: "#fff",
            fontWeight: "500",
          },
        });
      }
    } catch (error) {
      console.error("Error adding supplier:", error);
      toast.error("Terjadi kesalahan saat menambahkan supplier", {
        duration: 4000,
        position: "top-right",
        style: {
          background: "#ef4444",
          color: "#fff",
          fontWeight: "500",
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setFormData({
      namaSupplier: supplier.namaSupplier,
      alamat: supplier.alamat,
      noHp: supplier.noHp,
      limitHutang: formatInputRupiah(supplier.limitHutang.toString()),
      hutang: formatInputRupiah(supplier.hutang.toString()),
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSupplierId) return;

    setIsSubmitting(true);

    try {
      const limitHutangValue = parseRupiahToNumber(formData.limitHutang);
      const hutangValue = parseRupiahToNumber(formData.hutang);

      if (isNaN(limitHutangValue) || isNaN(hutangValue)) {
        toast.error("Format angka tidak valid", {
          duration: 4000,
          position: "top-right",
          style: {
            background: "#ef4444",
            color: "#fff",
            fontWeight: "500",
          },
        });
        setIsSubmitting(false);
        return;
      }

      const MAX_BIGINT = 9007199254740991;
      if (limitHutangValue > MAX_BIGINT || hutangValue > MAX_BIGINT) {
        toast.error("Nilai terlalu besar. Maksimal Rp 9.007.199.254.740.991", {
          duration: 4000,
          position: "top-right",
          style: {
            background: "#ef4444",
            color: "#fff",
            fontWeight: "500",
          },
        });
        setIsSubmitting(false);
        return;
      }

      const res = await fetch(`/api/supplier/${editingSupplierId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          namaSupplier: formData.namaSupplier,
          alamat: formData.alamat,
          noHp: formData.noHp,
          limitHutang: limitHutangValue.toString(),
          hutang: hutangValue.toString(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Supplier berhasil diupdate!", {
          duration: 4000,
          position: "top-right",
          style: {
            background: "#10b981",
            color: "#fff",
            fontWeight: "500",
          },
          iconTheme: {
            primary: "#fff",
            secondary: "#10b981",
          },
        });
        handleCloseEditModal();
        fetchSupplier();
      } else {
        toast.error(data.error || "Gagal mengupdate supplier", {
          duration: 4000,
          position: "top-right",
          style: {
            background: "#ef4444",
            color: "#fff",
            fontWeight: "500",
          },
        });
      }
    } catch (error) {
      console.error("Error updating supplier:", error);
      toast.error("Terjadi kesalahan saat mengupdate supplier", {
        duration: 4000,
        position: "top-right",
        style: {
          background: "#ef4444",
          color: "#fff",
          fontWeight: "500",
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, namaSupplier: string) => {
    if (
      !confirm(`Apakah Anda yakin ingin menghapus supplier "${namaSupplier}"?`)
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/supplier/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Supplier berhasil dihapus!", {
          duration: 4000,
          position: "top-right",
          style: {
            background: "#10b981",
            color: "#fff",
            fontWeight: "500",
          },
          iconTheme: {
            primary: "#fff",
            secondary: "#10b981",
          },
        });
        fetchSupplier();
      } else {
        toast.error(data.error || "Gagal menghapus supplier", {
          duration: 4000,
          position: "top-right",
          style: {
            background: "#ef4444",
            color: "#fff",
            fontWeight: "500",
          },
        });
      }
    } catch (error) {
      console.error("Error deleting supplier:", error);
      toast.error("Terjadi kesalahan saat menghapus supplier", {
        duration: 4000,
        position: "top-right",
        style: {
          background: "#ef4444",
          color: "#fff",
          fontWeight: "500",
        },
      });
    }
  };

  // ✅ FUNGSI FORMAT RUPIAH YANG DIUBAH
  const formatRupiah = (number: number): string => {
    // Untuk nilai milyar (>= 1.000.000.000)
    if (number >= 1000000000) {
      const milyar = number / 1000000000;
      // Tampilkan tanpa desimal jika bilangan bulat
      return milyar % 1 === 0
        ? `Rp ${milyar.toFixed(0)} M`
        : `Rp ${milyar.toFixed(1)} M`;
    }

    // Untuk nilai juta (>= 1.000.000)
    if (number >= 1000000) {
      const juta = number / 1000000;
      // Tampilkan tanpa desimal jika bilangan bulat
      return juta % 1 === 0
        ? `Rp ${juta.toFixed(0)} Jt`
        : `Rp ${juta.toFixed(1)} Jt`;
    }

    // Untuk nilai di bawah 1 juta, tampilkan normal
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const formatPhoneNumber = (phone: string): string => {
    return phone.replace(/(\d{4})(\d{4})(\d+)/, "$1-$2-$3");
  };

  const getLimitStatus = (hutang: number, limitHutang: number) => {
    const percentage = (hutang / limitHutang) * 100;
    if (percentage < 50)
      return { color: "bg-green-100 text-green-700", label: "Aman" };
    if (percentage < 75)
      return { color: "bg-yellow-100 text-yellow-700", label: "Sedang" };
    return { color: "bg-red-100 text-red-700", label: "Tinggi" };
  };

  const filteredSupplier = supplierList.filter((item) => {
    return (
      item.namaSupplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.alamat.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.noHp.includes(searchTerm)
    );
  });

  const totalLimitHutang = supplierList.reduce(
    (acc, item) => acc + item.limitHutang,
    0
  );
  const totalhutang = supplierList.reduce((acc, item) => acc + item.hutang, 0);
  const totalBarang = supplierList.reduce(
    (acc, item) => acc + item.barang.length,
    0
  );

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

        {/* Header Section */}
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
                  Data Supplier
                </h1>
                <p className="text-blue-100 text-lg">
                  Kelola informasi supplier dan mitra bisnis
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleOpenAddModal}
                className="group bg-white hover:bg-blue-50 text-blue-600 px-6 py-3 rounded-xl flex items-center gap-2 transition-all font-semibold shadow-lg hover:shadow-xl hover:scale-105 transform"
              >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                Tambah Supplier
              </button>
              <button
                onClick={fetchSupplier}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg"
              >
                <RefreshCw className="w-5 h-5" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Total Supplier
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {supplierList.length}
                </p>
                <p className="text-xs text-gray-400 mt-2">Mitra terdaftar</p>
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
                  Total Barang
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {totalBarang}
                </p>
                <p className="text-xs text-gray-400 mt-2">Produk aktif</p>
              </div>
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <Package className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Limit Hutang
                </p>
                <p className="text-2xl font-bold text-indigo-600 mt-2">
                  {formatRupiah(totalLimitHutang)}
                </p>
                <p className="text-xs text-gray-400 mt-2">Total plafon</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <CreditCard className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Hutang Awal
                </p>
                <p className="text-2xl font-bold text-green-600 mt-2">
                  {formatRupiah(totalhutang)}
                </p>
                <p className="text-xs text-gray-400 mt-2">Total awal</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <ShoppingCart className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari nama supplier, alamat, atau nomor HP..."
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
          {searchTerm && (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-4 py-2 rounded-lg">
              <Search className="w-4 h-4 text-blue-600" />
              <span>
                Menampilkan hasil untuk: {""}
                <span className="font-semibold text-blue-700">
                  "{searchTerm}"
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Supplier Cards Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <div className="text-center">
              <div className="relative">
                <div className="w-24 h-24 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                <Users className="w-10 h-10 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-gray-500 mt-6 text-lg font-medium">
                Memuat data supplier...
              </p>
            </div>
          </div>
        ) : filteredSupplier.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-16 text-center">
            <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <Users className="w-12 h-12 text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg font-medium">
              Tidak ada data supplier ditemukan
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSupplier.map((supplier) => {
              const limitStatus = getLimitStatus(
                supplier.hutang,
                supplier.limitHutang
              );
              const limitPercentage =
                (supplier.hutang / supplier.limitHutang) * 100;
              const limitPercentageDisplay = limitPercentage.toFixed(1);

              return (
                <div
                  key={supplier.id}
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 overflow-hidden hover:-translate-y-1"
                >
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">
                          {supplier.namaSupplier}
                        </h3>
                        <div className="flex items-center gap-2 text-blue-50 text-sm">
                          <Package className="w-4 h-4" />
                          <span>{supplier.barang.length} Produk</span>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${limitStatus.color}`}
                      >
                        {limitStatus.label}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6">
                    {/* Contact Info */}
                    <div className="space-y-3 mb-4">
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-600">
                          {supplier.alamat}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <p className="text-sm text-gray-600 font-medium">
                          {formatPhoneNumber(supplier.noHp)}
                        </p>
                      </div>
                    </div>

                    {/* Financial Info */}
                    <div className="border-t border-gray-200 pt-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                          Limit Hutang
                        </span>
                        <span className="text-sm font-bold text-red-600">
                          {formatRupiah(supplier.limitHutang)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                          Hutang Awal
                        </span>
                        <span className="text-sm font-bold text-green-600">
                          {formatRupiah(supplier.hutang)}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-500">
                            Rasio Hutang
                          </span>
                          <span className="text-xs font-medium text-gray-700">
                            {limitPercentageDisplay}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              limitPercentage < 50
                                ? "bg-green-500"
                                : limitPercentage < 75
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                            style={{
                              width: `${Math.min(limitPercentage, 100)}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Product List */}
                    {supplier.barang.length > 0 && (
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                          Produk Tersedia
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {supplier.barang.map((item) => (
                            <span
                              key={item.id}
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                            >
                              {item.namaBarang}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleEdit(supplier)}
                        className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-4 py-2 rounded-lg transition-all font-medium text-sm shadow-md flex items-center justify-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          handleDelete(supplier.id, supplier.namaSupplier)
                        }
                        className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-lg transition-all font-medium text-sm shadow-md flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Hapus
                      </button>
                    </div>
                    <button
                      onClick={() => setSelectedSupplier(supplier)}
                      className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all font-medium text-sm"
                    >
                      Lihat Detail
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Menampilkan {filteredSupplier.length} dari {supplierList.length}{" "}
          supplier
        </div>

        {/* Detail Modal */}
        {selectedSupplier && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedSupplier(null)}
          >
            <div
              className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
                <h2 className="text-2xl font-bold text-white">
                  Detail Supplier
                </h2>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  {selectedSupplier.namaSupplier}
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Alamat</p>
                    <p className="text-gray-900">{selectedSupplier.alamat}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Nomor HP</p>
                    <p className="text-gray-900">
                      {formatPhoneNumber(selectedSupplier.noHp)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Limit Hutang</p>
                    <p className="text-gray-900 font-bold">
                      {formatRupiah(selectedSupplier.limitHutang)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Hutang Awal</p>
                    <p className="text-gray-900 font-bold">
                      {formatRupiah(selectedSupplier.hutang)}
                    </p>
                  </div>
                  {selectedSupplier.barang.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">
                        Produk ({selectedSupplier.barang.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedSupplier.barang.map((item) => (
                          <span
                            key={item.id}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                          >
                            {item.namaBarang}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedSupplier(null)}
                  className="w-full mt-6 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg transition-all font-medium"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Supplier Modal */}
        {showAddModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={handleCloseAddModal}
          >
            <div
              className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  Tambah Supplier Baru
                </h2>
                <button
                  onClick={handleCloseAddModal}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nama Supplier <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="namaSupplier"
                      value={formData.namaSupplier}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                      placeholder="Masukkan nama supplier"
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Limit Hutang <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="limitHutang"
                        value={formData.limitHutang}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                        placeholder="Contoh: Rp 50.000.000"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Hutang Awal <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="hutang"
                        value={formData.hutang}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                        placeholder="Contoh: Rp 100.000.000"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseAddModal}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg transition-all font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-3 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Menyimpan..." : "Simpan Supplier"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Supplier Modal */}
        {showEditModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={handleCloseEditModal}
          >
            <div
              className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Edit Supplier</h2>
                <button
                  onClick={handleCloseEditModal}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nama Supplier <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="namaSupplier"
                      value={formData.namaSupplier}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                      placeholder="Masukkan nama supplier"
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
                      value={formData.noHp}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                      placeholder="Contoh: 081234567890"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Limit Hutang <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="limitHutang"
                        value={formData.limitHutang}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                        placeholder="Contoh: Rp 50.000.000"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Hutang Awal <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="hutang"
                        value={formData.hutang}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                        placeholder="Contoh: Rp 100.000.000"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseEditModal}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg transition-all font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-4 py-3 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Menyimpan..." : "Update Supplier"}
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

export default DataSupplierPage;
