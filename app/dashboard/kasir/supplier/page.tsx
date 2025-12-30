"use client";
import React, { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Search,
  Users,
  Package,
  RefreshCw,
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

  const formatPhoneNumber = (phone: string): string => {
    return phone.replace(/(\d{4})(\d{4})(\d+)/, "$1-$2-$3");
  };


  const filteredSupplier = supplierList.filter((item) => {
    return (
      item.namaSupplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.alamat.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.noHp.includes(searchTerm)
    );
  });

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
                onClick={fetchSupplier}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg"
              >
                <RefreshCw className="w-5 h-5" />
                Refresh
              </button>
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

        {/* Supplier List */}
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
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Nama Supplier
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Alamat
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Nomor HP
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Produk
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredSupplier.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-medium text-gray-900 text-sm">
                          {supplier.namaSupplier}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {supplier.alamat}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatPhoneNumber(supplier.noHp)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-400" />
                          <span>{supplier.barang.length} produk</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedSupplier(supplier)}
                            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                          >
                            Detail
                          </button>
                          <button
                            onClick={() =>
                              handleDelete(supplier.id, supplier.namaSupplier)
                            }
                            className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

      </div>
    </div>
  );
};

export default DataSupplierPage;
