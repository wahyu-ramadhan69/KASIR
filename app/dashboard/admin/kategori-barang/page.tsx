"use client";
import React, { useState, useEffect } from "react";
import {
  Tag,
  Plus,
  Edit,
  Trash2,
  X,
  CheckCircle,
  Loader2,
  RefreshCw,
  Package,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface KategoriBarang {
  id: number;
  namaKategori: string;
  deskripsi: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { barang: number };
}

const KategoriBarangPage = () => {
  const [list, setList] = useState<KategoriBarang[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<KategoriBarang | null>(null);

  const [formNama, setFormNama] = useState("");
  const [formDeskripsi, setFormDeskripsi] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/kategori-barang");
      const data = await res.json();
      if (data.success) setList(data.data);
    } catch {
      toast.error("Gagal memuat data kategori");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAdd = () => {
    setFormNama("");
    setFormDeskripsi("");
    setShowAddModal(true);
  };

  const openEdit = (item: KategoriBarang) => {
    setEditingItem(item);
    setFormNama(item.namaKategori);
    setFormDeskripsi(item.deskripsi || "");
    setShowEditModal(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/kategori-barang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namaKategori: formNama, deskripsi: formDeskripsi || null }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Kategori berhasil ditambahkan!");
        setShowAddModal(false);
        fetchData();
      } else {
        toast.error(data.error || "Gagal menambahkan kategori");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/kategori-barang/${editingItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namaKategori: formNama, deskripsi: formDeskripsi || null }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Kategori berhasil diupdate!");
        setShowEditModal(false);
        setEditingItem(null);
        fetchData();
      } else {
        toast.error(data.error || "Gagal mengupdate kategori");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item: KategoriBarang) => {
    if (item._count.barang > 0) {
      if (
        !confirm(
          `Kategori "${item.namaKategori}" digunakan oleh ${item._count.barang} barang.\nBarang tersebut akan kehilangan kategorinya.\n\nLanjutkan?`
        )
      )
        return;
    } else {
      if (!confirm(`Hapus kategori "${item.namaKategori}"?`)) return;
    }

    try {
      const res = await fetch(`/api/kategori-barang/${item.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Kategori berhasil dihapus!");
        fetchData();
      } else {
        toast.error(data.error || "Gagal menghapus kategori");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    }
  };

  const formatDate = (dateString: string) =>
    new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(
      new Date(dateString)
    );

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50">
      <div className="w-full px-3 md:px-6 pb-8">
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
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 rounded-2xl p-5 md:p-8 mb-6 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24" />
          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur-sm p-3 md:p-4 rounded-xl">
                <Tag className="w-7 h-7 md:w-10 md:h-10 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Kategori Barang</h1>
                <p className="text-purple-100 text-sm md:text-base">Kelola kategori untuk produk Anda</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={openAdd}
                className="bg-white hover:bg-purple-50 text-purple-600 px-4 md:px-6 py-2 md:py-3 rounded-xl flex items-center gap-2 font-semibold shadow-lg hover:shadow-xl transition-all text-sm md:text-base"
              >
                <Plus className="w-4 h-4 md:w-5 md:h-5" />
                Tambah Kategori
              </button>
              <button
                onClick={fetchData}
                disabled={loading}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 text-sm md:text-base"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">Total Kategori</p>
            <p className="text-3xl font-bold text-gray-900">{list.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">Total Barang</p>
            <p className="text-3xl font-bold text-gray-900">
              {list.reduce((sum, k) => sum + k._count.barang, 0)}
            </p>
          </div>
        </div>

        {/* Tabel */}
        {loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-16 text-center border border-gray-100">
            <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">Belum ada kategori</p>
            <p className="text-gray-400 text-sm mt-1">Klik "Tambah Kategori" untuk memulai</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-purple-600 to-indigo-700">
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">No</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Nama Kategori</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-white uppercase tracking-wider">Deskripsi</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Jumlah Barang</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider">Dibuat</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider sticky right-0 bg-gradient-to-r from-purple-600 to-indigo-700">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {list.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-purple-50 transition-colors group">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="bg-purple-100 p-2 rounded-lg">
                            <Tag className="w-4 h-4 text-purple-600" />
                          </div>
                          <span className="font-bold text-gray-900">{item.namaKategori}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {item.deskripsi || <span className="italic text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-semibold">
                          <Package className="w-3.5 h-3.5" />
                          {item._count.barang} barang
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-500">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-center sticky right-0 bg-white group-hover:bg-purple-50 transition-colors">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEdit(item)}
                            className="p-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-600 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-all"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
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
      </div>

      {/* Modal Add */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-6 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Tambah Kategori</h2>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-white hover:bg-white/20 p-2 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                  Nama Kategori <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all"
                  placeholder="Contoh: Sembako, Minuman, Snack..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                  Deskripsi
                </label>
                <textarea
                  value={formDeskripsi}
                  onChange={(e) => setFormDeskripsi(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none transition-all resize-none"
                  placeholder="Deskripsi singkat kategori (opsional)"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-xl font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white py-3 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Menyimpan...</>
                  ) : (
                    <><CheckCircle className="w-5 h-5" /> Simpan</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit */}
      {showEditModal && editingItem && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-br from-yellow-500 to-orange-600 p-6 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <Edit className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Edit Kategori</h2>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-white hover:bg-white/20 p-2 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                  Nama Kategori <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                  Deskripsi
                </label>
                <textarea
                  value={formDeskripsi}
                  onChange={(e) => setFormDeskripsi(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none transition-all resize-none"
                  placeholder="Deskripsi singkat (opsional)"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-xl font-bold transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white py-3 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Menyimpan...</>
                  ) : (
                    <><CheckCircle className="w-5 h-5" /> Update</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default KategoriBarangPage;
