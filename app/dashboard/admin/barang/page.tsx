"use client";
import React, { useState, useEffect } from "react";
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

const DataBarangPage = () => {
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterSupplier, setFilterSupplier] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
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

  useEffect(() => {
    fetchBarang();
    fetchSuppliers();
  }, []);

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
        hargaBeli: barang.hargaBeli.toString(),
        hargaJual: barang.hargaJual.toString(),
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
      setEditingBarang({
        ...editingBarang,
        data: {
          ...editingBarang.data,
          [name]: value,
        },
      });
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
          hargaBeli: parseInt(formData.get("hargaBeli") as string),
          hargaJual: parseInt(formData.get("hargaJual") as string),
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
          hargaBeli: parseInt(editingBarang.data.hargaBeli),
          hargaJual: parseInt(editingBarang.data.hargaJual),
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

  const calculateProfit = (hargaBeli: number, hargaJual: number) => {
    const profit = hargaJual - hargaBeli;
    const percentage = ((profit / hargaBeli) * 100).toFixed(1);
    return { profit, percentage };
  };

  const getProfitColor = (profit: number) => {
    if (profit > 0) return "text-green-600"; // Profit positif = hijau
    if (profit < 0) return "text-red-600"; // Profit negatif (rugi) = merah
    return "text-yellow-600"; // Tidak ada profit (0) = kuning
  };

  const getPercentagePrefix = (profit: number) => {
    if (profit > 0) return "+";
    if (profit < 0) return ""; // Minus sudah ada dari angka negatif
    return "";
  };

  const getStokStatus = (stok: number) => {
    if (stok < 50)
      return { color: "bg-red-100 text-red-800", label: "Stok Rendah" };
    if (stok < 100)
      return { color: "bg-yellow-100 text-yellow-800", label: "Stok Sedang" };
    return { color: "bg-green-100 text-green-800", label: "Stok Aman" };
  };

  const filteredBarang = barangList.filter((item) => {
    const matchSearch =
      item.namaBarang.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplier?.namaSupplier
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchSupplier =
      filterSupplier === "all" ||
      item.supplier?.id.toString() === filterSupplier;
    return matchSearch && matchSupplier;
  });

  const uniqueSuppliers = Array.from(
    new Map(
      barangList.map((item) => [item.supplier?.id, item.supplier])
    ).values()
  ).filter((supplier): supplier is Supplier => supplier !== undefined);

  return (
    <div className="w-full max-w-7xl mx-auto">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#333",
            color: "#fff",
          },
          success: {
            style: {
              background: "#22c55e",
            },
          },
          error: {
            style: {
              background: "#ef4444",
            },
          },
        }}
      />

      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Data Barang</h1>
            <p className="text-blue-100">
              Kelola dan pantau inventori barang Anda
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-white hover:bg-blue-50 text-blue-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
            >
              <Plus className="w-4 h-4" />
              Tambah Barang
            </button>
            <button
              onClick={fetchBarang}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Total Barang</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {barangList.length}
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
              <p className="text-gray-500 text-sm font-medium">Total Stok</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {barangList.reduce((acc, item) => acc + item.stok, 0)}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Supplier</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {uniqueSuppliers.length}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <TrendingDown className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 mb-6 shadow-md border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cari nama barang atau supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
            />
          </div>
          <select
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
          >
            <option value="all">Semua Supplier</option>
            {uniqueSuppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id.toString()}>
                {supplier.namaSupplier}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    No
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Nama Barang
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Harga Beli
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Harga Jual
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Profit
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Stok
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Ukuran
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBarang.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      Tidak ada data barang ditemukan
                    </td>
                  </tr>
                ) : (
                  filteredBarang.map((item, index) => {
                    const { profit, percentage } = calculateProfit(
                      item.hargaBeli,
                      item.hargaJual
                    );
                    const stokStatus = getStokStatus(item.stok);

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">
                            {item.namaBarang}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.jumlahPerkardus} pcs/kardus
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.supplier?.namaSupplier || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {formatRupiah(item.hargaBeli)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {formatRupiah(item.hargaJual)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div
                            className={`text-sm font-medium ${getProfitColor(
                              profit
                            )}`}
                          >
                            {formatRupiah(profit)}
                          </div>
                          <div
                            className={`text-xs ${getProfitColor(
                              profit
                            )} opacity-75`}
                          >
                            {getPercentagePrefix(profit)}
                            {percentage}%
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${stokStatus.color}`}
                          >
                            {item.stok} {item.satuan}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.ukuran} {item.satuan}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-all"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleDelete(item.id, item.namaBarang)
                              }
                              className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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

      <div className="mt-4 text-center text-sm text-gray-500">
        Menampilkan {filteredBarang.length} dari {barangList.length} barang
      </div>

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
                Tambah Barang Baru
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSupplierSearch("");
                  setSelectedSupplierId("");
                  setSelectedSupplierName("");
                }}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nama Barang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="namaBarang"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                    placeholder="Masukkan nama barang"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                      placeholder="Ketik minimal 3 huruf untuk mencari supplier..."
                      required
                    />
                    {showSupplierDropdown && supplierSearch.length >= 3 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredSuppliersList.length > 0 ? (
                          filteredSuppliersList.map((supplier) => (
                            <div
                              key={supplier.id}
                              onClick={() => handleSelectSupplier(supplier)}
                              className="px-4 py-2 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
                            >
                              <p className="font-medium text-gray-900">
                                {supplier.namaSupplier}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {supplier.alamat}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-gray-500 text-sm text-center">
                            Supplier tidak ditemukan
                          </div>
                        )}
                      </div>
                    )}
                    {supplierSearch.length > 0 && supplierSearch.length < 3 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Ketik minimal 3 karakter untuk mencari
                      </p>
                    )}
                    {selectedSupplierName && (
                      <p className="text-xs text-green-600 mt-1">
                        ✓ {selectedSupplierName} dipilih
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Harga Beli <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="hargaBeli"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                      placeholder="12000"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Harga Jual <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="hargaJual"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                      placeholder="15000"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Ukuran <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="ukuran"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                      placeholder="1"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Satuan <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="satuan"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                      required
                    >
                      <option value="">Pilih Satuan</option>
                      <option value="kg">Kilogram (kg)</option>
                      <option value="liter">Liter</option>
                      <option value="pcs">Pieces (pcs)</option>
                      <option value="box">Box</option>
                      <option value="pack">Pack</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Jumlah Per Kardus <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="jumlahPerkardus"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                    placeholder="20"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setSupplierSearch("");
                    setSelectedSupplierId("");
                    setSelectedSupplierName("");
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg transition-all font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-3 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Barang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingBarang && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Edit Barang</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditSupplierSearch("");
                  setShowEditSupplierDropdown(false);
                }}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nama Barang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="namaBarang"
                    value={editingBarang.data.namaBarang}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editSupplierSearch}
                      onChange={(e) => handleEditSupplierSearch(e.target.value)}
                      onFocus={() => {
                        if (editSupplierSearch.length >= 3)
                          setShowEditSupplierDropdown(true);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                      placeholder="Ketik minimal 3 huruf untuk mencari supplier..."
                      required
                    />
                    {showEditSupplierDropdown &&
                      editSupplierSearch.length >= 3 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredEditSuppliersList.length > 0 ? (
                            filteredEditSuppliersList.map((supplier) => (
                              <div
                                key={supplier.id}
                                onClick={() =>
                                  handleSelectEditSupplier(supplier)
                                }
                                className="px-4 py-2 hover:bg-yellow-50 cursor-pointer transition-colors border-b border-gray-100 last:border-0"
                              >
                                <p className="font-medium text-gray-900">
                                  {supplier.namaSupplier}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {supplier.alamat}
                                </p>
                              </div>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-gray-500 text-sm text-center">
                              Supplier tidak ditemukan
                            </div>
                          )}
                        </div>
                      )}
                    {editSupplierSearch.length > 0 &&
                      editSupplierSearch.length < 3 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Ketik minimal 3 karakter untuk mencari
                        </p>
                      )}
                    {editingBarang.data.supplierId &&
                      editSupplierSearch.length >= 3 && (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ Supplier dipilih
                        </p>
                      )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Harga Beli <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="hargaBeli"
                      value={editingBarang.data.hargaBeli}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Harga Jual <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="hargaJual"
                      value={editingBarang.data.hargaJual}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Ukuran <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="ukuran"
                      value={editingBarang.data.ukuran}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Satuan <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="satuan"
                      value={editingBarang.data.satuan}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                      required
                    >
                      <option value="">Pilih Satuan</option>
                      <option value="kg">Kilogram (kg)</option>
                      <option value="liter">Liter</option>
                      <option value="pcs">Pieces (pcs)</option>
                      <option value="box">Box</option>
                      <option value="pack">Pack</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Jumlah Per Kardus <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="jumlahPerkardus"
                    value={editingBarang.data.jumlahPerkardus}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditSupplierSearch("");
                    setShowEditSupplierDropdown(false);
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg transition-all font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-4 py-3 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Menyimpan..." : "Update Barang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataBarangPage;
