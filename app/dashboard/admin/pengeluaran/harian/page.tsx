"use client";
import React, { useState, useEffect } from "react";
import {
  Search,
  DollarSign,
  TrendingUp,
  Calendar,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  X,
  Filter,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface User {
  id: number;
  name: string;
  email: string;
}

type JenisPengeluaran = "HARIAN" | "BULANAN" | "TAHUNAN";

interface Pengeluaran {
  id: number;
  namaPengeluaran: string;
  jenisPengeluaran: JenisPengeluaran;
  jumlah: number;
  keterangan: string | null;
  tanggalInput: string;
  updatedAt: string;
  user: User;
}

interface PengeluaranFormData {
  namaPengeluaran: string;
  jumlah: string;
  keterangan: string;
}

const jenisPengeluaranOptions = [
  { value: "BAHAN_BAKAR", label: "Bahan Bakar" },
  { value: "UPAH_KULI", label: "Upah Kuli" },
  { value: "LAINNYA", label: "Lainnya" },
];

const DataPengeluaranPage = () => {
  const [pengeluaranList, setPengeluaranList] = useState<Pengeluaran[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterJenis, setFilterJenis] = useState<string>("all");

  // Date range states
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingPengeluaran, setEditingPengeluaran] = useState<{
    id: number;
    data: PengeluaranFormData;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [jumlahInput, setJumlahInput] = useState<string>("");
  const [jumlahEditInput, setJumlahEditInput] = useState<string>("");
  const [namaPengeluaranInput, setNamaPengeluaranInput] = useState<string>("");
  const [keteranganInput, setKeteranganInput] = useState<string>("");

  useEffect(() => {
    fetchPengeluaran();
  }, [startDate, endDate]);

  const fetchPengeluaran = async () => {
    setLoading(true);
    try {
      let url = "/api/pengeluaran?limit=1000"; // Fetch all data for client-side filtering

      if (startDate) {
        url += `&startDate=${startDate}`;
      }
      if (endDate) {
        url += `&endDate=${endDate}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setPengeluaranList(data.data);
      }
    } catch (error) {
      console.error("Error fetching pengeluaran:", error);
      toast.error("Gagal mengambil data pengeluaran");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (pengeluaran: Pengeluaran) => {
    setEditingPengeluaran({
      id: pengeluaran.id,
      data: {
        namaPengeluaran: pengeluaran.namaPengeluaran,
        jumlah: pengeluaran.jumlah.toString(),
        keterangan: pengeluaran.keterangan || "",
      },
    });
    setJumlahEditInput(formatRupiahInput(pengeluaran.jumlah.toString()));
    setShowEditModal(true);
  };

  const handleDelete = async (id: number, namaPengeluaran: string) => {
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus pengeluaran "${getJenisLabel(
          namaPengeluaran
        )}"?`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/pengeluaran/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Pengeluaran berhasil dihapus!");
        fetchPengeluaran();
      } else {
        toast.error(data.error || "Gagal menghapus pengeluaran");
      }
    } catch (error) {
      console.error("Error deleting pengeluaran:", error);
      toast.error("Terjadi kesalahan saat menghapus pengeluaran");
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    if (editingPengeluaran) {
      setEditingPengeluaran({
        ...editingPengeluaran,
        data: {
          ...editingPengeluaran.data,
          [name]: value,
        },
      });
    }
  };

  const handleSubmitAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const jumlahValue = parseRupiahInput(jumlahInput);

    if (!namaPengeluaranInput) {
      toast.error("Nama pengeluaran harus dipilih!");
      setIsSubmitting(false);
      return;
    }

    if (jumlahValue === 0) {
      toast.error("Jumlah harus diisi!");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/pengeluaran", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          namaPengeluaran: namaPengeluaranInput,
          jumlah: jumlahValue,
          jenisPengeluaran: "HARIAN",
          keterangan: keteranganInput || null,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Pengeluaran berhasil ditambahkan!");
        setShowAddModal(false);
        setJumlahInput("");
        setNamaPengeluaranInput("");
        setKeteranganInput("");
        fetchPengeluaran();
      } else {
        toast.error(data.error || "Gagal menambahkan pengeluaran");
      }
    } catch (error) {
      console.error("Error adding pengeluaran:", error);
      toast.error("Terjadi kesalahan saat menambahkan pengeluaran");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPengeluaran) return;

    setIsSubmitting(true);

    const jumlahValue = parseRupiahInput(jumlahEditInput);

    if (jumlahValue === 0) {
      toast.error("Jumlah harus diisi!");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/pengeluaran/${editingPengeluaran.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          namaPengeluaran: editingPengeluaran.data.namaPengeluaran,
          jumlah: jumlahValue,
          keterangan: editingPengeluaran.data.keterangan || null,
          jenisPengeluaran: "HARIAN",
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Pengeluaran berhasil diupdate!");
        setShowEditModal(false);
        setEditingPengeluaran(null);
        setJumlahEditInput("");
        fetchPengeluaran();
      } else {
        toast.error(data.error || "Gagal mengupdate pengeluaran");
      }
    } catch (error) {
      console.error("Error updating pengeluaran:", error);
      toast.error("Terjadi kesalahan saat mengupdate pengeluaran");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRupiah = (number: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const formatRupiahInput = (value: string): string => {
    const numbers = value.replace(/\D/g, "");
    if (numbers === "") return "";
    const formatted = new Intl.NumberFormat("id-ID").format(parseInt(numbers));
    return `Rp ${formatted}`;
  };

  const parseRupiahInput = (value: string): number => {
    const numbers = value.replace(/[^0-9]/g, "");
    return numbers === "" ? 0 : parseInt(numbers);
  };

  const handleJumlahChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setJumlahInput(formatRupiahInput(value));
  };

  const handleJumlahEditChange = (value: string) => {
    setJumlahEditInput(formatRupiahInput(value));
  };

  const formatTanggal = (tanggal: string, _withTime: boolean = true): string => {
    const date = new Date(tanggal);
    return date
      .toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
      .toLowerCase();
  };

  const getJenisLabel = (namaPengeluaran: string): string => {
    const option = jenisPengeluaranOptions.find(
      (opt) => opt.value === namaPengeluaran
    );
    return option ? option.label : namaPengeluaran;
  };

  const getJenisColor = (namaPengeluaran: string): string => {
    switch (namaPengeluaran) {
      case "BAHAN_BAKAR":
        return "bg-red-100 text-red-800";
      case "UPAH_KULI":
        return "bg-blue-100 text-blue-800";
      case "LAINNYA":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  const setTodayFilter = () => {
    const today = new Date().toISOString().split("T")[0];
    setStartDate(today);
    setEndDate(today);
  };

  const setThisWeekFilter = () => {
    const today = new Date();
    const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
    const lastDay = new Date(
      today.setDate(today.getDate() - today.getDay() + 6)
    );

    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(lastDay.toISOString().split("T")[0]);
  };

  const setThisMonthFilter = () => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(lastDay.toISOString().split("T")[0]);
  };

  const harianPengeluaran = pengeluaranList.filter(
    (item) => item.jenisPengeluaran === "HARIAN"
  );

  const filteredPengeluaran = harianPengeluaran.filter((item) => {
    const itemDate = new Date(item.tanggalInput).toISOString().split("T")[0];
    const matchSearch =
      getJenisLabel(item.namaPengeluaran)
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      item.keterangan?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.user?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchJenis =
      filterJenis === "all" || item.namaPengeluaran === filterJenis;

    const matchDate =
      (!startDate || itemDate >= startDate) &&
      (!endDate || itemDate <= endDate);

    return matchSearch && matchJenis && matchDate;
  });

  const totalPengeluaran = filteredPengeluaran.reduce(
    (sum, item) => sum + item.jumlah,
    0
  );

  const getTodayPengeluaran = () => {
    const today = new Date().toISOString().split("T")[0];
    return filteredPengeluaran
      .filter(
        (item) =>
          new Date(item.tanggalInput).toISOString().split("T")[0] === today
      )
      .reduce((sum, item) => sum + item.jumlah, 0);
  };

  const getThisMonthPengeluaran = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return filteredPengeluaran
      .filter((item) => {
        const itemDate = new Date(item.tanggalInput);
        return (
          itemDate.getMonth() === currentMonth &&
          itemDate.getFullYear() === currentYear
        );
      })
      .reduce((sum, item) => sum + item.jumlah, 0);
  };

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

      <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Data Pengeluaran
            </h1>
            <p className="text-purple-100">
              Kelola dan pantau pengeluaran harian toko Anda
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setJumlahInput("");
                setNamaPengeluaranInput("");
                setKeteranganInput("");
                setShowAddModal(true);
              }}
              className="bg-white hover:bg-purple-50 text-purple-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium shadow-md"
            >
              <Plus className="w-4 h-4" />
              Tambah Pengeluaran
            </button>
            <button
              onClick={fetchPengeluaran}
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
              <p className="text-gray-500 text-sm font-medium">
                Total Pengeluaran
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatRupiah(totalPengeluaran)}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Hari Ini</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatRupiah(getTodayPengeluaran())}
              </p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium">Bulan Ini</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatRupiah(getThisMonthPengeluaran())}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 mb-6 shadow-md border border-gray-100">
        <div className="flex flex-col gap-4">
          {/* Search and Filter Row */}
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari nama pengeluaran, keterangan, atau user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
              />
            </div>

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="dd/mm/yyyy"
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none w-full lg:w-auto"
            />

            <span className="hidden lg:flex items-center text-gray-500 font-medium">
              -
            </span>

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="dd/mm/yyyy"
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none w-full lg:w-auto"
            />
          </div>

          {/* Quick Filter Buttons */}
          {(startDate || endDate) && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-gray-600 font-medium">
                Quick filter:
              </span>
              <button
                onClick={setTodayFilter}
                className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-all"
              >
                Hari Ini
              </button>
              <button
                onClick={setThisWeekFilter}
                className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium transition-all"
              >
                Minggu Ini
              </button>
              <button
                onClick={setThisMonthFilter}
                className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-medium transition-all"
              >
                Bulan Ini
              </button>
              <button
                onClick={clearDateFilter}
                className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-all flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Reset Filter
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
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
                    Nama Pengeluaran
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Jumlah
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Keterangan
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Diinput Oleh
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Tanggal Input
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPengeluaran.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      Tidak ada data pengeluaran ditemukan
                    </td>
                  </tr>
                ) : (
                  filteredPengeluaran.map((item, index) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getJenisColor(
                            item.namaPengeluaran
                          )}`}
                        >
                          {getJenisLabel(item.namaPengeluaran)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                        {formatRupiah(item.jumlah)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {item.keterangan || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="font-medium">{item.user?.name}</div>
                        <div className="text-xs text-gray-400">
                          {item.user?.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatTanggal(item.tanggalInput)}
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
                              handleDelete(item.id, item.namaPengeluaran)
                            }
                            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 text-center text-sm text-gray-500">
        Menampilkan {filteredPengeluaran.length} dari {harianPengeluaran.length}{" "}
        pengeluaran
      </div>

      {/* Add Modal - unchanged */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                Tambah Pengeluaran Baru
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setJumlahInput("");
                  setNamaPengeluaranInput("");
                  setKeteranganInput("");
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
                    Nama Pengeluaran <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={namaPengeluaranInput}
                    onChange={(e) => setNamaPengeluaranInput(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                    placeholder="Contoh Bahan Bakar"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Jumlah (Rp) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={jumlahInput}
                    onChange={handleJumlahChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
                    placeholder="Rp 50.000"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Contoh: 50000 akan menjadi Rp 50.000
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Keterangan
                  </label>
                  <textarea
                    value={keteranganInput}
                    onChange={(e) => setKeteranganInput(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent outline-none"
                    rows={3}
                    placeholder="Keterangan tambahan (opsional)"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setJumlahInput("");
                    setNamaPengeluaranInput("");
                    setKeteranganInput("");
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg transition-all font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-4 py-3 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Pengeluaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal - unchanged */}
      {showEditModal && editingPengeluaran && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                Edit Pengeluaran
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setJumlahEditInput("");
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
                    Nama Pengeluaran <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingPengeluaran.data.namaPengeluaran}
                    onChange={(e) =>
                      setEditingPengeluaran({
                        ...editingPengeluaran,
                        data: {
                          ...editingPengeluaran.data,
                          namaPengeluaran: e.target.value,
                        },
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                    placeholder="Contoh Bahan Bakar"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Jumlah (Rp) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={jumlahEditInput}
                    onChange={(e) => handleJumlahEditChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                    placeholder="Rp 50.000"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Contoh: 50000 akan menjadi Rp 50.000
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Keterangan
                  </label>
                  <textarea
                    name="keterangan"
                    value={editingPengeluaran.data.keterangan}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                    rows={3}
                    placeholder="Keterangan tambahan (opsional)"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setJumlahEditInput("");
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
                  {isSubmitting ? "Menyimpan..." : "Update Pengeluaran"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataPengeluaranPage;
