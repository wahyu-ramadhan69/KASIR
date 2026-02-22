"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  RefreshCw,
  ShoppingBag,
  Calendar,
  Eye,
  X,
  Pencil,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface Customer {
  id: number;
  nama: string;
  namaToko: string;
}

interface Barang {
  id: number;
  namaBarang: string;
  jumlahPerKemasan: number;
}

interface PenjualanItem {
  id: number;
  barangId: number;
  totalItem: number;
  hargaJual: number;
  diskonPerItem: number;
  barang: Barang;
}

interface UserInfo {
  id: number;
  username: string;
  role: string;
  karyawan?: {
    nama: string;
  } | null;
}

interface PenjualanHeader {
  id: number;
  kodePenjualan: string;
  namaCustomer?: string | null;
  customer?: Customer | null;
  subtotal: number;
  diskonNota: number;
  totalHarga: number;
  jumlahDibayar: number;
  kembalian: number;
  metodePembayaran: "CASH" | "TRANSFER" | "CASH_TRANSFER";
  statusPembayaran: "LUNAS" | "HUTANG";
  statusApproval: "PENDING" | "APPROVED" | "REJECTED";
  statusTransaksi: "KERANJANG" | "SELESAI" | "DIBATALKAN";
  tanggalTransaksi: string;
  createdAt: string;
  items: PenjualanItem[];
  createdBy?: UserInfo | null;
  approvedBy?: UserInfo | null;
}

const formatRupiah = (number: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(number);

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { value: "all", label: "Semua" },
  { value: "PENDING", label: "Menunggu" },
  { value: "APPROVED", label: "Disetujui" },
  { value: "REJECTED", label: "Ditolak" },
] as const;

const deriveDusPcsFromTotal = (totalItem: number, jumlahPerKemasan: number) => {
  const safePerKemasan = Math.max(1, jumlahPerKemasan);
  const jumlahDus = Math.floor(totalItem / safePerKemasan);
  const jumlahPcs = totalItem % safePerKemasan;
  return { jumlahDus, jumlahPcs };
};

const getItemSubtotal = (item: PenjualanItem) => {
  const jumlahPerKemasan = Math.max(1, item.barang?.jumlahPerKemasan || 1);
  const totalPcs = Number(item.totalItem || 0);
  const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
    totalPcs,
    jumlahPerKemasan,
  );
  const hargaTotal = item.hargaJual * jumlahDus;
  const hargaPcs =
    jumlahPcs > 0
      ? Math.round((item.hargaJual / jumlahPerKemasan) * jumlahPcs)
      : 0;
  const totalHargaSebelumDiskon = hargaTotal + hargaPcs;
  const diskonTotal = item.diskonPerItem * jumlahDus;
  return Math.max(0, totalHargaSebelumDiskon - diskonTotal);
};

const ApprovalPage = () => {
  const [orders, setOrders] = useState<PenjualanHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusApproval, setStatusApproval] = useState("PENDING");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PenjualanHeader | null>(
    null,
  );

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.success) {
          setCurrentUserId(data.data.userId ?? data.data.id ?? null);
        }
      } catch (error) {
        console.error("Error fetching session user:", error);
      }
    };
    loadUser();
  }, []);

  const fetchOrders = async (pageToLoad: number, append: boolean) => {
    if (currentUserId === null) return;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams();
      params.set("statusApproval", statusApproval || "all");
      params.set("page", String(pageToLoad));
      params.set("limit", String(PAGE_SIZE));
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await fetch(`/api/sales/approval?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        const onlyMine = (data.data || []).filter(
          (order: PenjualanHeader) => order.createdBy?.id === currentUserId,
        );
        setOrders((prev) => (append ? [...prev, ...onlyMine] : onlyMine));
        setHasMore(Boolean(data.pagination?.hasMore));
      } else {
        toast.error(data.error || "Gagal mengambil data order");
      }
    } catch (error) {
      console.error("Error fetching approval orders:", error);
      toast.error("Terjadi kesalahan saat mengambil data order");
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (currentUserId === null) return;
    setPage(1);
    setHasMore(true);
    setOrders([]);
    fetchOrders(1, false);
  }, [currentUserId, statusApproval, debouncedSearch, startDate, endDate]);

  useEffect(() => {
    if (currentUserId === null) return;
    if (page === 1) return;
    fetchOrders(page, true);
  }, [page, currentUserId]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (loading || loadingMore || !hasMore) return;
        setPage((prev) => prev + 1);
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore]);

  const filteredOrders = useMemo(() => {
    if (!debouncedSearch.trim()) return orders;
    const keyword = debouncedSearch.trim().toLowerCase();
    return orders.filter((o) =>
      [
        o.kodePenjualan,
        o.namaCustomer || "",
        o.customer?.nama || "",
        o.customer?.namaToko || "",
        o.createdBy?.username || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [orders, debouncedSearch]);

  const openDetailModal = (order: PenjualanHeader) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  const goToEdit = (orderId: number) => {
    window.location.href = `/dashboard/sales/order?editId=${orderId}`;
  };

  return (
    <div className="w-full min-h-[calc(100vh-6rem)] bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
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
      <div className="p-4 sm:p-6">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-5 sm:p-7 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="bg-white/20 backdrop-blur-sm p-3 sm:p-4 rounded-xl shrink-0">
                <ShoppingBag className="w-7 h-7 sm:w-9 sm:h-9 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-white tracking-tight">
                  Approval Order Sales
                </h1>
                <p className="text-blue-100 text-xs sm:text-sm mt-0.5">
                  Verifikasi order sebelum stok dikurangi
                </p>
              </div>
            </div>
            <button
              onClick={fetchOrders}
              className="self-start sm:self-auto bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg text-sm"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 mt-4 sm:mt-6 shadow-lg border border-gray-100">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari kode, customer, toko, user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all text-sm"
              />
            </div>

            {/* Status Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((filter) => {
                const isActive = statusApproval === filter.value;
                const colorMap: Record<string, string> = {
                  all: isActive
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600",
                  PENDING: isActive
                    ? "bg-yellow-400 text-yellow-900 border-yellow-400"
                    : "bg-white text-gray-600 border-gray-200 hover:border-yellow-300 hover:text-yellow-600",
                  APPROVED: isActive
                    ? "bg-green-500 text-white border-green-500"
                    : "bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-600",
                  REJECTED: isActive
                    ? "bg-red-500 text-white border-red-500"
                    : "bg-white text-gray-600 border-gray-200 hover:border-red-300 hover:text-red-600",
                };
                return (
                  <button
                    key={filter.value}
                    onClick={() => setStatusApproval(filter.value)}
                    className={`px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${colorMap[filter.value]}`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            {/* Date Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <div className="flex items-center gap-2 text-gray-500 shrink-0">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Tanggal:</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 sm:flex-none px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none bg-white text-sm"
                />
                <span className="text-sm text-gray-400">–</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 sm:flex-none px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none bg-white text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 sm:mt-6 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {loading && orders.length === 0 ? (
            <div className="flex justify-center items-center py-24">
              <div className="text-center text-gray-500">Memuat data...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Kode
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden sm:table-cell">
                      Dibuat
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hidden md:table-cell">
                      Tanggal
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-12 text-center text-gray-500 text-sm"
                      >
                        Tidak ada order untuk ditampilkan
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-gray-900 text-sm">
                            {order.kodePenjualan}
                          </div>
                          <div className="text-xs text-gray-500">
                            {order.items.length} item
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-sm font-medium text-gray-900">
                            {order.customer?.nama || order.namaCustomer || "-"}
                          </p>
                          {order.customer?.namaToko && (
                            <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-medium">
                              {order.customer.namaToko}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 hidden sm:table-cell">
                          {order.createdBy?.karyawan?.nama ||
                            order.createdBy?.username ||
                            "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 hidden md:table-cell">
                          {new Date(order.tanggalTransaksi).toLocaleString(
                            "id-ID",
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold text-gray-900 text-sm">
                            {formatRupiah(order.totalHarga)}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              order.statusApproval === "APPROVED"
                                ? "bg-green-100 text-green-700"
                                : order.statusApproval === "REJECTED"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                            }`}
                          >
                            {order.statusApproval === "APPROVED"
                              ? "Disetujui"
                              : order.statusApproval === "REJECTED"
                                ? "Ditolak"
                              : "Menunggu"}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openDetailModal(order)}
                              className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold inline-flex items-center gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              Detail
                            </button>
                            {order.statusApproval === "PENDING" && (
                              <button
                                onClick={() => goToEdit(order.id)}
                                className="px-3 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 text-xs font-semibold inline-flex items-center gap-2"
                              >
                                <Pencil className="w-4 h-4" />
                                Edit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div ref={loadMoreRef} className="h-1" />
              {loadingMore && (
                <div className="py-4 text-center text-sm text-gray-500">
                  Memuat data lagi...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showDetailModal && selectedOrder && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3 text-white">
                <ShoppingBag className="w-5 h-5" />
                <div>
                  <div className="text-sm opacity-80">Detail Order</div>
                  <div className="font-bold">{selectedOrder.kodePenjualan}</div>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-white hover:bg-white/10 p-2 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-90px)] space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="text-xs text-slate-500 mb-1">Customer</div>
                  <div className="font-semibold text-slate-900">
                    {selectedOrder.customer?.nama ||
                      selectedOrder.namaCustomer ||
                      "-"}
                  </div>
                  {selectedOrder.customer?.namaToko && (
                    <div className="text-xs text-slate-500">
                      {selectedOrder.customer.namaToko}
                    </div>
                  )}
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="text-xs text-slate-500 mb-1">Tanggal</div>
                  <div className="font-semibold text-slate-900">
                    {new Date(selectedOrder.tanggalTransaksi).toLocaleString(
                      "id-ID",
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  Item Order
                </div>
                <div className="divide-y divide-slate-200">
                  {selectedOrder.items.map((item) => {
                    const jumlahPerKemasan = Math.max(
                      1,
                      item.barang?.jumlahPerKemasan || 1,
                    );
                    const totalPcs = Number(item.totalItem || 0);
                    const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
                      totalPcs,
                      jumlahPerKemasan,
                    );
                    const subtotalItem = getItemSubtotal(item);
                    return (
                      <div key={item.id} className="px-4 py-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-900">
                              {item.barang?.namaBarang ||
                                `Barang #${item.barangId}`}
                            </div>
                            <div className="text-xs text-slate-500">
                              Total: {totalPcs} pcs (
                              {jumlahPerKemasan > 1
                                ? `${jumlahDus} Dus + ${jumlahPcs} Pcs`
                                : `${totalPcs} Pcs`}
                              )
                            </div>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            Harga: {formatRupiah(item.hargaJual)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Subtotal</span>
                          <span className="font-semibold text-slate-900">
                            {formatRupiah(subtotalItem)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-semibold">
                    {formatRupiah(selectedOrder.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Diskon Nota</span>
                  <span className="font-semibold">
                    -{formatRupiah(selectedOrder.diskonNota)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-200">
                  <span>Total</span>
                  <span>{formatRupiah(selectedOrder.totalHarga)}</span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-semibold"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalPage;
