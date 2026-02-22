"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  RefreshCw,
  Eye,
  Check,
  X,
  ShoppingBag,
  User,
  Package,
  Calendar,
  CreditCard,
  Banknote,
  AlertCircle,
  AlertTriangle,
  Clock,
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

interface EditableItem {
  id: number;
  barangId: number;
  jumlahDus: number;
  jumlahPcs: number;
  hargaJual: number;
  diskonPerItem: number;
  barang: Barang;
}

const formatRupiah = (number: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(number);

const formatRupiahInput = (value: string): string => {
  const number = value.replace(/[^\d]/g, "");
  if (!number) return "";
  return parseInt(number).toLocaleString("id-ID");
};

const parseRupiahToNumber = (value: string): number => {
  return parseInt(value.replace(/[^\d]/g, "")) || 0;
};

const deriveDusPcsFromTotal = (totalItem: number, jumlahPerKemasan: number) => {
  const safePerKemasan = Math.max(1, jumlahPerKemasan);
  const jumlahDus = Math.floor(totalItem / safePerKemasan);
  const jumlahPcs = totalItem % safePerKemasan;
  return { jumlahDus, jumlahPcs };
};

const getTotalItemPcs = (item: EditableItem): number => {
  return item.jumlahDus * item.barang.jumlahPerKemasan + item.jumlahPcs;
};

const calculateSummary = (items: EditableItem[]) => {
  let subtotal = 0;
  let totalDiskonItem = 0;

  items.forEach((item) => {
    const jumlahPerKemasan = Math.max(1, item.barang.jumlahPerKemasan);
    const totalPcs = getTotalItemPcs(item);
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
    const diskon = item.diskonPerItem * jumlahDus;
    subtotal += totalHargaSebelumDiskon;
    totalDiskonItem += diskon;
  });

  return {
    subtotal,
    totalDiskonItem,
    totalHarga: Math.max(0, subtotal - totalDiskonItem),
  };
};

const ApprovalPage = () => {
  const [orders, setOrders] = useState<PenjualanHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusApproval, setStatusApproval] = useState("PENDING");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PenjualanHeader | null>(
    null,
  );
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  const [approving, setApproving] = useState(false);
  const [metodePembayaran, setMetodePembayaran] = useState<
    "CASH" | "TRANSFER" | "CASH_TRANSFER"
  >("CASH");
  const [jumlahDibayar, setJumlahDibayar] = useState("");
  const [jumlahCash, setJumlahCash] = useState("");
  const [jumlahTransfer, setJumlahTransfer] = useState("");

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("statusApproval", statusApproval || "all");
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await fetch(`/api/sales/approval?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data || []);
      } else {
        toast.error(data.error || "Gagal mengambil data order");
      }
    } catch (error) {
      console.error("Error fetching approval orders:", error);
      toast.error("Terjadi kesalahan saat mengambil data order");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusApproval, debouncedSearch, startDate, endDate]);

  const handleApprove = async (id: number, itemsOverride?: EditableItem[]) => {
    try {
      setApproving(true);
      const payload: any = { penjualanId: id };
      if (itemsOverride && itemsOverride.length > 0) {
        payload.items = itemsOverride.map((item) => ({
          id: item.id,
          barangId: item.barangId,
          jumlahDus: item.jumlahDus,
          jumlahPcs: item.jumlahPcs,
          totalItem: getTotalItemPcs(item),
          hargaJual: item.hargaJual,
          diskonPerItem: item.diskonPerItem,
        }));
      }
      payload.metodePembayaran = metodePembayaran;
      payload.jumlahDibayar = getEffectiveJumlahDibayar();
      const { cash, transfer } = getPembayaranBreakdown();
      payload.totalCash = cash;
      payload.totalTransfer = transfer;

      const res = await fetch("/api/sales/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders();
        setShowDetailModal(false);
        setSelectedOrder(null);
        setEditableItems([]);
        setMetodePembayaran("CASH");
        setJumlahDibayar("");
        setJumlahCash("");
        setJumlahTransfer("");
        if (selectedOrder?.id === id) {
          setSelectedOrder((prev) =>
            prev
              ? {
                  ...prev,
                  statusApproval: "APPROVED",
                }
              : prev,
          );
        }
      } else {
        toast.error(data.error || "Gagal approve order");
      }
    } catch (error) {
      console.error("Error approving order:", error);
      toast.error("Terjadi kesalahan saat approve order");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (id: number) => {
    try {
      setApproving(true);
      const res = await fetch("/api/sales/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ penjualanId: id, action: "REJECT" }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders();
        setShowDetailModal(false);
        setSelectedOrder(null);
        setEditableItems([]);
        setMetodePembayaran("CASH");
        setJumlahDibayar("");
        setJumlahCash("");
        setJumlahTransfer("");
        if (selectedOrder?.id === id) {
          setSelectedOrder((prev) =>
            prev
              ? {
                  ...prev,
                  statusApproval: "REJECTED",
                }
              : prev,
          );
        }
      } else {
        toast.error(data.error || "Gagal menolak order");
      }
    } catch (error) {
      console.error("Error rejecting order:", error);
      toast.error("Terjadi kesalahan saat menolak order");
    } finally {
      setApproving(false);
    }
  };

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
    const hydrated: EditableItem[] = order.items.map((item) => {
      const jumlahPerKemasan = Math.max(1, item.barang?.jumlahPerKemasan || 1);
      const total = Number(item.totalItem || 0);
      const derived = deriveDusPcsFromTotal(total, jumlahPerKemasan);
      const useSingleItemMode = jumlahPerKemasan <= 1;
      return {
        id: item.id,
        barangId: item.barangId,
        jumlahDus: useSingleItemMode ? 0 : derived.jumlahDus,
        jumlahPcs: useSingleItemMode ? total : derived.jumlahPcs,
        hargaJual: Number(item.hargaJual || 0),
        diskonPerItem: Number(item.diskonPerItem || 0),
        barang: item.barang,
      };
    });
    setEditableItems(hydrated);
    setMetodePembayaran(order.metodePembayaran || "CASH");
    if (order.metodePembayaran === "CASH_TRANSFER") {
      const total = Number(order.jumlahDibayar || 0);
      setJumlahCash(total ? total.toLocaleString("id-ID") : "");
      setJumlahTransfer("");
      setJumlahDibayar(total ? total.toLocaleString("id-ID") : "");
    } else {
      setJumlahDibayar(
        Number(order.jumlahDibayar || 0).toLocaleString("id-ID"),
      );
      setJumlahCash("");
      setJumlahTransfer("");
    }
    setShowDetailModal(true);
  };

  const updateItemQuantity = (
    index: number,
    field: "jumlahDus" | "jumlahPcs",
    value: number,
  ) => {
    setEditableItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      const jumlahPerKemasan = Math.max(1, item.barang.jumlahPerKemasan);

      if (field === "jumlahDus") {
        item.jumlahDus = Math.max(0, value);
      } else {
        const maxPcs = jumlahPerKemasan > 1 ? jumlahPerKemasan - 1 : 1000000;
        item.jumlahPcs = Math.max(0, Math.min(value, maxPcs));
      }

      next[index] = item;
      return next;
    });
  };

  const updateItemPrice = (index: number, value: number) => {
    setEditableItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], hargaJual: Math.max(0, value) };
      return next;
    });
  };

  const updateItemDiskon = (index: number, value: number) => {
    setEditableItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], diskonPerItem: Math.max(0, value) };
      return next;
    });
  };

  const removeItem = (index: number) => {
    setEditableItems((prev) => prev.filter((_, i) => i !== index));
  };

  const getEffectiveJumlahDibayar = (): number => {
    if (metodePembayaran === "CASH_TRANSFER") {
      return (
        parseRupiahToNumber(jumlahCash) + parseRupiahToNumber(jumlahTransfer)
      );
    }
    return parseRupiahToNumber(jumlahDibayar);
  };

  const getPembayaranBreakdown = (): { cash: number; transfer: number } => {
    if (metodePembayaran === "CASH_TRANSFER") {
      return {
        cash: parseRupiahToNumber(jumlahCash),
        transfer: parseRupiahToNumber(jumlahTransfer),
      };
    }

    if (metodePembayaran === "TRANSFER") {
      return { cash: 0, transfer: parseRupiahToNumber(jumlahDibayar) };
    }

    return { cash: parseRupiahToNumber(jumlahDibayar), transfer: 0 };
  };

  const handleMetodePembayaranChange = (
    metode: "CASH" | "TRANSFER" | "CASH_TRANSFER",
  ) => {
    if (metode === "CASH_TRANSFER") {
      if (jumlahDibayar) {
        setJumlahCash(jumlahDibayar);
      }
      if (!jumlahTransfer) {
        setJumlahTransfer("");
      }
    } else if (metodePembayaran === "CASH_TRANSFER") {
      const total =
        parseRupiahToNumber(jumlahCash) + parseRupiahToNumber(jumlahTransfer);
      setJumlahDibayar(total ? total.toLocaleString("id-ID") : "");
      setJumlahCash("");
      setJumlahTransfer("");
    }

    setMetodePembayaran(metode);
  };

  const hasPaymentInput =
    metodePembayaran === "CASH_TRANSFER"
      ? jumlahCash.trim() !== "" || jumlahTransfer.trim() !== ""
      : jumlahDibayar.trim() !== "";

  const getPaymentStatus = () => {
    const bayar = getEffectiveJumlahDibayar();
    const summary = calculateSummary(editableItems);
    const total = Math.max(
      0,
      summary.subtotal -
        summary.totalDiskonItem -
        (selectedOrder?.diskonNota || 0),
    );

    if (bayar >= total) {
      return {
        status: "LUNAS",
        kembalian: bayar - total,
        sisaHutang: 0,
        canCheckout: true,
        message: null,
      };
    }

    const sisaHutang = total - bayar;
    if (!selectedOrder?.customer) {
      return {
        status: "HUTANG",
        kembalian: 0,
        sisaHutang,
        canCheckout: false,
        message: "Customer tidak terdaftar tidak bisa mengambil hutang",
      };
    }

    return {
      status: "HUTANG",
      kembalian: 0,
      sisaHutang,
      canCheckout: true,
      message: null,
    };
  };

  const paymentStatus = hasPaymentInput ? getPaymentStatus() : null;

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
      <div className="p-6">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-7 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
                <ShoppingBag className="w-9 h-9 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  Approval Order Sales
                </h1>
                <p className="text-blue-100 text-sm">
                  Verifikasi order sebelum stok dikurangi
                </p>
              </div>
            </div>
            <button
              onClick={fetchOrders}
              className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 mt-6 shadow-lg border border-gray-100">
          <div className="flex flex-col xl:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari kode, customer, toko, user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
              />
            </div>

            <div className="flex gap-3 flex-wrap">
              <select
                value={statusApproval}
                onChange={(e) => setStatusApproval(e.target.value)}
                className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none bg-white"
              >
                <option value="PENDING">Menunggu</option>
                <option value="APPROVED">Disetujui</option>
                <option value="REJECTED">Ditolak</option>
                <option value="all">Semua</option>
              </select>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none bg-white text-sm"
                />
                <span className="text-sm text-gray-400">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none bg-white text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mt-6 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-24">
              <div className="text-center text-gray-500">Memuat data...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Kode
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Dibuat
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
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
                        className="px-6 py-12 text-center text-gray-500"
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
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {order.createdBy?.karyawan?.nama ||
                            order.createdBy?.username ||
                            "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {new Date(order.tanggalTransaksi).toLocaleString(
                            "id-ID",
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold text-gray-900">
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
                          <button
                            onClick={() => openDetailModal(order)}
                            className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold inline-flex items-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            Detail
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
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

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-90px)]">
              {editableItems.some((item) => getTotalItemPcs(item) <= 0) && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                  Ada item dengan jumlah 0. Hapus item tersebut atau ubah
                  jumlahnya sebelum approve.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                  <div className="text-xs text-slate-500 mb-1">Dibuat Oleh</div>
                  <div className="font-semibold text-slate-900">
                    {selectedOrder.createdBy?.karyawan?.nama ||
                      selectedOrder.createdBy?.username ||
                      "-"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(selectedOrder.tanggalTransaksi).toLocaleString(
                      "id-ID",
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
                <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  Item Order
                </div>
                <div className="divide-y divide-slate-200">
                  {editableItems.map((item, index) => {
                    const totalPcs = getTotalItemPcs(item);
                    const jumlahPerKemasan = Math.max(
                      1,
                      item.barang.jumlahPerKemasan,
                    );
                    const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
                      totalPcs,
                      jumlahPerKemasan,
                    );
                    const hargaTotal = item.hargaJual * jumlahDus;
                    const hargaPcs =
                      jumlahPcs > 0
                        ? Math.round(
                            (item.hargaJual / jumlahPerKemasan) * jumlahPcs,
                          )
                        : 0;
                    const totalHargaSebelumDiskon = hargaTotal + hargaPcs;
                    const diskonTotal = item.diskonPerItem * jumlahDus;
                    const subtotalItem = totalHargaSebelumDiskon - diskonTotal;

                    return (
                      <div key={item.id} className="px-4 py-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Package className="w-4 h-4 text-slate-400" />
                            <div>
                              <div className="font-medium text-slate-900">
                                {item.barang?.namaBarang ||
                                  `Barang #${item.barangId}`}
                              </div>
                              <div className="text-xs text-slate-500">
                                Total: {totalPcs} pcs
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => removeItem(index)}
                            className="text-xs text-red-600 hover:text-red-700"
                          >
                            Hapus
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {jumlahPerKemasan > 1 ? (
                            <>
                              <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                                <span className="text-xs font-semibold text-slate-600">
                                  Dus
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      updateItemQuantity(
                                        index,
                                        "jumlahDus",
                                        item.jumlahDus - 1,
                                      )
                                    }
                                    className="w-7 h-7 rounded-lg bg-red-500 text-white text-xs"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    value={item.jumlahDus}
                                    onChange={(e) =>
                                      updateItemQuantity(
                                        index,
                                        "jumlahDus",
                                        Number(e.target.value),
                                      )
                                    }
                                    className="w-16 text-center border border-slate-300 rounded-lg text-sm font-semibold"
                                  />
                                  <button
                                    onClick={() =>
                                      updateItemQuantity(
                                        index,
                                        "jumlahDus",
                                        item.jumlahDus + 1,
                                      )
                                    }
                                    className="w-7 h-7 rounded-lg bg-green-500 text-white text-xs"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                                <span className="text-xs font-semibold text-slate-600">
                                  Pcs
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      updateItemQuantity(
                                        index,
                                        "jumlahPcs",
                                        item.jumlahPcs - 1,
                                      )
                                    }
                                    className="w-7 h-7 rounded-lg bg-red-500 text-white text-xs"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    max={jumlahPerKemasan - 1}
                                    value={item.jumlahPcs}
                                    onChange={(e) =>
                                      updateItemQuantity(
                                        index,
                                        "jumlahPcs",
                                        Number(e.target.value),
                                      )
                                    }
                                    className="w-16 text-center border border-slate-300 rounded-lg text-sm font-semibold"
                                  />
                                  <button
                                    onClick={() =>
                                      updateItemQuantity(
                                        index,
                                        "jumlahPcs",
                                        item.jumlahPcs + 1,
                                      )
                                    }
                                    className="w-7 h-7 rounded-lg bg-green-500 text-white text-xs"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                              <span className="text-xs font-semibold text-slate-600">
                                Qty
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() =>
                                    updateItemQuantity(
                                      index,
                                      "jumlahPcs",
                                      item.jumlahPcs - 1,
                                    )
                                  }
                                  className="w-7 h-7 rounded-lg bg-red-500 text-white text-xs"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  value={item.jumlahPcs}
                                  onChange={(e) =>
                                    updateItemQuantity(
                                      index,
                                      "jumlahPcs",
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-16 text-center border border-slate-300 rounded-lg text-sm font-semibold"
                                />
                                <button
                                  onClick={() =>
                                    updateItemQuantity(
                                      index,
                                      "jumlahPcs",
                                      item.jumlahPcs + 1,
                                    )
                                  }
                                  className="w-7 h-7 rounded-lg bg-green-500 text-white text-xs"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <span className="text-xs font-semibold text-slate-600">
                              Harga / Dus
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={item.hargaJual}
                              onChange={(e) =>
                                updateItemPrice(index, Number(e.target.value))
                              }
                              className="w-32 text-right border border-slate-300 rounded-lg text-sm font-semibold px-2 py-1"
                            />
                          </div>

                          <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <span className="text-xs font-semibold text-slate-600">
                              Diskon / Dus
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={item.diskonPerItem}
                              onChange={(e) =>
                                updateItemDiskon(index, Number(e.target.value))
                              }
                              className="w-32 text-right border border-slate-300 rounded-lg text-sm font-semibold px-2 py-1"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span>Subtotal Item</span>
                          <span className="font-semibold text-slate-900">
                            {formatRupiah(subtotalItem)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Metode Pembayaran */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-slate-700" />
                  <label className="font-bold text-slate-900 uppercase text-xs tracking-wider">
                    Metode Pembayaran
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleMetodePembayaranChange("CASH")}
                    className={`py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 border-2 ${
                      metodePembayaran === "CASH"
                        ? "bg-slate-800 border-slate-800 text-white"
                        : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    <Banknote className="w-5 h-5" />
                    Cash
                  </button>
                  <button
                    onClick={() => handleMetodePembayaranChange("TRANSFER")}
                    className={`py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 border-2 ${
                      metodePembayaran === "TRANSFER"
                        ? "bg-slate-800 border-slate-800 text-white"
                        : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    Transfer
                  </button>
                  <button
                    onClick={() =>
                      handleMetodePembayaranChange("CASH_TRANSFER")
                    }
                    className={`py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 border-2 ${
                      metodePembayaran === "CASH_TRANSFER"
                        ? "bg-slate-800 border-slate-800 text-white"
                        : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    Cash + Transfer
                  </button>
                </div>
              </div>

              {/* Payment Input */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Banknote className="w-4 h-4 text-slate-700" />
                  <label className="font-bold text-slate-900 uppercase text-xs tracking-wider">
                    {metodePembayaran === "CASH_TRANSFER"
                      ? "Jumlah Pembayaran"
                      : "Jumlah Dibayar"}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                </div>

                {metodePembayaran === "CASH_TRANSFER" ? (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          value={jumlahCash}
                          onChange={(e) =>
                            setJumlahCash(formatRupiahInput(e.target.value))
                          }
                          className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-transparent outline-none text-base font-semibold"
                          placeholder="Jumlah Cash"
                        />
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-semibold">
                          Rp
                        </span>
                        <input
                          type="text"
                          value={jumlahTransfer}
                          onChange={(e) =>
                            setJumlahTransfer(formatRupiahInput(e.target.value))
                          }
                          className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-transparent outline-none text-base font-semibold"
                          placeholder="Jumlah Transfer"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 font-medium">
                      Total dibayar: {formatRupiah(getEffectiveJumlahDibayar())}
                    </p>
                  </>
                ) : (
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 font-semibold">
                      Rp
                    </span>
                    <input
                      type="text"
                      value={jumlahDibayar}
                      onChange={(e) =>
                        setJumlahDibayar(formatRupiahInput(e.target.value))
                      }
                      className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-transparent outline-none text-base font-semibold"
                      placeholder="0"
                    />
                  </div>
                )}

                {metodePembayaran !== "CASH_TRANSFER" && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    <button
                      onClick={() => {
                        const summary = calculateSummary(editableItems);
                        const total = Math.max(
                          0,
                          summary.subtotal -
                            summary.totalDiskonItem -
                            (selectedOrder?.diskonNota || 0),
                        );
                        setJumlahDibayar(
                          total ? total.toLocaleString("id-ID") : "",
                        );
                      }}
                      className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold hover:bg-slate-200 transition-colors"
                    >
                      Semua
                    </button>
                    {[50, 75, 100].map((percent) => (
                      <button
                        key={percent}
                        onClick={() => {
                          const summary = calculateSummary(editableItems);
                          const total = Math.max(
                            0,
                            summary.subtotal -
                              summary.totalDiskonItem -
                              (selectedOrder?.diskonNota || 0),
                          );
                          const value = Math.round(total * (percent / 100));
                          setJumlahDibayar(
                            value ? value.toLocaleString("id-ID") : "",
                          );
                        }}
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold hover:bg-slate-200 transition-colors"
                      >
                        {percent}%
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Preview */}
              {paymentStatus && (
                <div
                  className={`rounded-lg p-4 mb-4 ${
                    paymentStatus.status === "LUNAS"
                      ? "bg-green-50 border border-green-200"
                      : paymentStatus.canCheckout
                        ? "bg-yellow-50 border border-yellow-200"
                        : "bg-red-50 border border-red-200"
                  }`}
                >
                  {paymentStatus.status === "LUNAS" ? (
                    <>
                      <div className="flex items-center gap-2 text-green-700 font-medium">
                        <Check className="w-5 h-5" />
                        Status: LUNAS
                      </div>
                      {paymentStatus.kembalian > 0 && (
                        <p className="text-green-600 mt-1">
                          Kembalian: {formatRupiah(paymentStatus.kembalian)}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div
                        className={`flex items-center gap-2 font-medium ${
                          paymentStatus.canCheckout
                            ? "text-yellow-700"
                            : "text-red-700"
                        }`}
                      >
                        {paymentStatus.canCheckout ? (
                          <AlertCircle className="w-5 h-5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5" />
                        )}
                        Status: HUTANG
                      </div>
                      <p
                        className={`mt-1 ${
                          paymentStatus.canCheckout
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        Sisa Hutang: {formatRupiah(paymentStatus.sisaHutang)}
                      </p>
                      {paymentStatus.message && (
                        <p className="text-red-600 mt-2 text-sm font-medium">
                          ⚠️ {paymentStatus.message}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                {(() => {
                  const summary = calculateSummary(editableItems);
                  return (
                    <>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600">Subtotal</span>
                        <span className="font-semibold">
                          {formatRupiah(summary.subtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600">Diskon Item</span>
                        <span className="font-semibold">
                          -{formatRupiah(summary.totalDiskonItem)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600">Diskon Nota</span>
                        <span className="font-semibold">
                          -{formatRupiah(selectedOrder.diskonNota)}
                        </span>
                      </div>
                      <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-200">
                        <span>Total</span>
                        <span>
                          {formatRupiah(
                            Math.max(
                              0,
                              summary.subtotal -
                                summary.totalDiskonItem -
                                selectedOrder.diskonNota,
                            ),
                          )}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => handleReject(selectedOrder.id)}
                  disabled={
                    approving || selectedOrder.statusApproval !== "PENDING"
                  }
                  className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Tolak
                </button>
                <button
                  onClick={() => handleApprove(selectedOrder.id, editableItems)}
                  disabled={
                    approving ||
                    selectedOrder.statusApproval !== "PENDING" ||
                    editableItems.length === 0 ||
                    editableItems.some((item) => getTotalItemPcs(item) <= 0) ||
                    !hasPaymentInput ||
                    (paymentStatus !== null && !paymentStatus.canCheckout)
                  }
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {approving ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Setuju
                    </>
                  )}
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
