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
  jumlahPerkardus: number;
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

  // Form state
  const [formData, setFormData] = useState({
    namaSupplier: "",
    alamat: "",
    noHp: "",
    limitHutang: "",
    hutang: "",
  });

  // Fetch data from API
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

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/supplier", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          namaSupplier: formData.namaSupplier,
          alamat: formData.alamat,
          noHp: formData.noHp,
          limitHutang: parseInt(formData.limitHutang),
          hutang: parseInt(formData.hutang),
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
        setShowAddModal(false);
        setFormData({
          namaSupplier: "",
          alamat: "",
          noHp: "",
          limitHutang: "",
          hutang: "",
        });
        fetchSupplier(); // Refresh data
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
      limitHutang: supplier.limitHutang.toString(),
      hutang: supplier.hutang.toString(),
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSupplierId) return;

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/supplier/${editingSupplierId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          namaSupplier: formData.namaSupplier,
          alamat: formData.alamat,
          noHp: formData.noHp,
          limitHutang: parseInt(formData.limitHutang),
          hutang: parseInt(formData.hutang),
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
        setShowEditModal(false);
        setEditingSupplierId(null);
        setFormData({
          namaSupplier: "",
          alamat: "",
          noHp: "",
          limitHutang: "",
          hutang: "",
        });
        fetchSupplier(); // Refresh data
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
        fetchSupplier(); // Refresh data
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

  const formatRupiah = (number: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const formatPhoneNumber = (phone: string): string => {
    return phone.replace(/(\d{4})(\d{4})(\d+)/, "$1-$2-$3");
  };

  const getLimitStatus = (hutang: number, pembelian: number) => {
    const percentage = (hutang / pembelian) * 100;
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
    <div className="w-full max-w-7xl mx-auto">
      {/* Toaster Component */}
      <Toaster />

      {/* Header Section */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Data Supplier
            </h1>
            <p className="text-blue-100">
              Kelola informasi supplier dan mitra bisnis
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-white hover:bg-blue-50 text-blue-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
            >
              <Plus className="w-4 h-4" />
              Tambah Supplier
            </button>
            <button
              onClick={fetchSupplier}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">
                Total Supplier
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {supplierList.length}
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
              <p className="text-gray-500 text-sm font-medium">Total Barang</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {totalBarang}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Limit Hutang</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {formatRupiah(totalLimitHutang)}
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <CreditCard className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">
                Limit Pembelian
              </p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {formatRupiah(totalhutang)}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-green-600" />
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
            placeholder="Cari nama supplier, alamat, atau nomor HP..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Supplier Cards Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredSupplier.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md border border-gray-100 p-12 text-center">
          <p className="text-gray-500">Tidak ada data supplier ditemukan</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSupplier.map((supplier) => {
            const limitStatus = getLimitStatus(
              supplier.limitHutang,
              supplier.hutang
            );
            const limitPercentage =
              (supplier.hutang / supplier.limitHutang) * 100;
            const limitPercentageDisplay = limitPercentage.toFixed(1);

            return (
              <div
                key={supplier.id}
                className="bg-white rounded-xl shadow-md border border-gray-100 hover:shadow-xl transition-all duration-300 overflow-hidden"
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
                      <p className="text-sm text-gray-600">{supplier.alamat}</p>
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
                      <span className="text-sm text-gray-500">Hutang</span>
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

      {/* Detail Modal (Optional) */}
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
              <h2 className="text-2xl font-bold text-white">Detail Supplier</h2>
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
                  <p className="text-sm text-gray-500 mb-1">Limit Pembelian</p>
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
          onClick={() => setShowAddModal(false)}
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
                onClick={() => setShowAddModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                {/* Nama Supplier */}
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

                {/* Alamat */}
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

                {/* Nomor HP */}
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

                {/* Limit Hutang */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Limit Hutang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="limitHutang"
                    value={formData.limitHutang}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                    placeholder="Contoh: 50000000"
                    required
                  />
                </div>

                {/* Limit Pembelian */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Limit Pembelian <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="hutang"
                    value={formData.hutang}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                    placeholder="Contoh: 100000000"
                    required
                  />
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
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Edit Supplier</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6">
              <div className="space-y-4">
                {/* Nama Supplier */}
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

                {/* Alamat */}
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

                {/* Nomor HP */}
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

                {/* Limit Hutang */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Limit Hutang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="limitHutang"
                    value={formData.limitHutang}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                    placeholder="Contoh: 50000000"
                    required
                  />
                </div>

                {/* Limit Pembelian */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Limit Pembelian <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="hutang"
                    value={formData.hutang}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                    placeholder="Contoh: 100000000"
                    required
                  />
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
                  {isSubmitting ? "Menyimpan..." : "Update Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataSupplierPage;
