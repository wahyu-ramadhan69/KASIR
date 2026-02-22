"use client";
import { useState, useEffect } from "react";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  Check,
  Package,
  User,
  CreditCard,
  Receipt,
  AlertCircle,
  Banknote,
  Building2,
  Calendar,
  Clock,
  UserPlus,
  AlertTriangle,
  RefreshCw,
  Phone,
  Users,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface Customer {
  id: number;
  nik: string;
  nama: string;
  alamat: string;
  namaToko: string;
  noHp: string;
  limit_piutang: number;
  piutang: number;
}

interface CustomerHutangInfo {
  customerId: number;
  nama: string;
  namaToko: string;
  limit_piutang: number;
  piutang: number;
  sisaLimitHutang: number;
  jumlahTransaksiHutang: number;
}

interface Barang {
  id: number;
  namaBarang: string;
  hargaBeli: number;
  hargaJual: number;
  stok: number;
  jumlahPerKemasan: number;
  jenisKemasan: string;
  limitPenjualan: number;
  supplierId: number;
  berat: number;
}

interface CartItem {
  tempId: string;
  itemId?: number;
  barangId: number;
  jumlahDus: number;
  jumlahPcs: number;
  hargaJual: number;
  diskonPerItem: number;
  barang: Barang;
}

interface PenjualanItem {
  id: number;
  barangId: number;
  jumlahDus?: number;
  jumlahPcs?: number;
  totalItem?: number;
  hargaJual: number;
  diskonPerItem: number;
  berat?: number;
  barang: Barang;
}

interface PembayaranPenjualan {
  metodePembayaran?: "CASH" | "TRANSFER" | "CASH_TRANSFER";
  metode?: "CASH" | "TRANSFER" | "CASH_TRANSFER";
}

interface PenjualanHeader {
  id: number;
  kodePenjualan: string;
  customerId: number | null;
  namaCustomer: string | null;
  subtotal: number;
  diskonNota: number;
  totalHarga: number;
  jumlahDibayar: number;
  kembalian: number;
  metodePembayaran: "CASH" | "TRANSFER" | "CASH_TRANSFER";
  statusPembayaran: "LUNAS" | "HUTANG";
  statusTransaksi: "KERANJANG" | "SELESAI" | "DIBATALKAN";
  tanggalTransaksi: string;
  tanggalJatuhTempo: string;
  customer: Customer | null;
  items: PenjualanItem[];
  pembayaran?: PembayaranPenjualan[];
  createdAt: string;
  updatedAt: string;
  calculation?: {
    items: any[];
    ringkasan: {
      subtotal: number;
      totalDiskonItem: number;
      diskonNota: number;
      totalHarga: number;
    };
  };
}

interface Props {
  isAdmin?: boolean;
  userId?: number;
}

const formatRupiahInput = (value: string): string => {
  const number = value.replace(/[^\d]/g, "");
  if (!number) return "";
  return parseInt(number).toLocaleString("id-ID");
};

const parseRupiahToNumber = (value: string): number => {
  return parseInt(value.replace(/[^\d]/g, "")) || 0;
};

const formatGramsToKg = (grams: number): string => {
  if (!Number.isFinite(grams)) return "";
  const kg = grams / 1000;
  const formatted = kg.toFixed(3).replace(/\.?0+$/, "");
  return formatted.replace(".", ",");
};

const getTotalItemPcs = (item: CartItem): number => {
  return item.jumlahDus * item.barang.jumlahPerKemasan + item.jumlahPcs;
};

const deriveDusPcsFromTotal = (totalItem: number, jumlahPerKemasan: number) => {
  const safePerKemasan = Math.max(1, jumlahPerKemasan);
  const jumlahDus = Math.floor(totalItem / safePerKemasan);
  const jumlahPcs = totalItem % safePerKemasan;
  return { jumlahDus, jumlahPcs };
};

const calculateBeratGramsFromBarang = (
  barang: Barang,
  totalPcs: number,
): number => {
  const beratPerItem = Number(barang.berat || 0);
  if (beratPerItem <= 0 || totalPcs <= 0) return 0;
  return beratPerItem * totalPcs;
};

const PenjualanPage = ({ isAdmin = false, userId }: Props) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchBarang, setSearchBarang] = useState<string>("");
  const [searchCustomer, setSearchCustomer] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [customerHutangInfo, setCustomerHutangInfo] =
    useState<CustomerHutangInfo | null>(null);
  const [loadingHutangInfo, setLoadingHutangInfo] = useState<boolean>(false);
  const [manualCustomerName, setManualCustomerName] = useState<string>("");
  const [useManualCustomer, setUseManualCustomer] = useState<boolean>(false);
  const [expandCustomerSearch, setExpandCustomerSearch] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [todaySales, setTodaySales] = useState<{ [barangId: number]: number }>(
    {},
  );

  // Mobile: tab state ("products" | "cart")
  const [mobileTab, setMobileTab] = useState<"products" | "cart">("products");
  // Mobile: cart panel expand
  const [showMobileCartPanel, setShowMobileCartPanel] = useState(false);

  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [diskonNota, setDiskonNota] = useState<string>("0");
  const [diskonNotaType, setDiskonNotaType] = useState<"rupiah" | "persen">(
    "rupiah",
  );
  const [jumlahDibayar, setJumlahDibayar] = useState<string>("");
  const [jumlahCash, setJumlahCash] = useState<string>("");
  const [jumlahTransfer, setJumlahTransfer] = useState<string>("");
  const [metodePembayaran, setMetodePembayaran] = useState<
    "CASH" | "TRANSFER" | "CASH_TRANSFER"
  >("CASH");
  const [tanggalTransaksi, setTanggalTransaksi] = useState<string>("");
  const [tanggalJatuhTempo, setTanggalJatuhTempo] = useState<string>("");

  const [itemDiskonTypes, setItemDiskonTypes] = useState<{
    [key: string]: "rupiah" | "persen";
  }>({});
  const [itemDiskonValues, setItemDiskonValues] = useState<{
    [key: string]: string;
  }>({});
  const [itemHargaValues, setItemHargaValues] = useState<{
    [key: string]: string;
  }>({});

  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [editPenjualanId, setEditPenjualanId] = useState<number | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<boolean>(false);
  const [originalQtyByBarangId, setOriginalQtyByBarangId] = useState<{
    [key: number]: number;
  }>({});

  const resolveMetodePembayaran = (
    data: any,
  ): "CASH" | "TRANSFER" | "CASH_TRANSFER" => {
    const metode =
      data?.metodePembayaran ??
      data?.pembayaran?.metodePembayaran ??
      data?.pembayaran?.[0]?.metodePembayaran ??
      data?.pembayaran?.metode ??
      data?.pembayaran?.[0]?.metode;
    if (metode === "TRANSFER") return "TRANSFER";
    if (metode === "CASH_TRANSFER") return "CASH_TRANSFER";
    return "CASH";
  };

  useEffect(() => {
    fetchBarang();
    fetchTodaySales();
    const today = new Date().toISOString().split("T")[0];
    setTanggalTransaksi(today);
  }, []);

  useEffect(() => {
    const editIdParam = searchParams.get("editId");
    if (!editIdParam) {
      setEditPenjualanId(null);
      return;
    }
    const parsedId = parseInt(editIdParam);
    if (Number.isNaN(parsedId)) {
      toast.error("ID penjualan tidak valid untuk edit");
      setEditPenjualanId(null);
      return;
    }
    setEditPenjualanId(parsedId);
  }, [searchParams]);

  useEffect(() => {
    if (editPenjualanId) {
      loadPenjualanForEdit(editPenjualanId);
    } else {
      setOriginalQtyByBarangId({});
    }
  }, [editPenjualanId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchCustomer.trim().length >= 2) {
        searchCustomerByKeyword(searchCustomer);
      } else if (searchCustomer.trim().length === 0) {
        setCustomerList([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchCustomer]);

  const loadPenjualanForEdit = async (penjualanId: number) => {
    setLoadingEdit(true);
    try {
      const res = await fetch(`/api/sales/order/${penjualanId}`);
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "Gagal mengambil data penjualan");
        return;
      }
      const penjualan: PenjualanHeader = data.data;
      if (
        penjualan.statusApproval !== "PENDING" ||
        penjualan.statusTransaksi !== "KERANJANG"
      ) {
        toast.error("Hanya order pending yang bisa diedit");
        setEditPenjualanId(null);
        router.replace("/dashboard/sales/riwayat/order");
        return;
      }
      const originalQtyMap: { [key: number]: number } = {};
      const newCartItems: CartItem[] = penjualan.items.map((item) => {
        const jumlahPerKemasan = Number(item.barang?.jumlahPerKemasan || 1);
        const fallbackTotalItem =
          item.totalItem !== undefined && item.totalItem !== null
            ? Number(item.totalItem || 0)
            : Number(item.jumlahDus || 0) * jumlahPerKemasan +
              Number(item.jumlahPcs || 0);
        const derived = deriveDusPcsFromTotal(
          fallbackTotalItem,
          jumlahPerKemasan,
        );
        const useSingleItemMode = jumlahPerKemasan <= 1;
        const jumlahDus = useSingleItemMode
          ? 0
          : item.jumlahDus !== undefined
            ? Number(item.jumlahDus)
            : derived.jumlahDus;
        const jumlahPcs = useSingleItemMode
          ? fallbackTotalItem
          : item.jumlahPcs !== undefined
            ? Number(item.jumlahPcs)
            : derived.jumlahPcs;
        originalQtyMap[item.barangId] =
          (originalQtyMap[item.barangId] || 0) + fallbackTotalItem;
        return {
          tempId: `item-${item.id}`,
          itemId: item.id,
          barangId: item.barangId,
          jumlahDus,
          jumlahPcs,
          hargaJual: Number(item.hargaJual),
          diskonPerItem: Number(item.diskonPerItem),
          barang: item.barang,
        };
      });
      const diskonTypes: { [key: string]: "rupiah" | "persen" } = {};
      const diskonValues: { [key: string]: string } = {};
      const hargaValues: { [key: string]: string } = {};
      newCartItems.forEach((item) => {
        diskonTypes[item.tempId] = "rupiah";
        diskonValues[item.tempId] = Number(item.diskonPerItem).toLocaleString(
          "id-ID",
        );
        hargaValues[item.tempId] = Number(item.hargaJual).toLocaleString(
          "id-ID",
        );
      });
      setCartItems(newCartItems);
      setItemDiskonTypes(diskonTypes);
      setItemDiskonValues(diskonValues);
      setItemHargaValues(hargaValues);
      setOriginalQtyByBarangId(originalQtyMap);
      if (penjualan.customer) {
        setSelectedCustomer(penjualan.customer);
        setManualCustomerName("");
        setUseManualCustomer(false);
        fetchCustomerHutangInfo(penjualan.customer.id);
      } else {
        setSelectedCustomer(null);
        setManualCustomerName(penjualan.namaCustomer || "");
        setUseManualCustomer(true);
      }
      setDiskonNotaType("rupiah");
      const penjualanMetode = resolveMetodePembayaran(penjualan);
      const penjualanDibayar = Number(penjualan.jumlahDibayar).toLocaleString(
        "id-ID",
      );
      setDiskonNota(Number(penjualan.diskonNota).toLocaleString("id-ID"));
      setJumlahDibayar(penjualanDibayar);
      setMetodePembayaran(penjualanMetode);
      if (penjualanMetode === "CASH_TRANSFER") {
        setJumlahCash(penjualanDibayar);
        setJumlahTransfer("");
      } else {
        setJumlahCash("");
        setJumlahTransfer("");
      }
      const transaksiDate = penjualan.tanggalTransaksi
        ? new Date(penjualan.tanggalTransaksi).toISOString().split("T")[0]
        : "";
      setTanggalTransaksi(transaksiDate);
      const jatuhTempoDate = penjualan.tanggalJatuhTempo
        ? new Date(penjualan.tanggalJatuhTempo).toISOString().split("T")[0]
        : "";
      setTanggalJatuhTempo(jatuhTempoDate);
    } catch (error) {
      console.error("Error loading penjualan:", error);
      toast.error("Gagal memuat data penjualan");
    } finally {
      setLoadingEdit(false);
    }
  };

  const fetchBarang = async () => {
    try {
      const res = await fetch("/api/barang");
      const data = await res.json();
      if (data.success) setBarangList(data.data);
    } catch (error) {
      toast.error("Gagal mengambil data barang");
    }
  };

  const fetchTodaySales = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/penjualan/daily-summary?date=${today}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const summary: { [barangId: number]: number } = {};
        data.data.forEach((item: any) => {
          summary[item.barangId] = Number(item.totalTerjual) || 0;
        });
        setTodaySales(summary);
      }
    } catch (error) {
      console.error("Error fetching penjualan harian:", error);
    }
  };

  const searchCustomerByKeyword = async (keyword: string) => {
    setSearchingCustomer(true);
    try {
      const res = await fetch(
        `/api/customer/search/${encodeURIComponent(keyword)}?limit=5`,
      );
      const data = await res.json();
      if (data.success) setCustomerList(data.data);
    } catch (error) {
      console.error("Error searching customer:", error);
    } finally {
      setSearchingCustomer(false);
    }
  };

  const fetchCustomerHutangInfo = async (customerId: number) => {
    setLoadingHutangInfo(true);
    try {
      const res = await fetch(`/api/customer/${customerId}/hutang-info`);
      const data = await res.json();
      setCustomerHutangInfo(data.success ? data.data : null);
    } catch (error) {
      setCustomerHutangInfo(null);
    } finally {
      setLoadingHutangInfo(false);
    }
  };

  const getTodaySold = (barangId: number): number => todaySales[barangId] || 0;

  const getCartPcsForBarang = (barangId: number): number => {
    const cartItem = cartItems.find((item) => item.barangId === barangId);
    if (!cartItem) return 0;
    return getTotalItemPcs(cartItem);
  };

  const handleQuickAddItem = (barang: Barang) => {
    const jumlahPerKemasan = Number(barang.jumlahPerKemasan);
    const existingItem = cartItems.find((item) => item.barangId === barang.id);
    const inCartPcs = getCartPcsForBarang(barang.id);
    const originalQty = editPenjualanId
      ? originalQtyByBarangId[barang.id] || 0
      : 0;
    const stokTersedia = barang.stok + originalQty;
    const sisaStok = stokTersedia - inCartPcs;
    const addPcs = jumlahPerKemasan > 1 ? jumlahPerKemasan : 1;
    if (sisaStok < addPcs) {
      toast.error(`Stok tidak mencukupi! Sisa: ${sisaStok} pcs`);
      return;
    }
    const limitPenjualan = Number(barang.limitPenjualan || 0);
    const todaySold = getTodaySold(barang.id);
    const effectiveSold = Math.max(0, todaySold - originalQty);
    if (limitPenjualan > 0) {
      const remainingLimit = limitPenjualan - effectiveSold - inCartPcs;
      if (remainingLimit <= 0) {
        toast.error(`Limit harian untuk ${barang.namaBarang} sudah tercapai`);
        return;
      }
      if (addPcs > remainingLimit) {
        toast.error(`Limit penjualan harian telah tercapai!`);
        return;
      }
    }
    if (existingItem) {
      setCartItems((prevItems) =>
        prevItems.map((item) =>
          item.tempId === existingItem.tempId
            ? jumlahPerKemasan > 1
              ? { ...item, jumlahDus: item.jumlahDus + 1 }
              : { ...item, jumlahPcs: item.jumlahPcs + 1 }
            : item,
        ),
      );
      toast.success(
        `${barang.namaBarang} +1 ${jumlahPerKemasan > 1 ? "dus" : "pcs"}`,
      );
      return;
    }
    const newItem: CartItem = {
      tempId: `temp-${Date.now()}-${Math.random()}`,
      barangId: barang.id,
      jumlahDus: jumlahPerKemasan > 1 ? 1 : 0,
      jumlahPcs: jumlahPerKemasan > 1 ? 0 : 1,
      hargaJual: barang.hargaJual,
      diskonPerItem: 0,
      barang: barang,
    };
    setCartItems((prev) => [...prev, newItem]);
    setItemDiskonTypes((prev) => ({ ...prev, [newItem.tempId]: "rupiah" }));
    setItemDiskonValues((prev) => ({ ...prev, [newItem.tempId]: "0" }));
    setItemHargaValues((prev) => ({
      ...prev,
      [newItem.tempId]: formatRupiahInput(String(newItem.hargaJual)),
    }));
    toast.success(`${barang.namaBarang} ditambahkan ke item dijual`);
  };

  const handleUpdateItem = (tempId: string, field: string, value: number) => {
    let warningMessage: string | null = null;
    setCartItems((prevItems) => {
      const nextItems = prevItems.map((item) => {
        if (item.tempId !== tempId) return item;
        const updatedItem = { ...item, [field]: Math.max(0, value) };
        const limitPenjualan = Number(item.barang.limitPenjualan || 0);
        const jumlahPerKemasan = Number(item.barang.jumlahPerKemasan);
        const totalPcs =
          updatedItem.jumlahDus * jumlahPerKemasan + updatedItem.jumlahPcs;
        const originalQty = editPenjualanId
          ? originalQtyByBarangId[item.barangId] || 0
          : 0;
        const stokTersedia = Math.max(
          0,
          Number(item.barang.stok || 0) + originalQty,
        );
        const todaySold = getTodaySold(item.barangId);
        const allowedByLimit =
          limitPenjualan > 0
            ? Math.max(0, limitPenjualan - Math.max(0, todaySold - originalQty))
            : Number.POSITIVE_INFINITY;
        const maxAllowed = Math.min(stokTersedia, allowedByLimit);
        if (totalPcs > maxAllowed) {
          let clampedDus = updatedItem.jumlahDus;
          let clampedPcs = updatedItem.jumlahPcs;
          if (field === "jumlahDus") {
            const maxDus = Math.max(
              0,
              Math.floor((maxAllowed - clampedPcs) / jumlahPerKemasan),
            );
            clampedDus = Math.min(clampedDus, maxDus);
          } else if (field === "jumlahPcs") {
            const maxPcs = Math.max(
              0,
              maxAllowed - clampedDus * jumlahPerKemasan,
            );
            clampedPcs = Math.min(clampedPcs, maxPcs);
          } else {
            clampedDus = Math.floor(maxAllowed / jumlahPerKemasan);
            clampedPcs = Math.floor(maxAllowed % jumlahPerKemasan);
          }
          const reasons = [];
          if (limitPenjualan > 0 && allowedByLimit <= stokTersedia)
            reasons.push(`Sisa limit harian: ${allowedByLimit} pcs`);
          if (stokTersedia <= allowedByLimit)
            reasons.push(`Sisa stok: ${stokTersedia} pcs`);
          warningMessage =
            reasons.length > 0
              ? `Jumlah melebihi batas. ${reasons.join(" | ")}`
              : "Jumlah melebihi batas.";
          return {
            ...updatedItem,
            jumlahDus: clampedDus,
            jumlahPcs: clampedPcs,
          };
        }
        return updatedItem;
      });
      return nextItems;
    });
    if (warningMessage) toast.error(warningMessage);
  };

  const handleItemDiskonChange = (
    item: CartItem,
    value: string,
    type: "rupiah" | "persen",
  ) => {
    let diskonRupiah: number;
    let displayValue: string;
    if (type === "persen") {
      const cleanValue = value.replace(/[^\d]/g, "");
      const persen = parseInt(cleanValue) || 0;
      const clampedPersen = Math.min(100, Math.max(0, persen));
      diskonRupiah = Math.round((item.hargaJual * clampedPersen) / 100);
      displayValue = cleanValue === "" ? "" : clampedPersen.toString();
    } else {
      diskonRupiah = parseRupiahToNumber(value);
      displayValue = formatRupiahInput(value);
    }
    setItemDiskonValues((prev) => ({ ...prev, [item.tempId]: displayValue }));
    setCartItems((prevItems) =>
      prevItems.map((cartItem) =>
        cartItem.tempId === item.tempId
          ? { ...cartItem, diskonPerItem: diskonRupiah }
          : cartItem,
      ),
    );
  };

  const toggleItemDiskonType = (item: CartItem) => {
    const currentType = itemDiskonTypes[item.tempId] || "rupiah";
    const newType = currentType === "rupiah" ? "persen" : "rupiah";
    setItemDiskonTypes((prev) => ({ ...prev, [item.tempId]: newType }));
    if (newType === "persen") {
      const persen =
        item.hargaJual > 0
          ? Math.round((item.diskonPerItem / item.hargaJual) * 100)
          : 0;
      setItemDiskonValues((prev) => ({
        ...prev,
        [item.tempId]: persen.toString(),
      }));
    } else {
      setItemDiskonValues((prev) => ({
        ...prev,
        [item.tempId]: item.diskonPerItem.toLocaleString("id-ID"),
      }));
    }
  };

  const getItemDiskonDisplayValue = (item: CartItem): string => {
    const type = itemDiskonTypes[item.tempId] || "rupiah";
    const storedValue = itemDiskonValues[item.tempId];
    if (storedValue !== undefined && storedValue !== "") return storedValue;
    if (type === "persen") {
      const persen =
        item.hargaJual > 0
          ? Math.round((item.diskonPerItem / item.hargaJual) * 100)
          : 0;
      return persen.toString();
    } else {
      return item.diskonPerItem === 0
        ? "0"
        : item.diskonPerItem.toLocaleString("id-ID");
    }
  };

  const handleItemHargaChange = (item: CartItem, value: string) => {
    const displayValue = value === "" ? "" : formatRupiahInput(value);
    const hargaJual = parseRupiahToNumber(value);
    setItemHargaValues((prev) => ({ ...prev, [item.tempId]: displayValue }));
    setCartItems((prevItems) =>
      prevItems.map((cartItem) =>
        cartItem.tempId === item.tempId ? { ...cartItem, hargaJual } : cartItem,
      ),
    );
  };

  const getItemHargaDisplayValue = (item: CartItem): string => {
    const storedValue = itemHargaValues[item.tempId];
    if (storedValue !== undefined) return storedValue;
    return item.hargaJual.toLocaleString("id-ID");
  };

  const getItemBeratGrams = (item: CartItem): number => {
    const totalPcs = getTotalItemPcs(item);
    return calculateBeratGramsFromBarang(item.barang, totalPcs);
  };

  const handleDeleteItem = (tempId: string) => {
    setCartItems((prevItems) =>
      prevItems.filter((item) => item.tempId !== tempId),
    );
    setItemDiskonTypes((prev) => {
      const n = { ...prev };
      delete n[tempId];
      return n;
    });
    setItemDiskonValues((prev) => {
      const n = { ...prev };
      delete n[tempId];
      return n;
    });
    setItemHargaValues((prev) => {
      const n = { ...prev };
      delete n[tempId];
      return n;
    });
    toast.success("Item berhasil dihapus");
  };

  const calculateCartSummary = () => {
    let subtotal = 0;
    let totalDiskonItem = 0;
    cartItems.forEach((item) => {
      const hargaTotal = item.hargaJual * item.jumlahDus;
      const hargaPcs =
        item.jumlahPcs > 0
          ? Math.round(
              (item.hargaJual / item.barang.jumlahPerKemasan) * item.jumlahPcs,
            )
          : 0;
      const totalHargaSebelumDiskon = hargaTotal + hargaPcs;
      const diskon = item.diskonPerItem * item.jumlahDus;
      subtotal += totalHargaSebelumDiskon;
      totalDiskonItem += diskon;
    });
    return { subtotal, totalDiskonItem };
  };

  const calculateDiskonNotaRupiah = (): number => {
    const { subtotal, totalDiskonItem } = calculateCartSummary();
    const subtotalAfterItemDiskon = subtotal - totalDiskonItem;
    if (diskonNotaType === "persen") {
      const persen = parseInt(diskonNota) || 0;
      return Math.round((subtotalAfterItemDiskon * persen) / 100);
    } else {
      return parseRupiahToNumber(diskonNota);
    }
  };

  const handleDiskonNotaChange = (value: string) => {
    if (diskonNotaType === "persen") {
      const persen = parseInt(value) || 0;
      setDiskonNota(Math.min(100, Math.max(0, persen)).toString());
    } else {
      setDiskonNota(formatRupiahInput(value));
    }
  };

  const toggleDiskonNotaType = () => {
    const newType = diskonNotaType === "rupiah" ? "persen" : "rupiah";
    setDiskonNotaType(newType);
    const { subtotal, totalDiskonItem } = calculateCartSummary();
    const subtotalAfterItemDiskon = subtotal - totalDiskonItem;
    if (newType === "persen") {
      const currentRupiah = parseRupiahToNumber(diskonNota);
      const persen =
        subtotalAfterItemDiskon > 0
          ? Math.round((currentRupiah / subtotalAfterItemDiskon) * 100)
          : 0;
      setDiskonNota(persen.toString());
    } else {
      const currentPersen = parseInt(diskonNota) || 0;
      const rupiah = Math.round(
        (subtotalAfterItemDiskon * currentPersen) / 100,
      );
      setDiskonNota(rupiah.toLocaleString("id-ID"));
    }
  };

  const getSisaLimitPiutang = (customer: Customer): number =>
    Math.max(0, customer.limit_piutang - customer.piutang);

  const getEffectiveJumlahDibayar = (): number => {
    if (metodePembayaran === "CASH_TRANSFER")
      return (
        parseRupiahToNumber(jumlahCash) + parseRupiahToNumber(jumlahTransfer)
      );
    return parseRupiahToNumber(jumlahDibayar);
  };

  const getPembayaranBreakdown = (): { cash: number; transfer: number } => {
    if (metodePembayaran === "CASH_TRANSFER")
      return {
        cash: parseRupiahToNumber(jumlahCash),
        transfer: parseRupiahToNumber(jumlahTransfer),
      };
    if (metodePembayaran === "TRANSFER")
      return { cash: 0, transfer: parseRupiahToNumber(jumlahDibayar) };
    return { cash: parseRupiahToNumber(jumlahDibayar), transfer: 0 };
  };

  const handleMetodePembayaranChange = (
    metode: "CASH" | "TRANSFER" | "CASH_TRANSFER",
  ) => {
    if (metode === "CASH_TRANSFER") {
      if (jumlahDibayar) setJumlahCash(jumlahDibayar);
      if (!jumlahTransfer) setJumlahTransfer("");
    } else if (metodePembayaran === "CASH_TRANSFER") {
      const total =
        parseRupiahToNumber(jumlahCash) + parseRupiahToNumber(jumlahTransfer);
      setJumlahDibayar(total ? total.toLocaleString("id-ID") : "");
      setJumlahCash("");
      setJumlahTransfer("");
    }
    setMetodePembayaran(metode);
  };

  const setJumlahByNumber = (
    setter: (value: string) => void,
    value: number,
  ) => {
    setter(value ? value.toLocaleString("id-ID") : "");
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      toast.error("Item dijual masih kosong");
      return;
    }
    if (!selectedCustomer && !manualCustomerName) {
      toast.error("Customer atau nama customer wajib diisi");
      return;
    }
    const diskonNotaRupiah = calculateDiskonNotaRupiah();
    const jumlahDibayarFinal = getEffectiveJumlahDibayar();
    const { cash, transfer } = getPembayaranBreakdown();
    setLoading(true);
    try {
      const orderData: any = {
        items: cartItems.map((item) => ({
          id: item.itemId,
          barangId: item.barangId,
          jumlahDus: item.jumlahDus,
          jumlahPcs: item.jumlahPcs,
          totalItem: getTotalItemPcs(item),
          hargaJual: item.hargaJual,
          diskonPerItem: item.diskonPerItem,
          berat: getItemBeratGrams(item),
        })),
        diskonNota: diskonNotaRupiah,
        metodePembayaran,
        jumlahDibayar: jumlahDibayarFinal,
        totalCash: cash,
        totalTransfer: transfer,
      };
      if (selectedCustomer) orderData.customerId = selectedCustomer.id;
      else if (manualCustomerName) orderData.namaCustomer = manualCustomerName;
      if (tanggalTransaksi) orderData.tanggalTransaksi = tanggalTransaksi;
      if (tanggalJatuhTempo) orderData.tanggalJatuhTempo = tanggalJatuhTempo;
      const checkoutRes = await fetch(
        editPenjualanId
          ? `/api/sales/order/${editPenjualanId}`
          : "/api/sales/order",
        {
          method: editPenjualanId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderData),
        },
      );
      const checkoutResult = await checkoutRes.json();
      if (checkoutResult.success) {
        if (editPenjualanId) {
          toast.success("Order berhasil diupdate");
          setShowCheckoutModal(false);
          setCartItems([]);
          setSelectedCustomer(null);
          setManualCustomerName("");
          setUseManualCustomer(false);
          setDiskonNota("0");
          setDiskonNotaType("rupiah");
          setJumlahDibayar("");
          setJumlahCash("");
          setJumlahTransfer("");
          setMetodePembayaran("CASH");
          setTanggalJatuhTempo("");
          setItemDiskonTypes({});
          setItemDiskonValues({});
          setItemHargaValues({});
          setSearchCustomer("");
          setExpandCustomerSearch(false);
          setEditPenjualanId(null);
          router.replace("/dashboard/sales/riwayat/order");
        } else {
          setReceiptData(checkoutResult.data);
          setShowCheckoutModal(false);
          setShowReceiptModal(true);
          toast.success(checkoutResult.message || "Order berhasil dibuat");
        }
        fetchBarang();
        fetchTodaySales();
      } else {
        toast.error(
          checkoutResult.error ||
            (editPenjualanId ? "Gagal mengupdate order" : "Gagal membuat order"),
        );
      }
    } catch (error) {
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCheckoutModal = async () => {
    if (cartItems.length === 0) {
      toast.error("Item dijual masih kosong");
      return;
    }
    if (hasZeroQtyItem) {
      toast.error("Ada item dengan jumlah 0. Periksa kembali.");
      return;
    }
    if (!selectedCustomer && !manualCustomerName) {
      toast.error("Customer atau nama customer wajib diisi");
      return;
    }
    setShowCheckoutModal(true);
  };

  const handleReset = () => {
    setCartItems([]);
    setSelectedCustomer(null);
    setManualCustomerName("");
    setUseManualCustomer(false);
    setDiskonNota("0");
    setDiskonNotaType("rupiah");
    setJumlahDibayar("");
    setJumlahCash("");
    setJumlahTransfer("");
    setMetodePembayaran("CASH");
    setTanggalJatuhTempo("");
    setItemDiskonTypes({});
    setItemDiskonValues({});
    setItemHargaValues({});
    setSearchCustomer("");
    if (editPenjualanId) {
      setEditPenjualanId(null);
      router.replace("/dashboard/sales/order");
    }
    setExpandCustomerSearch(false);
    const today = new Date().toISOString().split("T")[0];
    setTanggalTransaksi(today);
    toast.success("Transaksi direset");
  };

  const formatRupiah = (number: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const filteredBarang = barangList.filter((b) =>
    b.namaBarang.toLowerCase().includes(searchBarang.toLowerCase()),
  );
  const cartSummary = calculateCartSummary();
  const calculatedTotal =
    cartSummary.subtotal -
    cartSummary.totalDiskonItem -
    calculateDiskonNotaRupiah();
  const hasZeroQtyItem = cartItems.some(
    (item) => item.jumlahDus === 0 && item.jumlahPcs === 0,
  );

  const getPaymentStatus = () => {
    const bayar = getEffectiveJumlahDibayar();
    const total = Math.max(0, calculatedTotal);
    if (bayar >= total)
      return {
        status: "LUNAS",
        kembalian: bayar - total,
        sisaHutang: 0,
        canCheckout: true,
        message: null,
      };
    const sisaHutang = total - bayar;
    if (useManualCustomer || !selectedCustomer)
      return {
        status: "HUTANG",
        kembalian: 0,
        sisaHutang,
        canCheckout: false,
        message: "Customer tidak terdaftar tidak bisa mengambil hutang",
      };
    const sisaLimit = getSisaLimitPiutang(selectedCustomer);
    if (selectedCustomer.limit_piutang > 0 && sisaHutang > sisaLimit) {
      return {
        status: "HUTANG",
        kembalian: 0,
        sisaHutang,
        canCheckout: true,
        message: `Piutang melebihi limit! Sisa limit: ${formatRupiah(sisaLimit)}`,
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

  const hasPaymentInput =
    metodePembayaran === "CASH_TRANSFER"
      ? jumlahCash.trim() !== "" || jumlahTransfer.trim() !== ""
      : jumlahDibayar.trim() !== "";
  const paymentStatus = hasPaymentInput ? getPaymentStatus() : null;

  // ============ RENDER HELPERS ============

  const CustomerSection = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
      <label className="text-xs font-extrabold text-gray-800 mb-2 uppercase tracking-wider flex items-center gap-2">
        <div className="bg-blue-100 p-1.5 rounded-lg">
          <Users className="w-4 h-4 text-blue-600" />
        </div>
        <span>
          Customer <span className="text-red-500">*</span>
        </span>
      </label>

      {selectedCustomer ? (
        <div className="space-y-2">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-lg text-white">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">
                  {selectedCustomer.nama}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-blue-100 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {selectedCustomer.namaToko}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {selectedCustomer.noHp}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerHutangInfo(null);
                  setSearchCustomer("");
                  setExpandCustomerSearch(false);
                  setUseManualCustomer(false);
                }}
                className="text-white hover:bg-white/20 p-1.5 rounded transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {loadingHutangInfo ? (
            <div className="text-center py-2">
              <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : customerHutangInfo ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Transaksi Hutang:</span>
                <span className="font-bold text-red-600">
                  {customerHutangInfo.jumlahTransaksiHutang} transaksi
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Hutang:</span>
                <span className="font-bold text-orange-600">
                  {formatRupiah(customerHutangInfo.piutang)}
                </span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-gray-200">
                <span className="text-gray-600">Sisa Limit:</span>
                <span
                  className={`font-bold ${customerHutangInfo.sisaLimitHutang > 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {formatRupiah(customerHutangInfo.sisaLimitHutang)}
                </span>
              </div>
              {customerHutangInfo.limit_piutang > 0 &&
                customerHutangInfo.sisaLimitHutang <= 0 && (
                  <div className="flex items-center gap-1.5 text-red-600 bg-red-50 p-1.5 rounded">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Limit hutang sudah penuh!</span>
                  </div>
                )}
            </div>
          ) : null}
        </div>
      ) : useManualCustomer ? (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Masukkan nama customer..."
            value={manualCustomerName}
            onChange={(e) => setManualCustomerName(e.target.value)}
            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
          />
          <p className="text-xs text-yellow-600 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Customer tidak terdaftar tidak bisa hutang
          </p>
          <button
            onClick={() => {
              setUseManualCustomer(false);
              setManualCustomerName("");
            }}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl text-sm font-bold transition-all"
          >
            Kembali ke Daftar Customer
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {!expandCustomerSearch && (
            <button
              onClick={() => setExpandCustomerSearch(true)}
              className="w-full text-center py-2.5 px-4 bg-gray-50 hover:bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 transition-all"
            >
              <p className="text-sm text-gray-600 font-semibold flex items-center justify-center gap-2">
                <Search className="w-4 h-4" />
                Cari customer untuk memulai
              </p>
            </button>
          )}
          {expandCustomerSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
              <input
                type="text"
                placeholder="Ketik nama atau nama toko..."
                value={searchCustomer}
                onChange={(e) => {
                  setSearchCustomer(e.target.value);
                  setShowCustomerDropdown(true);
                }}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-medium"
                autoFocus
              />
              {showCustomerDropdown && searchCustomer.length >= 2 && (
                <div className="absolute z-50 mt-1 w-full bg-white border-2 border-blue-300 rounded-xl shadow-2xl">
                  {searchingCustomer ? (
                    <div className="p-4 text-center">
                      <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Mencari...</p>
                    </div>
                  ) : customerList.length > 0 ? (
                    customerList.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          fetchCustomerHutangInfo(c.id);
                          setShowCustomerDropdown(false);
                          setSearchCustomer("");
                          setExpandCustomerSearch(false);
                        }}
                        className="w-full p-3 hover:bg-blue-50 border-b last:border-b-0 transition-all text-left"
                      >
                        <p className="font-bold text-sm text-gray-900 flex items-center gap-2">
                          <User className="w-3.5 h-3.5" />
                          {c.nama}
                        </p>
                        <p className="text-xs text-gray-500 ml-5">
                          {c.namaToko} • {c.noHp}
                        </p>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      Tidak ada hasil
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setExpandCustomerSearch(!expandCustomerSearch)}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 border border-blue-200"
            >
              <Search className="w-4 h-4" />
              {expandCustomerSearch ? "Tutup" : "Cari Customer"}
            </button>
            <button
              onClick={() => {
                setUseManualCustomer(true);
                setExpandCustomerSearch(false);
              }}
              className="bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 border border-gray-200"
            >
              <UserPlus className="w-4 h-4" />
              Input Manual
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const CartItemCard = ({ item }: { item: CartItem }) => (
    <div className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-extrabold text-gray-900 text-sm truncate">
            {item.barang.namaBarang}
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Default: {formatRupiah(item.barang.hargaJual)}/
            {item.barang.jenisKemasan}
          </p>
        </div>
        <button
          onClick={() => handleDeleteItem(item.tempId)}
          className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all ml-2"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Harga */}
      <div className="flex items-center justify-between bg-blue-50 p-2 rounded-lg border border-blue-200 mb-2">
        <span className="text-xs font-bold text-gray-700">Harga:</span>
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-blue-700">Rp</span>
          <input
            type="text"
            value={getItemHargaDisplayValue(item)}
            onChange={(e) => handleItemHargaChange(item, e.target.value)}
            className="w-24 text-right text-xs border border-blue-300 rounded px-2 py-1 font-bold bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      {item.hargaJual < item.barang.hargaJual && (
        <p className="text-xs text-red-600 mb-2">⚠️ Harga di bawah default</p>
      )}

      {/* Qty Controls */}
      {item.barang.jumlahPerKemasan > 1 ? (
        <div className="space-y-1.5 mb-2">
          {/* Kemasan */}
          <div className="flex items-center justify-between bg-purple-50 px-2 py-1.5 rounded-lg">
            <span className="text-xs font-bold text-gray-700">
              {item.barang.jenisKemasan}:
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  handleUpdateItem(
                    item.tempId,
                    "jumlahDus",
                    Math.max(0, item.jumlahDus - 1),
                  )
                }
                className="w-6 h-6 rounded bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
              >
                <Minus className="w-3 h-3" strokeWidth={3} />
              </button>
              <input
                type="number"
                value={item.jumlahDus}
                onChange={(e) =>
                  handleUpdateItem(
                    item.tempId,
                    "jumlahDus",
                    Math.max(0, parseInt(e.target.value) || 0),
                  )
                }
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className="w-10 text-center text-sm border border-gray-300 rounded px-1 py-0.5 font-bold"
                min="0"
              />
              <button
                onClick={() =>
                  handleUpdateItem(item.tempId, "jumlahDus", item.jumlahDus + 1)
                }
                className="w-6 h-6 rounded bg-green-500 hover:bg-green-600 text-white flex items-center justify-center"
              >
                <Plus className="w-3 h-3" strokeWidth={3} />
              </button>
            </div>
          </div>
          {/* Pcs */}
          <div className="flex items-center justify-between bg-orange-50 px-2 py-1.5 rounded-lg">
            <span className="text-xs font-bold text-gray-700">Pcs:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  handleUpdateItem(
                    item.tempId,
                    "jumlahPcs",
                    Math.max(0, item.jumlahPcs - 1),
                  )
                }
                className="w-6 h-6 rounded bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
              >
                <Minus className="w-3 h-3" strokeWidth={3} />
              </button>
              <input
                type="number"
                value={item.jumlahPcs}
                onChange={(e) =>
                  handleUpdateItem(
                    item.tempId,
                    "jumlahPcs",
                    Math.max(0, parseInt(e.target.value) || 0),
                  )
                }
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className="w-10 text-center text-sm border border-gray-300 rounded px-1 py-0.5 font-bold"
                min="0"
                max={item.barang.jumlahPerKemasan - 1}
              />
              <button
                onClick={() =>
                  handleUpdateItem(item.tempId, "jumlahPcs", item.jumlahPcs + 1)
                }
                className="w-6 h-6 rounded bg-green-500 hover:bg-green-600 text-white flex items-center justify-center"
              >
                <Plus className="w-3 h-3" strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-orange-50 px-2 py-1.5 rounded-lg mb-2">
          <span className="text-xs font-bold text-gray-700">Item:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() =>
                handleUpdateItem(
                  item.tempId,
                  "jumlahPcs",
                  Math.max(0, item.jumlahPcs - 1),
                )
              }
              className="w-6 h-6 rounded bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
            >
              <Minus className="w-3 h-3" strokeWidth={3} />
            </button>
            <input
              type="number"
              value={item.jumlahPcs}
              onChange={(e) =>
                handleUpdateItem(
                  item.tempId,
                  "jumlahPcs",
                  Math.max(0, parseInt(e.target.value) || 0),
                )
              }
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              className="w-10 text-center text-sm border border-gray-300 rounded px-1 py-0.5 font-bold"
              min="0"
            />
            <button
              onClick={() =>
                handleUpdateItem(item.tempId, "jumlahPcs", item.jumlahPcs + 1)
              }
              className="w-6 h-6 rounded bg-green-500 hover:bg-green-600 text-white flex items-center justify-center"
            >
              <Plus className="w-3 h-3" strokeWidth={3} />
            </button>
          </div>
        </div>
      )}

      {/* Diskon */}
      <div className="flex items-center justify-between bg-yellow-50 px-2 py-1.5 rounded-lg border border-yellow-200 mb-2">
        <span className="text-xs font-bold text-gray-700">Diskon:</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleItemDiskonType(item)}
            className={`px-2 py-0.5 rounded text-xs font-extrabold ${(itemDiskonTypes[item.tempId] || "rupiah") === "rupiah" ? "bg-green-500 text-white" : "bg-purple-500 text-white"}`}
          >
            {(itemDiskonTypes[item.tempId] || "rupiah") === "rupiah"
              ? "Rp"
              : "%"}
          </button>
          <input
            type="text"
            value={getItemDiskonDisplayValue(item)}
            onChange={(e) =>
              handleItemDiskonChange(
                item,
                e.target.value,
                itemDiskonTypes[item.tempId] || "rupiah",
              )
            }
            className="w-20 text-right text-xs border border-yellow-300 rounded px-2 py-1 font-bold bg-white focus:ring-1 focus:ring-yellow-500"
            placeholder="0"
          />
        </div>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between pt-2 border-t-2 border-blue-200 bg-blue-50 -mx-3 -mb-3 px-3 py-2 rounded-b-lg">
        <span className="text-xs font-extrabold text-gray-800 uppercase">
          Total:
        </span>
        <p className="font-extrabold text-blue-600 text-sm">
          {formatRupiah(
            item.hargaJual * item.jumlahDus +
              Math.round(
                (item.hargaJual / item.barang.jumlahPerKemasan) *
                  item.jumlahPcs,
              ) -
              item.diskonPerItem * item.jumlahDus,
          )}
        </p>
      </div>
    </div>
  );

  const CartSummaryFooter = () => (
    <div className="border-t border-gray-200 bg-white p-3">
      <div className="space-y-1.5 text-sm mb-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal</span>
          <span className="font-bold">
            {formatRupiah(cartSummary.subtotal)}
          </span>
        </div>
        {cartSummary.totalDiskonItem > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Diskon Item</span>
            <span className="font-bold">
              -{formatRupiah(cartSummary.totalDiskonItem)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between border-t pt-1.5">
          <span className="text-gray-700 font-medium">Diskon Nota</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleDiskonNotaType}
              className={`px-2 py-0.5 rounded text-xs font-bold ${diskonNotaType === "rupiah" ? "bg-green-500 text-white" : "bg-purple-500 text-white"}`}
            >
              {diskonNotaType === "rupiah" ? "Rp" : "%"}
            </button>
            <input
              type="text"
              value={diskonNota}
              onChange={(e) => handleDiskonNotaChange(e.target.value)}
              className="w-16 text-right border border-gray-300 rounded px-2 py-0.5 text-xs focus:ring-1 focus:ring-blue-500"
              placeholder="0"
            />
          </div>
        </div>
        <div className="flex justify-between font-bold text-base border-t-2 pt-1.5">
          <span>TOTAL</span>
          <span className="text-blue-600">
            {formatRupiah(Math.max(0, calculatedTotal))}
          </span>
        </div>
      </div>
      <button
        onClick={handleOpenCheckoutModal}
        disabled={
          loading ||
          cartItems.length === 0 ||
          hasZeroQtyItem ||
          (!selectedCustomer && !manualCustomerName)
        }
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-md"
      >
        <Receipt className="w-5 h-5" />
        {loading
          ? "Memproses..."
          : editPenjualanId
            ? "Update Order"
            : "Kirim Order"}
      </button>
      {cartItems.length > 0 && !selectedCustomer && !manualCustomerName && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            Pilih customer untuk melanjutkan
          </p>
        </div>
      )}
      {hasZeroQtyItem && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">
            Tambahkan jumlah item sebelum melanjutkan.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 min-h-screen flex flex-col">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#363636",
            color: "#fff",
            borderRadius: "12px",
            padding: "12px 16px",
          },
          success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
          error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
        }}
      />

      {/* ===== HEADER ===== */}
      <div className="mx-2 sm:mx-3 mt-2 sm:mt-3 mb-3">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl p-4 sm:p-5 shadow-xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -mr-24 -mt-24 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -ml-16 -mb-16 pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-lg shadow-lg shrink-0">
                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
                  Penjualan Barang
                </h1>
                <p className="text-blue-100 text-xs sm:text-sm">
                  {isAdmin ? "Mode Admin" : "Kelola transaksi penjualan"}
                </p>
                {editPenjualanId && (
                  <span className="inline-flex items-center gap-1.5 bg-yellow-400/90 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full mt-1">
                    Mode Edit #{editPenjualanId}
                    {loadingEdit && (
                      <span className="inline-block h-2 w-2 rounded-full bg-slate-900 animate-pulse" />
                    )}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link
                href="/dashboard/admin/penjualan/riwayat"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all font-semibold shadow-lg text-xs sm:text-sm"
              >
                <Receipt className="w-4 h-4" />
                <span className="hidden xs:inline">Riwayat</span>
              </Link>
              <button
                onClick={handleReset}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all font-semibold shadow-lg text-xs sm:text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden xs:inline">Reset</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== DESKTOP LAYOUT (lg+): Side-by-side ===== */}
      <div
        className="hidden lg:flex flex-1 gap-3 px-3 pb-3 min-h-0 overflow-hidden"
        style={{ maxHeight: "calc(100vh - 120px)" }}
      >
        {/* Left: 68% */}
        <div className="w-[68%] flex flex-col gap-3 min-h-0 overflow-hidden">
          <CustomerSection />

          {/* Products */}
          <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
            <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 shrink-0">
              <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <div className="bg-blue-600 p-1.5 rounded-lg shadow-md">
                  <Package className="w-5 h-5 text-white" />
                </div>
                Daftar Produk
                <span className="ml-auto text-xs bg-blue-600 text-white px-2.5 py-1 rounded-full font-bold">
                  {filteredBarang.length} produk
                </span>
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                <input
                  type="text"
                  placeholder="Cari produk..."
                  value={searchBarang}
                  onChange={(e) => setSearchBarang(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border-2 border-blue-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-medium"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50">
              <ProductGrid />
            </div>
          </div>
        </div>

        {/* Right: 32% */}
        <div className="w-[32%] bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
          <div className="p-4 bg-gray-50 border-b shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-bold text-gray-700">Item Dijual</h2>
            </div>
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-md font-bold">
              {cartItems.length} item
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 min-h-0 bg-gray-50">
            {cartItems.length > 0 ? (
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <CartItemCard key={item.tempId} item={item} />
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="bg-gray-100 p-4 rounded-full mb-3 mx-auto w-fit">
                    <ShoppingCart className="w-12 h-12 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">
                    Item dijual kosong
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Tambahkan produk untuk memulai
                  </p>
                </div>
              </div>
            )}
          </div>
          {cartItems.length > 0 && <CartSummaryFooter />}
        </div>
      </div>

      {/* ===== TABLET LAYOUT (md - lg): stacked with tabs ===== */}
      <div className="hidden md:flex lg:hidden flex-1 flex-col gap-3 px-3 pb-3 overflow-auto">
        <CustomerSection />
        {/* Tab switcher */}
        <div className="flex rounded-xl bg-gray-200 p-1 gap-1">
          <button
            onClick={() => setMobileTab("products")}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${mobileTab === "products" ? "bg-white shadow text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
          >
            <Package className="w-4 h-4" />
            Produk ({filteredBarang.length})
          </button>
          <button
            onClick={() => setMobileTab("cart")}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${mobileTab === "cart" ? "bg-white shadow text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
          >
            <ShoppingCart className="w-4 h-4" />
            Keranjang
            {cartItems.length > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {cartItems.length}
              </span>
            )}
          </button>
        </div>

        {mobileTab === "products" && (
          <div
            className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden flex flex-col"
            style={{ minHeight: "400px" }}
          >
            <div className="p-3 border-b bg-blue-50 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                <input
                  type="text"
                  placeholder="Cari produk..."
                  value={searchBarang}
                  onChange={(e) => setSearchBarang(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border-2 border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <ProductGrid />
            </div>
          </div>
        )}
        {mobileTab === "cart" && (
          <div className="bg-white rounded-xl shadow border border-gray-200 flex flex-col overflow-hidden">
            {cartItems.length > 0 ? (
              <>
                <div
                  className="overflow-y-auto p-3 space-y-2 flex-1"
                  style={{ maxHeight: "60vh" }}
                >
                  {cartItems.map((item) => (
                    <CartItemCard key={item.tempId} item={item} />
                  ))}
                </div>
                <CartSummaryFooter />
              </>
            ) : (
              <div className="py-12 text-center">
                <div className="bg-gray-100 p-4 rounded-full mb-3 mx-auto w-fit">
                  <ShoppingCart className="w-12 h-12 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">Keranjang kosong</p>
                <p className="text-gray-400 text-xs mt-1">
                  Tambahkan produk dari tab Produk
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== MOBILE LAYOUT (< md): full width products + floating cart button ===== */}
      <div className="flex md:hidden flex-1 flex-col gap-3 px-2 pb-24 overflow-auto">
        <CustomerSection />

        {/* Product search + grid */}
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-3 border-b bg-blue-50 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-blue-600" />
                Produk
              </h2>
              <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">
                {filteredBarang.length}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
              <input
                type="text"
                placeholder="Cari produk..."
                value={searchBarang}
                onChange={(e) => setSearchBarang(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border-2 border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              />
            </div>
          </div>
          <div className="p-3">
            <ProductGrid mobileColumns />
          </div>
        </div>
      </div>

      {/* ===== MOBILE: Floating Cart Button & Slide-up Panel ===== */}
      <div className="md:hidden">
        {/* Floating cart button (always visible) */}
        <button
          onClick={() => setShowMobileCartPanel(true)}
          className="fixed bottom-4 right-4 z-40 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 font-bold text-sm active:scale-95 transition-transform"
        >
          <ShoppingCart className="w-5 h-5" />
          {cartItems.length > 0 ? (
            <>
              <span>{cartItems.length} item</span>
              <span className="text-blue-200">·</span>
              <span>{formatRupiah(Math.max(0, calculatedTotal))}</span>
            </>
          ) : (
            <span>Keranjang</span>
          )}
          {cartItems.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {cartItems.length}
            </span>
          )}
        </button>

        {/* Slide-up cart panel */}
        {showMobileCartPanel && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowMobileCartPanel(false)}
            />
            {/* Panel */}
            <div
              className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col"
              style={{ maxHeight: "85vh" }}
            >
              {/* Handle */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                  <h2 className="font-bold text-gray-900">Item Dijual</h2>
                  {cartItems.length > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">
                      {cartItems.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowMobileCartPanel(false)}
                  className="text-gray-500 hover:bg-gray-100 p-2 rounded-full transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-2">
                {cartItems.length > 0 ? (
                  cartItems.map((item) => (
                    <CartItemCard key={item.tempId} item={item} />
                  ))
                ) : (
                  <div className="py-12 text-center">
                    <div className="bg-gray-100 p-4 rounded-full mb-3 mx-auto w-fit">
                      <ShoppingCart className="w-10 h-10 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">
                      Keranjang kosong
                    </p>
                  </div>
                )}
              </div>

              {cartItems.length > 0 && <CartSummaryFooter />}
            </div>
          </div>
        )}
      </div>

      {/* ===== CHECKOUT MODAL ===== */}
      {showCheckoutModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setShowCheckoutModal(false)}
        >
          <div
            className="bg-white w-full sm:max-w-2xl sm:rounded-xl rounded-t-3xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-lg">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">
                  Konfirmasi Order
                </h2>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-white hover:bg-white/10 p-2 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {/* Customer info */}
              <div className="bg-slate-50 rounded-xl p-3 sm:p-4 mb-4 border border-slate-200">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
                  <User className="w-3.5 h-3.5" />
                  Customer
                </div>
                <p className="text-sm font-bold text-slate-900">
                  {selectedCustomer
                    ? selectedCustomer.nama
                    : manualCustomerName}
                </p>
              </div>

              {/* Ringkasan */}
              <div className="mb-4">
                <h3 className="font-bold text-slate-900 uppercase text-xs tracking-wider mb-2 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4" />
                  Ringkasan
                </h3>
                <div className="bg-slate-50 rounded-lg p-3 sm:p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="font-semibold">
                      {formatRupiah(cartSummary.subtotal)}
                    </span>
                  </div>
                  {cartSummary.totalDiskonItem > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Diskon Item</span>
                      <span className="font-semibold">
                        -{formatRupiah(cartSummary.totalDiskonItem)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600">Diskon Nota</span>
                    <span className="font-semibold">
                      -{formatRupiah(calculateDiskonNotaRupiah())}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-200">
                    <span>Total Order</span>
                    <span>{formatRupiah(Math.max(0, calculatedTotal))}</span>
                  </div>
                </div>
              </div>

              {/* Tanggal */}
              <div className="mb-4">
                <label className="font-bold text-slate-900 uppercase text-xs tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  Tanggal Penjualan
                </label>
                <input
                  type="date"
                  value={tanggalTransaksi}
                  onChange={(e) => setTanggalTransaksi(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 outline-none text-sm"
                />
              </div>

              {/* Metode Pembayaran */}
              <div className="mb-4">
                <label className="font-bold text-slate-900 uppercase text-xs tracking-wider mb-2 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4" />
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["CASH", "TRANSFER", "CASH_TRANSFER"] as const).map(
                    (metode) => (
                      <button
                        key={metode}
                        onClick={() => handleMetodePembayaranChange(metode)}
                        className={`py-2.5 px-2 rounded-lg font-semibold transition-all flex items-center justify-center gap-1 border-2 text-xs sm:text-sm ${metodePembayaran === metode ? "bg-slate-800 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"}`}
                      >
                        {metode === "CASH" ? (
                          <Banknote className="w-4 h-4" />
                        ) : (
                          <CreditCard className="w-4 h-4" />
                        )}
                        {metode === "CASH_TRANSFER" ? "Cash+TF" : metode}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Jumlah Dibayar */}
              <div className="mb-4">
                <label className="font-bold text-slate-900 uppercase text-xs tracking-wider mb-2 flex items-center gap-1.5">
                  <Banknote className="w-4 h-4" />
                  Jumlah Dibayar <span className="text-red-500">*</span>
                </label>
                {metodePembayaran === "CASH_TRANSFER" ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold text-sm">
                          Rp
                        </span>
                        <input
                          type="text"
                          value={jumlahCash}
                          onChange={(e) =>
                            setJumlahCash(formatRupiahInput(e.target.value))
                          }
                          className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 outline-none text-sm font-semibold"
                          placeholder="Jumlah Cash"
                        />
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold text-sm">
                          Rp
                        </span>
                        <input
                          type="text"
                          value={jumlahTransfer}
                          onChange={(e) =>
                            setJumlahTransfer(formatRupiahInput(e.target.value))
                          }
                          className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 outline-none text-sm font-semibold"
                          placeholder="Jumlah Transfer"
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Total: {formatRupiah(getEffectiveJumlahDibayar())}
                    </p>
                  </>
                ) : (
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">
                      Rp
                    </span>
                    <input
                      type="text"
                      value={jumlahDibayar}
                      onChange={(e) =>
                        setJumlahDibayar(formatRupiahInput(e.target.value))
                      }
                      className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 outline-none font-semibold"
                      placeholder="0"
                    />
                  </div>
                )}
                {metodePembayaran !== "CASH_TRANSFER" && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    <button
                      onClick={() =>
                        setJumlahByNumber(
                          setJumlahDibayar,
                          Math.max(0, calculatedTotal),
                        )
                      }
                      className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold hover:bg-slate-200"
                    >
                      Semua
                    </button>
                    <button
                      onClick={() =>
                        setJumlahByNumber(
                          setJumlahDibayar,
                          Math.round(Math.max(0, calculatedTotal) * 0.5),
                        )
                      }
                      className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold hover:bg-slate-200"
                    >
                      50%
                    </button>
                    <button
                      onClick={() =>
                        setJumlahByNumber(
                          setJumlahDibayar,
                          Math.round(Math.max(0, calculatedTotal) * 0.75),
                        )
                      }
                      className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold hover:bg-slate-200"
                    >
                      75%
                    </button>
                  </div>
                )}
              </div>

              {/* Payment status */}
              {paymentStatus && (
                <div
                  className={`rounded-lg p-3 mb-4 ${paymentStatus.status === "LUNAS" ? "bg-green-50 border border-green-200" : paymentStatus.canCheckout ? "bg-yellow-50 border border-yellow-200" : "bg-red-50 border border-red-200"}`}
                >
                  {paymentStatus.status === "LUNAS" ? (
                    <>
                      <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                        <Check className="w-4 h-4" />
                        Status: LUNAS
                      </div>
                      {paymentStatus.kembalian > 0 && (
                        <p className="text-green-600 mt-1 text-sm">
                          Kembalian: {formatRupiah(paymentStatus.kembalian)}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div
                        className={`flex items-center gap-2 font-medium text-sm ${paymentStatus.canCheckout ? "text-yellow-700" : "text-red-700"}`}
                      >
                        <AlertCircle className="w-4 h-4" />
                        Status: HUTANG
                      </div>
                      <p
                        className={`mt-1 text-sm ${paymentStatus.canCheckout ? "text-yellow-600" : "text-red-600"}`}
                      >
                        Sisa: {formatRupiah(paymentStatus.sisaHutang)}
                      </p>
                      {paymentStatus.message && (
                        <p className="text-red-600 mt-1 text-xs font-medium">
                          ⚠️ {paymentStatus.message}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Jatuh tempo */}
              {paymentStatus?.status === "HUTANG" &&
                paymentStatus.canCheckout && (
                  <div className="mb-4">
                    <label className="font-bold text-slate-900 uppercase text-xs tracking-wider mb-2 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      Tanggal Jatuh Tempo
                    </label>
                    <input
                      type="date"
                      value={tanggalJatuhTempo}
                      onChange={(e) => setTanggalJatuhTempo(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 outline-none text-sm"
                    />
                  </div>
                )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-lg transition-all font-semibold border border-slate-300"
                >
                  Batal
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={
                    loading ||
                    !hasPaymentInput ||
                    (!selectedCustomer && !manualCustomerName) ||
                    (paymentStatus !== null && !paymentStatus.canCheckout)
                  }
                  className="flex-1 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white px-4 py-3 rounded-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
                >
                  {loading ? (
                    "Memproses..."
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      {editPenjualanId ? "Update Order" : "Kirim Order"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== RECEIPT MODAL ===== */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div
            className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-5 sm:rounded-t-xl rounded-t-3xl text-center">
              <Check className="w-14 h-14 text-white mx-auto mb-2" />
              <h2 className="text-xl font-bold text-white">Order Berhasil!</h2>
            </div>
            <div className="p-5 sm:p-6">
              <div className="text-center mb-4">
                <p className="text-gray-500 text-sm">Kode Order</p>
                <p className="text-xl font-bold text-gray-900">
                  {receiptData.kodePenjualan}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(receiptData.tanggalTransaksi).toLocaleString(
                    "id-ID",
                  )}
                </p>
              </div>
              <div className="border-t border-b border-dashed border-gray-300 py-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer</span>
                  <span className="font-medium">
                    {receiptData.customer?.nama || receiptData.namaCustomer}
                  </span>
                </div>
                {receiptData.customer?.namaToko && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Toko</span>
                    <span>{receiptData.customer.namaToko}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Item</span>
                  <span>{receiptData.items?.length} barang</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatRupiah(receiptData.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Diskon</span>
                  <span>-{formatRupiah(receiptData.diskonNota)}</span>
                </div>
                <div className="flex justify-between font-bold text-base">
                  <span>Total Order</span>
                  <span>{formatRupiah(receiptData.totalHarga)}</span>
                </div>
              </div>
              <div className="mt-3 text-center">
                <span className="inline-block px-4 py-1.5 rounded-full font-medium bg-blue-100 text-blue-700 text-sm">
                  Menunggu Approval
                </span>
              </div>
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  handleReset();
                }}
                className="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Plus className="w-5 h-5" strokeWidth={3} />
                Order Baru
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Product Grid as inner component to avoid repeating
  function ProductGrid({ mobileColumns }: { mobileColumns?: boolean }) {
    return (
      <div
        className={`grid gap-2 sm:gap-3 ${mobileColumns ? "grid-cols-1 xs:grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}
      >
        {filteredBarang.map((barang) => {
          const isLowStock = barang.stok < barang.jumlahPerKemasan;
          const isOutOfStock = barang.stok <= 0;
          const isMediumStock =
            barang.stok >= barang.jumlahPerKemasan &&
            barang.stok < barang.jumlahPerKemasan * 5;
          const isInCart = cartItems.some(
            (item) => item.barangId === barang.id,
          );
          const limitHariIni = Number(barang.limitPenjualan || 0);
          const soldToday = getTodaySold(barang.id);
          const inCartPcs = getCartPcsForBarang(barang.id);
          const originalQty = editPenjualanId
            ? originalQtyByBarangId[barang.id] || 0
            : 0;
          const sisaLimit =
            limitHariIni > 0
              ? Math.max(0, limitHariIni - soldToday - inCartPcs)
              : null;
          const isLimitReached =
            limitHariIni > 0 && sisaLimit !== null && sisaLimit <= 0;
          const perDus = Number(barang.jumlahPerKemasan) || 1;
          const totalDipakai = soldToday + inCartPcs;
          const totalDusDipakai = Math.floor(totalDipakai / perDus);
          const sisa =
            limitHariIni > 0 ? Math.max(0, limitHariIni - totalDipakai) : 0;
          const sisaDus = Math.floor(sisa / perDus);
          const isNearLimit =
            limitHariIni > 0 && !isLimitReached && sisa <= perDus;
          const stokDus = Math.floor(
            Number(barang.stok) / Number(barang.jumlahPerKemasan),
          );
          const stokPcs = Number(barang.stok) % Number(barang.jumlahPerKemasan);

          return (
            <div
              key={barang.id}
              className={`group relative overflow-hidden rounded-xl border-2 transition-all duration-200 ${isLimitReached ? "border-red-300 bg-red-50" : isNearLimit ? "border-orange-300 bg-orange-50" : isLowStock ? "border-red-300 bg-red-50" : "border-gray-200 bg-white hover:border-blue-400 hover:shadow-lg"}`}
            >
              {isInCart && (
                <div className="absolute top-2 left-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 z-10">
                  <ShoppingCart className="w-2.5 h-2.5" />
                  Di Keranjang
                </div>
              )}
              {isLimitReached && (
                <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold z-10">
                  Limit
                </div>
              )}

              <div className="flex items-center justify-between p-3">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-start gap-1.5 mb-1">
                    <div className="bg-blue-100 p-1 rounded shrink-0 mt-0.5">
                      <Package className="w-3 h-3 text-blue-600" />
                    </div>
                    <h4 className="font-extrabold text-gray-900 text-xs leading-tight group-hover:text-blue-700 transition-colors">
                      {barang.namaBarang}
                    </h4>
                  </div>
                  <div className="ml-6 space-y-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="bg-gray-200 text-gray-700 text-[10px] px-1.5 py-0.5 rounded font-semibold">
                        {formatGramsToKg(barang.berat)} KG
                      </span>
                      <span className="bg-purple-100 text-purple-700 text-[10px] px-1.5 py-0.5 rounded font-semibold">
                        {barang.jumlahPerKemasan}/{barang.jenisKemasan}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-0.5 rounded shadow-sm">
                        <p className="text-[11px] font-extrabold">
                          {formatRupiah(barang.hargaJual)}
                          <span className="text-[9px] opacity-90 ml-0.5">
                            /{barang.jenisKemasan}
                          </span>
                        </p>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 ${isLowStock ? "bg-red-500 text-white" : isMediumStock ? "bg-yellow-400 text-yellow-900" : "bg-green-500 text-white"}`}
                      >
                        Stok: {stokDus}/{barang.jenisKemasan}
                        {stokPcs > 0 && ` ${stokPcs}/pcs`}
                      </span>
                    </div>
                    {limitHariIni > 0 && (
                      <div
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${isLimitReached ? "bg-red-50 border-red-200 text-red-600" : isNearLimit ? "bg-orange-50 border-orange-200 text-orange-600" : "bg-blue-50 border-blue-200 text-blue-600"}`}
                      >
                        Terjual: {totalDipakai}/
                        {barang.jenisKemasan === "Dus" ? totalDusDipakai : ""} ·
                        Sisa: {sisa} ({sisaDus} {barang.jenisKemasan})
                      </div>
                    )}
                    {(isLimitReached || isNearLimit || isLowStock) && (
                      <div
                        className={`flex items-center gap-1 text-xs font-bold ${isLimitReached || isLowStock ? "text-red-600" : "text-orange-600"}`}
                      >
                        <AlertCircle className="w-3 h-3" />
                        {isLimitReached
                          ? "Limit tercapai!"
                          : isNearLimit
                            ? "Mendekati limit!"
                            : isOutOfStock
                              ? "Stok Habis!"
                              : "Stok Menipis!"}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleQuickAddItem(barang)}
                  disabled={loading || isLowStock || isLimitReached}
                  className={`p-2 rounded-xl transition-all duration-200 shrink-0 ${isLowStock || isLimitReached ? "bg-gray-200 cursor-not-allowed opacity-50" : "bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg active:scale-95"}`}
                >
                  <Plus
                    className={`w-5 h-5 ${isLowStock || isLimitReached ? "text-gray-400" : "text-white"}`}
                    strokeWidth={3}
                  />
                </button>
              </div>
            </div>
          );
        })}
        {filteredBarang.length === 0 && (
          <div className="col-span-2 py-10 text-center">
            <div className="bg-gray-100 p-5 rounded-full mb-3 mx-auto w-fit">
              <Package className="w-12 h-12 text-gray-400" />
            </div>
            <p className="text-gray-600 font-bold">Produk Tidak Ditemukan</p>
            <p className="text-gray-400 text-sm">Coba kata kunci lain</p>
          </div>
        )}
      </div>
    );
  }
};

export default PenjualanPage;
