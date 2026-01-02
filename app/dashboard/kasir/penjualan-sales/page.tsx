"use client";
import React, { useState, useEffect } from "react";
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
  AlertTriangle,
  Banknote,
  Calendar,
  Percent,
  RefreshCw,
  Users,
  Building2,
  Phone,
  Star,
  Briefcase,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// ... (semua interface tetap sama)

interface Customer {
  id: number;
  nama: string;
  nik: string;
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

interface Karyawan {
  id: number;
  nama: string;
  nik: string;
  jenis: "KASIR" | "SALES";
  noHp?: string;
  alamat?: string;
}

interface Barang {
  id: number;
  namaBarang: string;
  hargaBeli: number;
  hargaJual: number;
  stok: number;
  jenisKemasan: string;
  jumlahPerKemasan: number;
  limitPenjualan: number;
  berat: number;
}

interface PenjualanItem {
  id?: number;
  barangId: number;
  jumlahDus: number;
  jumlahPcs: number;
  totalItem?: number;
  hargaJual: number;
  hargaJualPerDus?: number;
  hargaBeli: number;
  diskonPerItem: number;
  laba: number;
  barang: Barang;
}

interface AdjustmentItem {
  barangId: number;
  jenisPerubahan: "RETUR" | "TAMBAH";
  jumlahDus: number;
  jumlahPcs: number;
  barang?: Barang;
}

interface PenjualanHeader {
  id?: number;
  kodePenjualan?: string;
  customerId?: number | null;
  namaCustomer?: string | null;
  karyawanId?: number | null;
  namaSales?: string | null;
  subtotal: number;
  diskonNota: number;
  totalHarga: number;
  jumlahDibayar: number;
  kembalian: number;
  keterangan?: string | null;
  rutePengiriman?: string | null;
  metodePembayaran: "CASH" | "TRANSFER" | "CASH_TRANSFER";
  statusPembayaran: "LUNAS" | "HUTANG";
  statusTransaksi: "KERANJANG" | "SELESAI";
  tanggalTransaksi?: string;
  tanggalJatuhTempo?: string | null;
  items: PenjualanItem[];
  customer?: Customer;
  karyawan?: Karyawan;
}

const PenjualanPage = () => {
  // ... (semua state tetap sama seperti sebelumnya)
  const router = useRouter();
  const searchParams = useSearchParams();
  const [barangList, setBarangList] = useState<Barang[]>([]);
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);
  const [topCustomers, setTopCustomers] = useState<Customer[]>([]);
  const [topKaryawan, setTopKaryawan] = useState<Karyawan[]>([]);

  const [currentPenjualan, setCurrentPenjualan] = useState<PenjualanHeader>({
    items: [],
    subtotal: 0,
    diskonNota: 0,
    totalHarga: 0,
    jumlahDibayar: 0,
    kembalian: 0,
    metodePembayaran: "CASH",
    statusPembayaran: "HUTANG",
    statusTransaksi: "KERANJANG",
  });

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [selectedKaryawan, setSelectedKaryawan] = useState<Karyawan | null>(
    null
  );
  const [searchBarang, setSearchBarang] = useState("");
  const [searchCustomer, setSearchCustomer] = useState("");
  const [searchKaryawan, setSearchKaryawan] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showKaryawanDropdown, setShowKaryawanDropdown] = useState(false);
  const [expandCustomerSearch, setExpandCustomerSearch] = useState(false);
  const [expandKaryawanSearch, setExpandKaryawanSearch] = useState(false);

  const [itemDiskonTypes, setItemDiskonTypes] = useState<{
    [key: number]: "rupiah" | "persen";
  }>({});
  const [itemDiskonValues, setItemDiskonValues] = useState<{
    [key: number]: string;
  }>({});

  const [diskonNota, setDiskonNota] = useState("0");
  const [diskonNotaType, setDiskonNotaType] = useState<"rupiah" | "persen">(
    "rupiah"
  );
  const [jumlahDibayar, setJumlahDibayar] = useState("");
  const [jumlahCash, setJumlahCash] = useState("");
  const [jumlahTransfer, setJumlahTransfer] = useState("");

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [customerHutangInfo, setCustomerHutangInfo] =
    useState<CustomerHutangInfo | null>(null);
  const [loadingHutangInfo, setLoadingHutangInfo] = useState(false);

  const [loading, setLoading] = useState(false);
  const [editPenjualanId, setEditPenjualanId] = useState<number | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [originalQtyByBarangId, setOriginalQtyByBarangId] = useState<{
    [key: number]: number;
  }>({});
  const [tanggalPenjualan, setTanggalPenjualan] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [tanggalJatuhTempo, setTanggalJatuhTempo] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [rutePengiriman, setRutePengiriman] = useState("");
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [searchingKaryawan, setSearchingKaryawan] = useState(false);

  // State untuk tracking penjualan harian
  const [todaySales, setTodaySales] = useState<{ [barangId: number]: number }>(
    {}
  );

  const getTodaySold = (barangId: number): number => todaySales[barangId] || 0;

  const getHargaJualPerDus = (item: PenjualanItem): number =>
    item.hargaJualPerDus ?? item.barang.hargaJual;

  const deriveDusPcsFromTotal = (
    totalItem: number,
    jumlahPerKemasan: number
  ) => {
    const perKemasan = Math.max(1, jumlahPerKemasan);
    const jumlahDus = Math.floor(totalItem / perKemasan);
    const jumlahPcs = totalItem % perKemasan;
    return { jumlahDus, jumlahPcs };
  };

  const getTotalItemPcs = (item: PenjualanItem): number => {
    if (item.totalItem !== undefined && item.totalItem !== null) {
      return item.totalItem;
    }
    return item.jumlahDus * item.barang.jumlahPerKemasan + item.jumlahPcs;
  };

  const calculateBeratGramsFromBarang = (
    barang: Barang,
    totalPcs: number
  ): number => {
    const beratPerItem = Number(barang.berat || 0);
    if (beratPerItem <= 0 || totalPcs <= 0) return 0;
    return beratPerItem * totalPcs;
  };

  const formatGramsToKg = (grams: number): string => {
    if (!Number.isFinite(grams)) return "";
    const kg = grams / 1000;
    const formatted = kg.toFixed(3).replace(/\.?0+$/, "");
    return formatted.replace(".", ",");
  };

  const getItemBeratGrams = (item: PenjualanItem): number => {
    const totalPcs = getTotalItemPcs(item);
    return calculateBeratGramsFromBarang(item.barang, totalPcs);
  };

  const getDerivedQty = (item: PenjualanItem) => {
    const totalItem = getTotalItemPcs(item);
    return deriveDusPcsFromTotal(totalItem, item.barang.jumlahPerKemasan);
  };

  const getCartPcsForBarang = (barangId: number): number => {
    const item = currentPenjualan.items.find(
      (cartItem) => cartItem.barangId === barangId
    );
    if (!item) return 0;
    return getTotalItemPcs(item);
  };

  // ... (semua useEffect dan function tetap sama)

  useEffect(() => {
    fetchMasterData();
    fetchTopCustomers();
    fetchTopKaryawan();
    fetchTodaySales();
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

  const fetchTodaySales = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/penjualan/daily-summary?date=${today}`);
      const data = await res.json();

      if (data.success && data.data) {
        // Konversi array ke object map untuk akses cepat
        const salesMap: { [barangId: number]: number } = {};
        data.data.forEach((item: any) => {
          salesMap[item.barangId] = Number(item.totalTerjual);
        });
        setTodaySales(salesMap);
      }
    } catch (error) {
      console.error("Error fetching today sales:", error);
    }
  };

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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchKaryawan.trim().length >= 2) {
        searchKaryawanByKeyword(searchKaryawan);
      } else if (searchKaryawan.trim().length === 0) {
        setKaryawanList([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchKaryawan]);

  const fetchMasterData = async () => {
    try {
      const barangRes = await fetch("/api/barang");
      const barangData: any = await barangRes.json();
      if (barangData.success) setBarangList(barangData.data);
    } catch (error) {
      console.error("Error fetching master data:", error);
      toast.error("Gagal memuat data");
    }
  };

  const fetchTopCustomers = async () => {
    try {
      const res = await fetch("/api/customer?limit=2");
      const data = await res.json();
      if (data.success) {
        setTopCustomers(data.data);
      }
    } catch (error) {
      console.error("Error fetching top customers:", error);
    }
  };

  const fetchTopKaryawan = async () => {
    try {
      const res = await fetch("/api/karyawan?limit=2");
      const data = await res.json();
      if (data.data) {
        const salesOnly = data.data.filter(
          (k: Karyawan) => k.jenis === "SALES"
        );
        setTopKaryawan(salesOnly.slice(0, 2));
      }
    } catch (error) {
      console.error("Error fetching top karyawan:", error);
    }
  };

  const loadPenjualanForEdit = async (penjualanId: number) => {
    setLoadingEdit(true);
    try {
      const res = await fetch(`/api/penjualan/${penjualanId}`);
      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || "Gagal mengambil data penjualan");
        return;
      }

      const penjualan: PenjualanHeader = data.data;
      if (penjualan.statusTransaksi !== "SELESAI") {
        toast.error("Hanya penjualan selesai yang bisa diedit");
        setEditPenjualanId(null);
        router.replace("/dashboard/admin/penjualan-sales");
        return;
      }

      const originalQtyMap: { [key: number]: number } = {};
      const hydratedItems: PenjualanItem[] = penjualan.items.map((item) => {
        const hargaJualPerDus = Number(item.hargaJual);
        const totalPcs =
          item.totalItem !== undefined && item.totalItem !== null
            ? Number(item.totalItem)
            : Number(item.jumlahDus) * Number(item.barang.jumlahPerKemasan) +
              Number(item.jumlahPcs);
        const jumlahPerKemasan = Number(item.barang.jumlahPerKemasan);
        const { jumlahDus, jumlahPcs } =
          jumlahPerKemasan <= 1
            ? { jumlahDus: 0, jumlahPcs: totalPcs }
            : deriveDusPcsFromTotal(totalPcs, jumlahPerKemasan);
        const hargaJualPerPcs =
          hargaJualPerDus / Number(item.barang.jumlahPerKemasan);
        const hargaBeliPerPcs =
          Number(item.barang.hargaBeli) /
          Number(item.barang.jumlahPerKemasan);
        const hargaJualTotal = hargaJualPerPcs * totalPcs;
        const diskonTotal = Number(item.diskonPerItem) * jumlahDus;
        const hargaBeliTotal = hargaBeliPerPcs * totalPcs;
        const totalHarga = hargaJualTotal - diskonTotal;

        return {
          ...item,
          jumlahDus,
          jumlahPcs,
          totalItem: totalPcs,
          hargaJualPerDus,
          hargaJual: totalHarga,
          hargaBeli: hargaBeliTotal,
          laba: totalHarga - hargaBeliTotal,
        };
      });
      hydratedItems.forEach((item) => {
        const totalItem = getTotalItemPcs(item);
        originalQtyMap[item.barangId] =
          (originalQtyMap[item.barangId] || 0) + totalItem;
      });

      const diskonTypes: { [key: number]: "rupiah" | "persen" } = {};
      const diskonValues: { [key: number]: string } = {};

      hydratedItems.forEach((item, index) => {
        diskonTypes[index] = "rupiah";
        diskonValues[index] = Number(item.diskonPerItem).toLocaleString("id-ID");
      });

      setItemDiskonTypes(diskonTypes);
      setItemDiskonValues(diskonValues);
      setOriginalQtyByBarangId(originalQtyMap);
      setSelectedCustomer(penjualan.customer || null);
      setSelectedKaryawan(penjualan.karyawan || null);
      setDiskonNotaType("rupiah");
      setDiskonNota(Number(penjualan.diskonNota).toLocaleString("id-ID"));
      const penjualanDibayar = Number(penjualan.jumlahDibayar).toLocaleString(
        "id-ID"
      );
      setJumlahDibayar(penjualanDibayar);
      if (penjualan.metodePembayaran === "CASH_TRANSFER") {
        setJumlahCash(penjualanDibayar);
        setJumlahTransfer("");
      } else {
        setJumlahCash("");
        setJumlahTransfer("");
      }
      setTanggalPenjualan(
        penjualan.tanggalTransaksi
          ? new Date(penjualan.tanggalTransaksi).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      setTanggalJatuhTempo(
        penjualan.tanggalJatuhTempo
          ? new Date(penjualan.tanggalJatuhTempo).toISOString().split("T")[0]
          : ""
      );
      setKeterangan(penjualan.keterangan || "");
      setRutePengiriman(penjualan.rutePengiriman || "");

      setCurrentPenjualan({
        items: hydratedItems,
        subtotal: Number(penjualan.subtotal),
        diskonNota: Number(penjualan.diskonNota),
        totalHarga: Number(penjualan.totalHarga),
        jumlahDibayar: Number(penjualan.jumlahDibayar),
        kembalian: Number(penjualan.kembalian),
        metodePembayaran: penjualan.metodePembayaran,
        statusPembayaran: penjualan.statusPembayaran,
        statusTransaksi: penjualan.statusTransaksi,
      });

      if (penjualan.customer?.id) {
        fetchCustomerHutangInfo(penjualan.customer.id);
      }
    } catch (error) {
      console.error("Error loading penjualan:", error);
      toast.error("Gagal memuat data penjualan");
    } finally {
      setLoadingEdit(false);
    }
  };

  const searchCustomerByKeyword = async (keyword: string) => {
    setSearchingCustomer(true);
    try {
      const res = await fetch(
        `/api/customer/search/${encodeURIComponent(keyword)}?limit=5`
      );
      const data = await res.json();
      if (data.success) {
        setCustomerList(data.data);
      }
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
      if (data.success) {
        setCustomerHutangInfo(data.data);
      } else {
        setCustomerHutangInfo(null);
      }
    } catch (error) {
      console.error("Error fetching customer hutang info:", error);
      setCustomerHutangInfo(null);
    } finally {
      setLoadingHutangInfo(false);
    }
  };

  const searchKaryawanByKeyword = async (keyword: string) => {
    setSearchingKaryawan(true);
    try {
      const res = await fetch(
        `/api/karyawan?search=${encodeURIComponent(keyword)}&limit=5`
      );
      const data = await res.json();
      if (data.data) {
        const salesOnly = data.data.filter(
          (k: Karyawan) => k.jenis === "SALES"
        );
        setKaryawanList(salesOnly);
      }
    } catch (error) {
      console.error("Error searching karyawan:", error);
    } finally {
      setSearchingKaryawan(false);
    }
  };

  const formatRupiahInput = (value: string): string => {
    const number = value.replace(/[^\d]/g, "");
    if (!number) return "";
    return parseInt(number).toLocaleString("id-ID");
  };

  const parseRupiahToNumber = (value: string): number => {
    return parseInt(value.replace(/[^\d]/g, "")) || 0;
  };

  const formatRupiah = (number: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(number);
  };

  const formatMetodePembayaranLabel = (
    metode: "CASH" | "TRANSFER" | "CASH_TRANSFER"
  ) => {
    return metode === "CASH_TRANSFER" ? "CASH + TRANSFER" : metode;
  };

  const updatePembayaranFromJumlah = (amount: number) => {
    const total = currentPenjualan.totalHarga;
    const kembalian = amount > total ? amount - total : 0;
    setCurrentPenjualan((prev) => ({
      ...prev,
      jumlahDibayar: amount,
      kembalian,
      statusPembayaran: amount >= total ? "LUNAS" : "HUTANG",
    }));
  };

  const getEffectiveJumlahDibayar = (): number => {
    if (currentPenjualan.metodePembayaran === "CASH_TRANSFER") {
      return (
        parseRupiahToNumber(jumlahCash) +
        parseRupiahToNumber(jumlahTransfer)
      );
    }
    return parseRupiahToNumber(jumlahDibayar);
  };

  const getPembayaranBreakdown = (): { cash: number; transfer: number } => {
    if (currentPenjualan.metodePembayaran === "CASH_TRANSFER") {
      return {
        cash: parseRupiahToNumber(jumlahCash),
        transfer: parseRupiahToNumber(jumlahTransfer),
      };
    }

    if (currentPenjualan.metodePembayaran === "TRANSFER") {
      return { cash: 0, transfer: parseRupiahToNumber(jumlahDibayar) };
    }

    return { cash: parseRupiahToNumber(jumlahDibayar), transfer: 0 };
  };

  const handleMetodePembayaranChange = (
    metode: "CASH" | "TRANSFER" | "CASH_TRANSFER"
  ) => {
    if (metode === "CASH_TRANSFER") {
      if (jumlahDibayar) {
        setJumlahCash(jumlahDibayar);
        updatePembayaranFromJumlah(parseRupiahToNumber(jumlahDibayar));
      }
      if (!jumlahTransfer) {
        setJumlahTransfer("");
      }
    } else if (currentPenjualan.metodePembayaran === "CASH_TRANSFER") {
      const total =
        parseRupiahToNumber(jumlahCash) +
        parseRupiahToNumber(jumlahTransfer);
      setJumlahDibayar(total ? total.toLocaleString("id-ID") : "");
      updatePembayaranFromJumlah(total);
      setJumlahCash("");
      setJumlahTransfer("");
    }

    setCurrentPenjualan((prev) => ({
      ...prev,
      metodePembayaran: metode,
    }));
  };

  const setJumlahByNumber = (
    setter: (value: string) => void,
    value: number
  ) => {
    setter(value ? value.toLocaleString("id-ID") : "");
  };

  const handleAddItem = async (barang: Barang) => {
    try {
      // Fetch stok terbaru dari database
      const res = await fetch(`/api/barang/${barang.id}`);
      const data = await res.json();

      if (!data.success) {
        toast.error("Gagal mengecek stok barang");
        return;
      }

      const currentStok = Number(data.data.stok);
      const jumlahPerKemasan = Number(data.data.jumlahPerKemasan);
      const originalQty = editPenjualanId
        ? originalQtyByBarangId[barang.id] || 0
        : 0;
      const stokTersedia = currentStok + originalQty;

      // Hitung total yang sudah ada di keranjang untuk barang ini
      const existingItem = currentPenjualan.items.find(
        (item) => item.barangId === barang.id
      );
      let totalDiKeranjang = 0;

      if (existingItem) {
        totalDiKeranjang = getTotalItemPcs(existingItem);
      }

      // Validasi 1: Cek stok terlebih dahulu (hard limit fisik)
      const sisaStok = stokTersedia - totalDiKeranjang;
      if (sisaStok < jumlahPerKemasan) {
        toast.error(
          `Stok tidak mencukupi! Stok tersedia: ${stokTersedia} pcs, sudah di keranjang: ${totalDiKeranjang} pcs, sisa: ${sisaStok} pcs`
        );
        return;
      }

      // Validasi 2: Cek limit penjualan (jika ada)
      const todaySold = getTodaySold(barang.id);
      const limitPenjualan = Number(barang.limitPenjualan || 0);
      const effectiveSold = Math.max(0, todaySold - originalQty);

      if (limitPenjualan > 0) {
        const remainingLimit = limitPenjualan - effectiveSold - totalDiKeranjang;

        if (remainingLimit <= 0) {
          toast.error(
            `Limit penjualan harian tercapai!\nLimit: ${limitPenjualan} pcs\nTerjual hari ini: ${todaySold} pcs\nDi keranjang: ${totalDiKeranjang} pcs`
          );
          return;
        }

        if (jumlahPerKemasan > remainingLimit) {
          const sisaDus = Math.floor(remainingLimit / jumlahPerKemasan);
          toast.error(
            `Limit penjualan harian telah tercapai!\nSisa limit: ${remainingLimit} item / ${sisaDus} Dus`
          );
          return;
        }
      }

      const existingItemIndex = currentPenjualan.items.findIndex(
        (item) => item.barangId === barang.id
      );

      if (existingItemIndex >= 0) {
        const updatedItems = [...currentPenjualan.items];

        // Tambahkan 1 dus
        if (jumlahPerKemasan <= 1) {
          updatedItems[existingItemIndex].jumlahPcs += 1;
          toast.success(`${barang.namaBarang} +1 item`);
        } else {
          updatedItems[existingItemIndex].jumlahDus += 1;
          toast.success(`${barang.namaBarang} +1 ${barang.jenisKemasan}`);
        }

        if (itemDiskonTypes[existingItemIndex] === undefined) {
          setItemDiskonTypes((prev) => ({
            ...prev,
            [existingItemIndex]: "rupiah",
          }));
          setItemDiskonValues((prev) => ({
            ...prev,
            [existingItemIndex]: "0",
          }));
        }

        updateItemCalculation(updatedItems, existingItemIndex);
      } else {
        const newItem: PenjualanItem = {
          barangId: barang.id,
          jumlahDus: jumlahPerKemasan > 1 ? 1 : 0,
          jumlahPcs: jumlahPerKemasan > 1 ? 0 : 1,
          totalItem: jumlahPerKemasan > 1 ? jumlahPerKemasan : 1,
          hargaJual: barang.hargaJual,
          hargaJualPerDus: barang.hargaJual,
          hargaBeli: barang.hargaBeli,
          diskonPerItem: 0,
          laba: 0,
          barang: barang,
        };

        const newIndex = currentPenjualan.items.length;
        const updatedItems = [...currentPenjualan.items, newItem];

        setItemDiskonTypes((prev) => ({ ...prev, [newIndex]: "rupiah" }));
        setItemDiskonValues((prev) => ({ ...prev, [newIndex]: "0" }));

        updateItemCalculation(updatedItems, newIndex);
        toast.success(
          `${barang.namaBarang} ditambahkan (1 ${barang.jenisKemasan})`
        );
      }

      // Refresh data barang untuk update tampilan stok
      await fetchMasterData();
    } catch (error) {
      console.error("Error adding item:", error);
      toast.error("Terjadi kesalahan saat menambahkan barang");
    }
  };

  const updateItemCalculation = (items: PenjualanItem[], index: number) => {
    const item = items[index];
    const totalPcs =
      item.jumlahDus * item.barang.jumlahPerKemasan + item.jumlahPcs;
    item.totalItem = totalPcs;
    const { jumlahDus } = getDerivedQty(item);
    const hargaJualPerPcs =
      getHargaJualPerDus(item) / item.barang.jumlahPerKemasan;
    const hargaBeliPerPcs =
      item.barang.hargaBeli / item.barang.jumlahPerKemasan;

    const hargaJualTotal = hargaJualPerPcs * totalPcs;
    const diskonTotal = item.diskonPerItem * jumlahDus;
    const hargaBeliTotal = hargaBeliPerPcs * totalPcs;

    item.hargaJual = hargaJualTotal - diskonTotal;
    item.hargaBeli = hargaBeliTotal;
    item.laba = item.hargaJual - item.hargaBeli;

    recalculateTotal(items);
  };

  const recalculateTotal = (items: PenjualanItem[]) => {
    // Hitung subtotal SEBELUM diskon item (harga asli)
    const subtotalSebelumDiskon = items.reduce((sum, item) => {
      const totalPcs = getTotalItemPcs(item);
      const hargaJualPerPcs =
        getHargaJualPerDus(item) / item.barang.jumlahPerKemasan;
      return sum + hargaJualPerPcs * totalPcs;
    }, 0);

    // Hitung total diskon item
    const totalDiskon = items.reduce((sum, item) => {
      const { jumlahDus } = getDerivedQty(item);
      return sum + item.diskonPerItem * jumlahDus;
    }, 0);

    // Hitung subtotal SETELAH diskon item
    const subtotalSetelahDiskon = subtotalSebelumDiskon - totalDiskon;

    // Diskon nota dihitung dari subtotal SETELAH diskon item
    const diskonNotaRupiah = calculateDiskonNotaRupiah(subtotalSetelahDiskon);
    const totalHarga = subtotalSetelahDiskon - diskonNotaRupiah;
    const dibayar = getEffectiveJumlahDibayar();
    const kembalian = dibayar > totalHarga ? dibayar - totalHarga : 0;

    setCurrentPenjualan((prev) => ({
      ...prev,
      items,
      subtotal: subtotalSebelumDiskon, // Simpan subtotal SEBELUM diskon untuk ditampilkan
      diskonNota: diskonNotaRupiah,
      totalHarga,
      jumlahDibayar: dibayar,
      kembalian,
    }));
  };

  const recalculateTotalWithDiskon = (
    items: PenjualanItem[],
    diskonNotaValue: string,
    diskonType: "rupiah" | "persen"
  ) => {
    // Hitung subtotal SEBELUM diskon item (harga asli)
    const subtotalSebelumDiskon = items.reduce((sum, item) => {
      const totalPcs = getTotalItemPcs(item);
      const hargaJualPerPcs =
        getHargaJualPerDus(item) / item.barang.jumlahPerKemasan;
      return sum + hargaJualPerPcs * totalPcs;
    }, 0);

    // Hitung total diskon item
    const totalDiskon = items.reduce((sum, item) => {
      const { jumlahDus } = getDerivedQty(item);
      return sum + item.diskonPerItem * jumlahDus;
    }, 0);

    // Hitung subtotal SETELAH diskon item
    const subtotalSetelahDiskon = subtotalSebelumDiskon - totalDiskon;

    // Hitung diskon nota dengan nilai dan tipe yang diberikan
    let diskonNotaRupiah: number;
    if (diskonType === "persen") {
      const persen = parseInt(diskonNotaValue) || 0;
      diskonNotaRupiah = Math.round((subtotalSetelahDiskon * persen) / 100);
    } else {
      diskonNotaRupiah = parseRupiahToNumber(diskonNotaValue);
    }

    const totalHarga = subtotalSetelahDiskon - diskonNotaRupiah;
    const dibayar = getEffectiveJumlahDibayar();
    const kembalian = dibayar > totalHarga ? dibayar - totalHarga : 0;

    setCurrentPenjualan((prev) => ({
      ...prev,
      items,
      subtotal: subtotalSebelumDiskon,
      diskonNota: diskonNotaRupiah,
      totalHarga,
      jumlahDibayar: dibayar,
      kembalian,
    }));
  };

  const calculateDiskonNotaRupiah = (subtotal: number): number => {
    if (diskonNotaType === "persen") {
      const persen = parseInt(diskonNota) || 0;
      return Math.round((subtotal * persen) / 100);
    } else {
      return parseRupiahToNumber(diskonNota);
    }
  };

  const handleUpdateItemQuantity = async (
    index: number,
    field: "jumlahDus" | "jumlahPcs",
    value: number
  ) => {
    let warningMessage: string | null = null;

    try {
      const updatedItems = [...currentPenjualan.items];
      const item = updatedItems[index];
      const barang = item.barang;

      // Fetch stok terbaru dari database
      const res = await fetch(`/api/barang/${barang.id}`);
      const data = await res.json();

      if (!data.success) {
        toast.error("Gagal mengecek stok barang");
        return;
      }

      const currentStok = Number(data.data.stok);
      const jumlahPerKemasan = Number(data.data.jumlahPerKemasan);
      const originalQty = editPenjualanId
        ? originalQtyByBarangId[barang.id] || 0
        : 0;
      const stokTersedia = currentStok + originalQty;

      // Set nilai baru
      let newJumlahDus = updatedItems[index].jumlahDus;
      let newJumlahPcs = updatedItems[index].jumlahPcs;

      if (jumlahPerKemasan <= 1) {
        newJumlahDus = 0;
        newJumlahPcs = Math.max(0, value);
      } else if (field === "jumlahDus") {
        newJumlahDus = Math.max(0, value);
      } else {
        newJumlahPcs = Math.max(0, value);
      }

      let totalSetelahUpdate = newJumlahDus * jumlahPerKemasan + newJumlahPcs;

      // Validasi stok
      if (totalSetelahUpdate > stokTersedia) {
        toast.error(
          `Stok tidak mencukupi! Stok tersedia: ${stokTersedia} pcs`
        );
        return;
      }

      // Cek limit penjualan jika ada
      const hasLimit = barang.limitPenjualan > 0;
      if (hasLimit) {
        const todaySold = getTodaySold(barang.id);
        const effectiveSold = Math.max(0, todaySold - originalQty);
        const newTotalPcs = totalSetelahUpdate;
        const totalIfUpdated = effectiveSold + newTotalPcs;

        if (totalIfUpdated > barang.limitPenjualan) {
          const maxAllowed = Math.max(
            0,
            Math.min(barang.limitPenjualan - effectiveSold, stokTersedia)
          );
          let clampedDus = newJumlahDus;
          let clampedPcs = newJumlahPcs;

          if (jumlahPerKemasan <= 1 || field === "jumlahPcs") {
            clampedPcs = Math.min(Math.max(0, maxAllowed), newJumlahPcs);
          } else if (field === "jumlahDus") {
            const maxDus = Math.max(
              0,
              Math.floor((maxAllowed - clampedPcs) / jumlahPerKemasan)
            );
            clampedDus = Math.min(newJumlahDus, maxDus);
          } else {
            clampedDus = Math.floor(maxAllowed / jumlahPerKemasan);
            clampedPcs = maxAllowed % jumlahPerKemasan;
          }

          newJumlahDus = clampedDus;
          newJumlahPcs = clampedPcs;
          totalSetelahUpdate = newJumlahDus * jumlahPerKemasan + newJumlahPcs;
          warningMessage = `Limit penjualan harian telah tercapai !`;
        }
      }

      // Set nilai baru setelah validasi lolos/penyesuaian limit
      updatedItems[index].jumlahDus = newJumlahDus;
      updatedItems[index].jumlahPcs = newJumlahPcs;

      updateItemCalculation(updatedItems, index);

      // Refresh data barang
      await fetchMasterData();
    } catch (error) {
      console.error("Error updating item quantity:", error);
      toast.error("Terjadi kesalahan saat mengupdate jumlah");
    } finally {
      if (warningMessage) {
        toast.error(warningMessage);
      }
    }
  };

  const handleItemDiskonChange = (
    index: number,
    value: string,
    type: "rupiah" | "persen"
  ) => {
    const item = currentPenjualan.items[index];
    let diskonRupiah: number;
    let displayValue: string;

    if (type === "persen") {
      const cleanValue = value.replace(/[^\d]/g, "");
      const persen = parseInt(cleanValue) || 0;
      const clampedPersen = Math.min(100, Math.max(0, persen));
      const hargaPerDus = getHargaJualPerDus(item);
      diskonRupiah = Math.round((hargaPerDus * clampedPersen) / 100);
      displayValue = cleanValue === "" ? "" : clampedPersen.toString();
    } else {
      diskonRupiah = parseRupiahToNumber(value);
      displayValue = formatRupiahInput(value);
    }

    setItemDiskonValues((prev) => ({ ...prev, [index]: displayValue }));

    const updatedItems = [...currentPenjualan.items];
    updatedItems[index].diskonPerItem = diskonRupiah;
    updateItemCalculation(updatedItems, index);
  };

  const toggleItemDiskonType = (index: number) => {
    const currentType = itemDiskonTypes[index] || "rupiah";
    const newType = currentType === "rupiah" ? "persen" : "rupiah";
    const item = currentPenjualan.items[index];

    setItemDiskonTypes((prev) => ({ ...prev, [index]: newType }));

    if (newType === "persen") {
      const hargaPerDus = getHargaJualPerDus(item);
      const persen =
        hargaPerDus > 0
          ? Math.round((item.diskonPerItem / hargaPerDus) * 100)
          : 0;
      setItemDiskonValues((prev) => ({ ...prev, [index]: persen.toString() }));
    } else {
      setItemDiskonValues((prev) => ({
        ...prev,
        [index]: item.diskonPerItem.toLocaleString("id-ID"),
      }));
    }
  };

  const getItemDiskonDisplayValue = (index: number): string => {
    const storedValue = itemDiskonValues[index];
    if (storedValue !== undefined && storedValue !== "") {
      return storedValue;
    }

    const type = itemDiskonTypes[index] || "rupiah";
    const item = currentPenjualan.items[index];

    if (type === "persen") {
      const hargaPerDus = getHargaJualPerDus(item);
      const persen =
        hargaPerDus > 0
          ? Math.round((item.diskonPerItem / hargaPerDus) * 100)
          : 0;
      return persen.toString();
    } else {
      return item.diskonPerItem === 0
        ? "0"
        : item.diskonPerItem.toLocaleString("id-ID");
    }
  };

  const handleDeleteItem = (index: number) => {
    const updatedItems = currentPenjualan.items.filter((_, i) => i !== index);

    const newDiskonTypes = { ...itemDiskonTypes };
    const newDiskonValues = { ...itemDiskonValues };
    delete newDiskonTypes[index];
    delete newDiskonValues[index];

    const reindexedTypes: { [key: number]: "rupiah" | "persen" } = {};
    const reindexedValues: { [key: number]: string } = {};

    Object.keys(newDiskonTypes).forEach((key) => {
      const oldIndex = parseInt(key);
      const newIndex = oldIndex > index ? oldIndex - 1 : oldIndex;
      reindexedTypes[newIndex] = newDiskonTypes[oldIndex];
      reindexedValues[newIndex] = newDiskonValues[oldIndex];
    });

    setItemDiskonTypes(reindexedTypes);
    setItemDiskonValues(reindexedValues);

    recalculateTotal(updatedItems);
    toast.success("Item dihapus");
  };

  const handleDiskonNotaChange = (value: string) => {
    let newDiskonNota: string;
    if (diskonNotaType === "persen") {
      const persen = parseInt(value) || 0;
      newDiskonNota = Math.min(100, Math.max(0, persen)).toString();
    } else {
      newDiskonNota = formatRupiahInput(value);
    }
    setDiskonNota(newDiskonNota);

    // Recalculate dengan nilai baru langsung
    recalculateTotalWithDiskon(
      currentPenjualan.items,
      newDiskonNota,
      diskonNotaType
    );
  };

  const toggleDiskonNotaType = () => {
    const newType = diskonNotaType === "rupiah" ? "persen" : "rupiah";

    // Hitung subtotal setelah diskon item
    const totalDiskonItem = currentPenjualan.items.reduce(
      (sum, item) => {
        const { jumlahDus } = getDerivedQty(item);
        return sum + item.diskonPerItem * jumlahDus;
      },
      0
    );
    const subtotalSetelahDiskonItem =
      currentPenjualan.subtotal - totalDiskonItem;

    let newDiskonNota: string;
    if (newType === "persen") {
      const currentRupiah = parseRupiahToNumber(diskonNota);
      const persen =
        subtotalSetelahDiskonItem > 0
          ? Math.round((currentRupiah / subtotalSetelahDiskonItem) * 100)
          : 0;
      newDiskonNota = persen.toString();
    } else {
      const currentPersen = parseInt(diskonNota) || 0;
      const rupiah = Math.round(
        (subtotalSetelahDiskonItem * currentPersen) / 100
      );
      newDiskonNota = rupiah.toLocaleString("id-ID");
    }

    setDiskonNotaType(newType);
    setDiskonNota(newDiskonNota);

    // Recalculate dengan tipe dan nilai baru langsung
    recalculateTotalWithDiskon(currentPenjualan.items, newDiskonNota, newType);
  };

  const handleCheckout = async () => {
    if (!selectedCustomer) {
      toast.error("Customer wajib dipilih!");
      return;
    }

    if (!selectedKaryawan) {
      toast.error("Sales wajib dipilih!");
      return;
    }

    if (currentPenjualan.items.length === 0) {
      toast.error("Keranjang masih kosong");
      return;
    }

    const jumlahDibayarFinal = getEffectiveJumlahDibayar();

    setLoading(true);
    try {
      if (editPenjualanId) {
        const updatePayload: any = {
          items: currentPenjualan.items.map((item) => ({
            id: item.id,
            barangId: item.barangId,
            jumlahDus: item.jumlahDus,
            jumlahPcs: item.jumlahPcs,
            totalItem: getTotalItemPcs(item),
            hargaJual: getHargaJualPerDus(item),
            diskonPerItem: item.diskonPerItem,
            berat: getItemBeratGrams(item),
          })),
          customerId: selectedCustomer?.id,
          karyawanId: selectedKaryawan?.id,
          diskonNota: currentPenjualan.diskonNota,
          jumlahDibayar: jumlahDibayarFinal,
          metodePembayaran: currentPenjualan.metodePembayaran,
          tanggalTransaksi: tanggalPenjualan,
          tanggalJatuhTempo: tanggalJatuhTempo || undefined,
          keterangan: keterangan || undefined,
          rutePengiriman: rutePengiriman || undefined,
        };
        const { cash, transfer } = getPembayaranBreakdown();
        updatePayload.totalCash = cash;
        updatePayload.totalTransfer = transfer;

        const updateRes = await fetch(
          `/api/penjualan/${editPenjualanId}/edit`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatePayload),
          }
        );
        const updateResult = await updateRes.json();

        if (updateResult.success) {
          setReceiptData({
            ...updateResult.data.receipt,
            id: editPenjualanId,
          });
          setShowCheckoutModal(false);
          setShowReceiptModal(true);
          toast.success(updateResult.message || "Penjualan berhasil diupdate");
          fetchMasterData();
          fetchTopCustomers();
          fetchTopKaryawan();
          fetchTodaySales();
        } else {
          throw new Error(updateResult.error || "Gagal update penjualan");
        }

        return;
      }

      // Buat transaksi baru dan dapatkan kode penjualan
      const createRes = await fetch("/api/penjualan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: 1 }),
      });
      const createData = await createRes.json();

      if (!createData.success) {
        throw new Error("Gagal membuat transaksi");
      }

      const penjualanId = createData.data.id;

      // Tambahkan items ke penjualan
      for (const item of currentPenjualan.items) {
        await fetch(`/api/penjualan/${penjualanId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barangId: item.barangId,
            jumlahDus: item.jumlahDus,
            jumlahPcs: item.jumlahPcs,
            totalItem: getTotalItemPcs(item),
            diskonPerItem: item.diskonPerItem,
            berat: getItemBeratGrams(item),
          }),
        });
      }

      // Update customer dan karyawan
      const patchRes = await fetch(`/api/penjualan/${penjualanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer?.id || null,
          karyawanId: selectedKaryawan?.id || null,
        }),
      });

      const patchData = await patchRes.json();

      if (!patchData.success) {
        throw new Error(patchData.error || "Gagal update customer/karyawan");
      }

      const checkoutRes = await fetch(
        `/api/penjualan/${penjualanId}/checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            diskonNota: currentPenjualan.diskonNota,
            jumlahDibayar: jumlahDibayarFinal,
            metodePembayaran: currentPenjualan.metodePembayaran,
            tanggalPenjualan: tanggalPenjualan,
            tanggalJatuhTempo: tanggalJatuhTempo || undefined,
            keterangan: keterangan || undefined,
            rutePengiriman: rutePengiriman || undefined,
            totalCash: getPembayaranBreakdown().cash,
            totalTransfer: getPembayaranBreakdown().transfer,
          }),
        }
      );
      const checkoutData = await checkoutRes.json();

      if (checkoutData.success) {
        const detailRes = await fetch(`/api/penjualan/${penjualanId}`);
        const detailData = await detailRes.json();

        setReceiptData(detailData.data);
        setShowCheckoutModal(false);
        setShowReceiptModal(true);
        toast.success("Transaksi berhasil!");
        fetchMasterData();
        fetchTopCustomers();
        fetchTopKaryawan();
        fetchTodaySales(); // Refresh data penjualan harian
      } else {
        throw new Error(checkoutData.error);
      }
    } catch (error: any) {
      console.error("Error checkout:", error);
      toast.error(error.message || "Gagal checkout");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseCheckoutModal = () => {
    // Tutup modal tanpa perlu menghapus transaksi
    // karena transaksi belum dibuat saat modal dibuka
    setShowCheckoutModal(false);
  };

  const handleReset = () => {
    setCurrentPenjualan({
      items: [],
      subtotal: 0,
      diskonNota: 0,
      totalHarga: 0,
      jumlahDibayar: 0,
      kembalian: 0,
      metodePembayaran: "CASH",
      statusPembayaran: "HUTANG",
      statusTransaksi: "KERANJANG",
    });
    setSelectedCustomer(null);
    setSelectedKaryawan(null);
    setDiskonNota("0");
    setJumlahDibayar("");
    setJumlahCash("");
    setJumlahTransfer("");
    setTanggalPenjualan(new Date().toISOString().split("T")[0]);
    setTanggalJatuhTempo("");
    setKeterangan("");
    setRutePengiriman("");
    setItemDiskonTypes({});
    setItemDiskonValues({});
    setSearchCustomer("");
    setSearchKaryawan("");
    setCustomerList([]);
    setKaryawanList([]);
    setExpandCustomerSearch(false);
    setExpandKaryawanSearch(false);
    setCustomerHutangInfo(null);
    if (editPenjualanId) {
      setEditPenjualanId(null);
      router.replace("/dashboard/admin/penjualan-sales");
    }
  };

  const filteredBarang = barangList.filter((b) =>
    b.namaBarang.toLowerCase().includes(searchBarang.toLowerCase())
  );

  const getPaymentStatus = () => {
    const bayar = getEffectiveJumlahDibayar();
    const total = currentPenjualan.totalHarga;

    if (bayar >= total) {
      return {
        status: "LUNAS",
        kembalian: bayar - total,
        sisaHutang: 0,
        canCheckout: true,
        message: null,
      };
    } else {
      const sisaHutang = total - bayar;

      if (selectedCustomer) {
        const sisaLimit =
          selectedCustomer.limit_piutang - selectedCustomer.piutang;
        if (sisaHutang > sisaLimit) {
          return {
            status: "HUTANG",
            kembalian: 0,
            sisaHutang,
            canCheckout: true,
            message: `Hutang melebihi limit! Sisa limit: ${formatRupiah(
              sisaLimit
            )}`,
          };
        }
      }

      return {
        status: "HUTANG",
        kembalian: 0,
        sisaHutang,
        canCheckout: true,
        message: null,
      };
    }
  };

  const hasPaymentInput =
    currentPenjualan.metodePembayaran === "CASH_TRANSFER"
      ? jumlahCash.trim() !== "" || jumlahTransfer.trim() !== ""
      : jumlahDibayar.trim() !== "";
  const paymentStatus = hasPaymentInput ? getPaymentStatus() : null;

  const totalDiskonItem = currentPenjualan.items.reduce((sum, item) => {
    const { jumlahDus } = getDerivedQty(item);
    return sum + item.diskonPerItem * jumlahDus;
  }, 0);

  return (
    <div className="w-full min-h-[calc(100vh-6rem)] max-h-[calc(100vh-6rem)] overflow-x-hidden overflow-y-auto flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
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
          success: {
            iconTheme: {
              primary: "#10b981",
              secondary: "#fff",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#fff",
            },
          },
        }}
      />

      {/* Header */}
      <div className="mx-3 mb-4">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-xl p-5 shadow-xl">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full -mr-24 -mt-24"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -ml-16 -mb-16"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 backdrop-blur-sm p-2.5 rounded-lg shadow-lg">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Penjualan Sales
                </h1>
                <p className="text-blue-100 text-sm">
                  Kelola transaksi penjualan ke customer melalui sales
                </p>
                {editPenjualanId && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-2 bg-yellow-400/90 text-slate-900 text-xs font-bold px-2.5 py-1 rounded-full">
                      Mode Edit • #{editPenjualanId}
                      {loadingEdit && (
                        <span className="inline-block h-2 w-2 rounded-full bg-slate-900 animate-pulse" />
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href="/dashboard/admin/penjualan/riwayat"
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg text-sm"
              >
                <Receipt className="w-4 h-4" />
                Riwayat
              </Link>
              <button
                onClick={handleReset}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Reset Transaksi
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Full Height */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        <div className="h-full min-h-0 flex gap-3">
          {/* Left Side - 68% */}
          <div className="w-[68%] flex flex-col gap-3 h-full min-h-0">
            {/* Customer & Sales Selection */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="grid grid-cols-2 divide-x divide-gray-200">
                {/* Customer Section */}
                <div className="p-4">
                  <label className="text-xs font-extrabold text-gray-800 mb-3 uppercase tracking-wider flex items-center gap-2">
                    <div className="bg-blue-100 p-1.5 rounded-lg">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <span>
                      Customer <span className="text-red-500">*</span>
                    </span>
                  </label>

                  {selectedCustomer ? (
                    <>
                      <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-lg shadow-md text-white border border-blue-400 relative overflow-hidden group hover:shadow-lg transition-all">
                        <div className="relative flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate mb-1">
                              {selectedCustomer.nama}
                            </p>
                            <div className="flex items-center gap-2.5 text-xs text-blue-50">
                              <span className="truncate flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 shrink-0" />
                                {selectedCustomer.namaToko}
                              </span>
                              <span className="text-blue-300">•</span>
                              <span className="truncate flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 shrink-0" />
                                {selectedCustomer.noHp}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedCustomer(null);
                              setSearchCustomer("");
                              setExpandCustomerSearch(false);
                              setCustomerHutangInfo(null);
                            }}
                            className="text-white hover:bg-white/20 p-1.5 rounded transition-all shrink-0 hover:scale-110 active:scale-95"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {loadingHutangInfo ? (
                        <div className="bg-white border-2 border-blue-200 rounded-lg p-3 text-center mt-2">
                          <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                          <p className="text-xs text-gray-600 mt-1">
                            Memuat info hutang...
                          </p>
                        </div>
                      ) : customerHutangInfo ? (
                        <div className="bg-gradient-to-br from-white to-gray-50 border-2 border-blue-200 rounded-lg p-3 space-y-2 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-700">
                              Transaksi Hutang:
                            </span>
                            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                              {customerHutangInfo.jumlahTransaksiHutang} transaksi
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-700">
                              Total Hutang:
                            </span>
                            <span className="text-xs font-bold text-orange-600">
                              {formatRupiah(customerHutangInfo.piutang)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                            <span className="text-xs font-semibold text-gray-700">
                              Sisa Limit:
                            </span>
                            <span
                              className={`text-xs font-bold ${
                                customerHutangInfo.sisaLimitHutang > 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {formatRupiah(customerHutangInfo.sisaLimitHutang)}
                            </span>
                          </div>
                          {customerHutangInfo.sisaLimitHutang <= 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded-md">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span className="font-medium">
                                Limit hutang sudah penuh!
                              </span>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="space-y-2.5">
                      {!expandCustomerSearch && (
                        <button
                          onClick={() => setExpandCustomerSearch(true)}
                          className="w-full text-center py-3 px-4 bg-gray-50 hover:bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 transition-all duration-200 group"
                        >
                          <p className="text-sm text-gray-600 group-hover:text-blue-600 font-semibold flex items-center justify-center gap-2 transition-colors">
                            <Search className="w-4 h-4" />
                            Cari customer untuk memulai
                          </p>
                        </button>
                      )}

                      {expandCustomerSearch && (
                        <div className="relative animate-in fade-in slide-in-from-top-2 duration-300">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 z-10" />
                          <input
                            type="text"
                            placeholder="Ketik nama atau nama toko..."
                            value={searchCustomer}
                            onChange={(e) => {
                              setSearchCustomer(e.target.value);
                              setShowCustomerDropdown(true);
                            }}
                            className="w-full pl-10 pr-4 py-2.5 border-2 border-blue-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-medium shadow-sm transition-all duration-200"
                            autoFocus
                          />

                          {showCustomerDropdown &&
                            searchCustomer.length >= 2 && (
                              <div className="absolute z-50 mt-2 w-full bg-white border-2 border-blue-300 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                                {searchingCustomer ? (
                                  <div className="p-6 text-center">
                                    <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
                                    <p className="text-sm text-gray-600 font-medium">
                                      Mencari customer...
                                    </p>
                                  </div>
                                ) : customerList.length > 0 ? (
                                  customerList.map((c) => (
                                    <button
                                      key={c.id}
                                      onClick={() => {
                                        setSelectedCustomer(c);
                                        setShowCustomerDropdown(false);
                                        setSearchCustomer("");
                                        setExpandCustomerSearch(false);
                                        fetchCustomerHutangInfo(c.id);
                                      }}
                                      className="w-full p-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 border-b last:border-b-0 transition-all duration-200 text-left group"
                                    >
                                      <p className="font-bold text-sm text-gray-900 group-hover:text-blue-700 flex items-center gap-2">
                                        <User className="w-3.5 h-3.5" />
                                        {c.nama}
                                      </p>
                                      <p className="text-xs text-gray-600 ml-5 mt-0.5">
                                        {c.namaToko} • {c.noHp}
                                      </p>
                                    </button>
                                  ))
                                ) : (
                                  <div className="p-6 text-center">
                                    <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500 font-medium">
                                      Tidak ada hasil
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                        </div>
                      )}

                      <button
                        onClick={() =>
                          setExpandCustomerSearch(!expandCustomerSearch)
                        }
                        className="w-full bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 text-blue-700 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 border-2 border-blue-200 hover:border-blue-300 hover:shadow-md active:scale-98"
                      >
                        <Search className="w-4 h-4" />
                        {expandCustomerSearch
                          ? "Tutup Pencarian"
                          : "Cari Customer Lainnya"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Sales Section - Enhanced Design */}
                <div className="p-4">
                  <label className="text-xs font-extrabold text-gray-800 mb-3 uppercase tracking-wider flex items-center gap-2">
                    <div className="bg-green-100 p-1.5 rounded-lg">
                      <Briefcase className="w-4 h-4 text-green-600" />
                    </div>
                    <span>
                      Sales <span className="text-red-500">*</span>
                    </span>
                  </label>

                  {selectedKaryawan ? (
                    <div className="bg-gradient-to-br from-green-500 to-green-600 p-3 rounded-lg shadow-md text-white border border-green-400 relative overflow-hidden group hover:shadow-lg transition-all">
                      <div className="relative flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate mb-1">
                            {selectedKaryawan.nama}
                          </p>
                          <div className="flex items-center gap-2.5 text-xs text-green-50">
                            <span className="truncate">
                              NIK: {selectedKaryawan.nik}
                            </span>
                            {selectedKaryawan.noHp && (
                              <>
                                <span className="text-green-300">•</span>
                                <span className="truncate flex items-center gap-1.5">
                                  <Phone className="w-3.5 h-3.5 shrink-0" />
                                  {selectedKaryawan.noHp}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedKaryawan(null);
                            setSearchKaryawan("");
                            setExpandKaryawanSearch(false);
                          }}
                          className="text-white hover:bg-white/20 p-1.5 rounded transition-all shrink-0 hover:scale-110 active:scale-95"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {!expandKaryawanSearch && (
                        <button
                          onClick={() => setExpandKaryawanSearch(true)}
                          className="w-full text-center py-3 px-4 bg-gray-50 hover:bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 hover:border-green-400 transition-all duration-200 group"
                        >
                          <p className="text-sm text-gray-600 group-hover:text-green-600 font-semibold flex items-center justify-center gap-2 transition-colors">
                            <Search className="w-4 h-4" />
                            Cari sales untuk memulai
                          </p>
                        </button>
                      )}

                      {expandKaryawanSearch && (
                        <div className="relative animate-in fade-in slide-in-from-top-2 duration-300">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 z-10" />
                          <input
                            type="text"
                            placeholder="Ketik nama sales..."
                            value={searchKaryawan}
                            onChange={(e) => {
                              setSearchKaryawan(e.target.value);
                              setShowKaryawanDropdown(true);
                            }}
                            className="w-full pl-10 pr-4 py-2.5 border-2 border-green-300 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 outline-none text-sm font-medium shadow-sm transition-all duration-200"
                            autoFocus
                          />

                          {showKaryawanDropdown &&
                            searchKaryawan.length >= 2 && (
                              <div className="absolute z-50 mt-2 w-full bg-white border-2 border-green-300 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                                {searchingKaryawan ? (
                                  <div className="p-6 text-center">
                                    <div className="animate-spin w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full mx-auto mb-3" />
                                    <p className="text-sm text-gray-600 font-medium">
                                      Mencari sales...
                                    </p>
                                  </div>
                                ) : karyawanList.length > 0 ? (
                                  karyawanList.map((k) => (
                                    <button
                                      key={k.id}
                                      onClick={() => {
                                        setSelectedKaryawan(k);
                                        setShowKaryawanDropdown(false);
                                        setSearchKaryawan("");
                                        setExpandKaryawanSearch(false);
                                      }}
                                      className="w-full p-3 hover:bg-gradient-to-r hover:from-green-50 hover:to-green-100 border-b last:border-b-0 transition-all duration-200 text-left group"
                                    >
                                      <p className="font-bold text-sm text-gray-900 group-hover:text-green-700 flex items-center gap-2">
                                        <Briefcase className="w-3.5 h-3.5" />
                                        {k.nama}
                                      </p>
                                      <p className="text-xs text-gray-600 ml-5 mt-0.5">
                                        NIK: {k.nik}
                                      </p>
                                    </button>
                                  ))
                                ) : (
                                  <div className="p-6 text-center">
                                    <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500 font-medium">
                                      Tidak ada hasil
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                        </div>
                      )}

                      <button
                        onClick={() =>
                          setExpandKaryawanSearch(!expandKaryawanSearch)
                        }
                        className="w-full bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 text-green-700 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 border-2 border-green-200 hover:border-green-300 hover:shadow-md active:scale-98"
                      >
                        <Search className="w-4 h-4" />
                        {expandKaryawanSearch
                          ? "Tutup Pencarian"
                          : "Cari Sales Lainnya"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Daftar Barang - Enhanced Interactive Design */}
            <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
              <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
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
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 z-10" />
                  <input
                    type="text"
                    placeholder="Cari produk..."
                    value={searchBarang}
                    onChange={(e) => setSearchBarang(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border-2 border-blue-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-medium shadow-sm transition-all duration-200"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50">
                <div className="grid grid-cols-2 gap-3">
                  {filteredBarang.map((barang) => {
                    const isLowStock = barang.stok < barang.jumlahPerKemasan;
                    const isOutOfStock = barang.stok <= 0;
                    const isMediumStock =
                      barang.stok >= barang.jumlahPerKemasan &&
                      barang.stok < barang.jumlahPerKemasan * 5;
                    const isInCart = currentPenjualan.items.some(
                      (item) => item.barangId === barang.id
                    );

                    // Hitung stok dalam kardus dan pcs
                    const stokDus = Math.floor(
                      Number(barang.stok) / Number(barang.jumlahPerKemasan)
                    );
                    const stokPcs =
                      Number(barang.stok) % Number(barang.jumlahPerKemasan);

                    // Hitung status limit penjualan
                    const hasLimit = barang.limitPenjualan > 0;
                    const todaySold = getTodaySold(barang.id);
                    const totalPcsInCart = getCartPcsForBarang(barang.id);
                    const totalDipakai = todaySold + totalPcsInCart;
                    const remainingLimit = hasLimit
                      ? Math.max(0, barang.limitPenjualan - totalDipakai)
                      : Infinity;
                    const isLimitReached = hasLimit && remainingLimit <= 0;
                    const isNearLimit =
                      hasLimit &&
                      !isLimitReached &&
                      remainingLimit <= barang.jumlahPerKemasan;

                    // Hitung sisa stok setelah dikurangi yang di keranjang
                    const sisaStok = barang.stok - totalPcsInCart;
                    const isStokHabis = sisaStok < barang.jumlahPerKemasan;

                    // Disable button jika stok tidak cukup untuk 1 kemasan ATAU limit tercapai
                    const isDisabled = isStokHabis || isLimitReached;

                    return (
                      <div
                        key={barang.id}
                        className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 transform hover:scale-[1.02] ${
                          isDisabled
                            ? "border-red-300 bg-gradient-to-br from-red-50 to-red-100/50 shadow-md"
                            : isNearLimit
                            ? "border-orange-300 bg-gradient-to-br from-orange-50 to-orange-100/50 shadow-md"
                            : "border-gray-200 bg-white hover:border-blue-400 hover:shadow-xl hover:shadow-blue-100/50"
                        }`}
                      >
                        {/* Gradient Overlay on Hover */}
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

                        {/* In Cart Indicator */}
                        {isInCart && (
                          <div className="absolute top-2 left-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-lg z-10 animate-in fade-in zoom-in duration-300">
                            <ShoppingCart className="w-2.5 h-2.5" />
                            Di Keranjang
                          </div>
                        )}

                        {/* Limit Reached Indicator */}
                        {isLimitReached && (
                          <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-lg z-10 animate-in fade-in zoom-in duration-300">
                            <AlertCircle className="w-2.5 h-2.5" />
                            Limit Tercapai
                          </div>
                        )}

                        <div className="relative flex items-center justify-between p-3">
                          {/* Left Side - Product Info */}
                          <div className="flex-1 min-w-0 pr-2">
                            {/* Product Name with Icon */}
                            <div className="flex items-start gap-1.5 mb-1.5">
                              <div className="bg-blue-100 p-1 rounded-lg mt-0.5 group-hover:bg-blue-200 transition-colors">
                                <Package className="w-3 h-3 text-blue-600" />
                              </div>
                              <h4 className="font-extrabold text-gray-900 text-xs leading-tight group-hover:text-blue-700 transition-colors">
                                {barang.namaBarang}
                              </h4>
                            </div>

                            {/* Product Details */}
                            <div className="ml-6 space-y-1">
                              <p className="text-[10px] text-gray-600 font-semibold flex items-center gap-1">
                                <span className="bg-gray-200 px-1.5 py-0.5 rounded-md">
                                  {formatGramsToKg(barang.berat)} KG
                                </span>
                                <span className="text-gray-400">•</span>
                                <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md">
                                  {barang.jumlahPerKemasan} pcs/
                                  {barang.jenisKemasan}
                                </span>
                              </p>

                              {/* Price */}
                              <div className="flex items-center gap-1.5">
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-0.5 rounded-lg shadow-md group-hover:shadow-lg transition-shadow">
                                  <p className="text-[11px] font-extrabold">
                                    {formatRupiah(barang.hargaJual)}
                                    <span className="text-[9px] font-medium opacity-90 ml-0.5">
                                      /{barang.jenisKemasan}
                                    </span>
                                  </p>
                                </div>

                                {/* Stock Badge */}
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-lg font-bold shadow-sm flex items-center gap-1 ${
                                    isLowStock
                                      ? "bg-red-500 text-white animate-pulse"
                                      : isMediumStock
                                      ? "bg-yellow-400 text-yellow-900"
                                      : "bg-green-500 text-white"
                                  }`}
                                >
                                  <div
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isLowStock
                                        ? "bg-white"
                                        : isMediumStock
                                        ? "bg-yellow-900"
                                        : "bg-white"
                                    }`}
                                  ></div>
                                  Stok: {stokDus}/{barang.jenisKemasan}
                                  {stokPcs > 0 &&
                                    ` ${stokPcs}/pcs`}
                                </span>
                              </div>

                              {/* Low Stock Warning */}
                              {isLowStock && (
                                <div className="flex items-center gap-1.5 text-red-600 animate-in slide-in-from-left duration-300">
                                  <AlertCircle className="w-3 h-3" />
                                  <span className="text-[10px] font-bold">
                                    {isOutOfStock
                                      ? "Stok Habis!"
                                      : "Stok Menipis!"}
                                  </span>
                                </div>
                              )}

                              {/* Limit Penjualan Info */}
                              {hasLimit && (
                                <div
                                  className={`flex items-center gap-1 mt-1 ${
                                    isLimitReached
                                      ? "text-red-600 animate-pulse"
                                      : isNearLimit
                                      ? "text-orange-600"
                                      : "text-blue-600"
                                  }`}
                                >
                                  <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded-lg border border-current/20 text-[10px] font-bold">
                                    <Percent className="w-3 h-3" />
                                    <span className="flex flex-wrap items-center gap-1">
                                      {(() => {
                                        const perDus =
                                          Number(barang.jumlahPerKemasan) || 1;
                                        const totalDipakai =
                                          todaySold + totalPcsInCart;
                                        const totalDusDipakai = Math.floor(
                                          totalDipakai / perDus
                                        );
                                        const sisa = Math.max(
                                          0,
                                          remainingLimit === Infinity
                                            ? 0
                                            : remainingLimit
                                        );
                                        const sisaDus = Math.floor(
                                          sisa / perDus
                                        );
                                        return (
                                          <>
                                            Terjual: {totalDipakai} item /{" "}
                                            {totalDusDipakai}
                                            Dus • Sisa limit {sisa} item /{" "}
                                            {sisaDus} Dus
                                          </>
                                        );
                                      })()}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Limit Reached Warning */}
                              {isLimitReached && (
                                <div className="flex items-center gap-1.5 text-red-600 animate-in slide-in-from-left duration-300">
                                  <AlertCircle className="w-3 h-3" />
                                  <span className="text-[10px] font-bold">
                                    Limit harian tercapai!
                                  </span>
                                </div>
                              )}

                              {/* Near Limit Warning */}
                              {isNearLimit && !isLimitReached && (
                                <div className="flex items-center gap-1.5 text-orange-600 animate-in slide-in-from-left duration-300">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  <span className="text-xs font-bold">
                                    Mendekati limit!
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right Side - Action Button */}
                          <div className="flex-shrink-0">
                            <button
                              onClick={() => handleAddItem(barang)}
                              disabled={isDisabled}
                              className={`relative overflow-hidden p-2 rounded-xl transition-all duration-300 transform ${
                                isDisabled
                                  ? "bg-gray-300 cursor-not-allowed opacity-50"
                                  : "bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl active:scale-95 group-hover:scale-110"
                              }`}
                            >
                              {/* Button Shine Effect */}
                              {!isDisabled && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                              )}

                              <Plus
                                className={`w-6 h-6 relative z-10 ${
                                  isDisabled ? "text-gray-500" : "text-white"
                                }`}
                                strokeWidth={3}
                              />

                              {/* Ripple Effect Container */}
                              <div className="absolute inset-0 rounded-xl overflow-hidden">
                                <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-500 rounded-full"></div>
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Bottom Border Accent */}
                        <div
                          className={`h-1 ${
                            isLowStock
                              ? "bg-gradient-to-r from-red-400 to-red-600"
                              : "bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          }`}
                        ></div>
                      </div>
                    );
                  })}

                  {/* Empty State */}
                  {filteredBarang.length === 0 && (
                    <div className="col-span-1 py-12 text-center">
                      <div className="bg-gray-100 p-6 rounded-full mb-4 mx-auto w-fit">
                        <Package className="w-16 h-16 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-bold text-lg mb-1">
                        Produk Tidak Ditemukan
                      </p>
                      <p className="text-gray-400 text-sm">
                        Coba kata kunci lain
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Keranjang */}
          <div className="w-[32%] flex flex-col h-full min-h-0">
            <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
              {/* Header Keranjang */}
              <div className="p-4 bg-gray-50 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-blue-600" />
                    <h2 className="text-sm font-bold text-gray-700">
                      Keranjang
                    </h2>
                  </div>
                  <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-md font-bold">
                    {currentPenjualan.items.length} item
                  </span>
                </div>
              </div>

              {/* Keranjang Items */}
              <div className="flex-1 overflow-y-auto p-3 min-h-0 bg-gray-50">
                {currentPenjualan.items.length > 0 ? (
                  <div className="space-y-2">
                    {currentPenjualan.items.map((item, index) => (
                      <div
                        key={index}
                        className="border border-gray-200 rounded-lg p-3 bg-white"
                      >
                        {/* Item Header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-extrabold text-gray-900 text-sm truncate mb-1">
                              {item.barang.namaBarang}
                            </h4>
                            <p className="text-xs text-gray-600 font-semibold truncate bg-gray-100 px-2 py-0.5 rounded-md inline-block">
                              {formatRupiah(getHargaJualPerDus(item))}/
                              {item.barang.jenisKemasan}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteItem(index)}
                            className="text-red-500 hover:bg-red-100 p-1.5 rounded-lg transition-all flex-shrink-0 ml-2 hover:scale-110 active:scale-95 shadow-sm hover:shadow-md"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Quantity Controls - Enhanced */}
                        <div className="space-y-2">
                          {/* Jika jumlahPerKemasan > 1, tampilkan kontrol terpisah */}
                          {item.barang.jumlahPerKemasan > 1 ? (
                            <>
                              {/* Kemasan */}
                              <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-purple-100 p-2 rounded-xl">
                                <span className="text-xs font-bold text-gray-700 uppercase">
                                  {item.barang.jenisKemasan}:
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() =>
                                      handleUpdateItemQuantity(
                                        index,
                                        "jumlahDus",
                                        item.jumlahDus - 1
                                      )
                                    }
                                    className="w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                                  >
                                    <Minus
                                      className="w-3.5 h-3.5"
                                      strokeWidth={3}
                                    />
                                  </button>
                                  <input
                                    type="number"
                                    value={item.jumlahDus}
                                    onChange={(e) =>
                                      handleUpdateItemQuantity(
                                        index,
                                        "jumlahDus",
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="w-12 text-center text-sm border-2 border-gray-300 rounded-lg px-1 py-1 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    min="0"
                                  />
                                  <button
                                    onClick={() =>
                                      handleUpdateItemQuantity(
                                        index,
                                        "jumlahDus",
                                        item.jumlahDus + 1
                                      )
                                    }
                                    className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                                  >
                                    <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                                  </button>
                                </div>
                              </div>

                              {/* Pcs */}
                              <div className="flex items-center justify-between bg-gradient-to-r from-orange-50 to-orange-100 p-2 rounded-xl">
                                <span className="text-xs font-bold text-gray-700 uppercase">
                                  Pcs:
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() =>
                                      handleUpdateItemQuantity(
                                        index,
                                        "jumlahPcs",
                                        item.jumlahPcs - 1
                                      )
                                    }
                                    className="w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                                  >
                                    <Minus
                                      className="w-3.5 h-3.5"
                                      strokeWidth={3}
                                    />
                                  </button>
                                  <input
                                    type="number"
                                    value={item.jumlahPcs}
                                    onChange={(e) =>
                                      handleUpdateItemQuantity(
                                        index,
                                        "jumlahPcs",
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="w-12 text-center text-sm border-2 border-gray-300 rounded-lg px-1 py-1 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    min="0"
                                    max={item.barang.jumlahPerKemasan - 1}
                                  />
                                  <button
                                    onClick={() =>
                                      handleUpdateItemQuantity(
                                        index,
                                        "jumlahPcs",
                                        item.jumlahPcs + 1
                                      )
                                    }
                                    className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                                  >
                                    <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                                  </button>
                                </div>
                              </div>
                            </>
                          ) : (
                            /* Jika jumlahPerKemasan = 1, hanya tampilkan kontrol per item */
                            <div className="flex items-center justify-between bg-gradient-to-r from-orange-50 to-orange-100 p-2 rounded-xl">
                              <span className="text-xs font-bold text-gray-700 uppercase">
                                Item:
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() =>
                                    handleUpdateItemQuantity(
                                      index,
                                      "jumlahPcs",
                                      item.jumlahPcs - 1
                                    )
                                  }
                                  className="w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                                >
                                  <Minus
                                    className="w-3.5 h-3.5"
                                    strokeWidth={3}
                                  />
                                </button>
                                <input
                                  type="number"
                                  value={item.jumlahPcs}
                                  onChange={(e) =>
                                    handleUpdateItemQuantity(
                                      index,
                                      "jumlahPcs",
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className="w-12 text-center text-sm border-2 border-gray-300 rounded-lg px-1 py-1 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                  min="0"
                                />
                                <button
                                  onClick={() =>
                                    handleUpdateItemQuantity(
                                      index,
                                      "jumlahPcs",
                                      item.jumlahPcs + 1
                                    )
                                  }
                                  className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                                >
                                  <Plus className="w-3.5 h-3.5" strokeWidth={3} />
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Diskon */}
                          <div className="flex items-center justify-between bg-gradient-to-r from-yellow-50 to-amber-50 p-2.5 rounded-xl border-2 border-yellow-200">
                            <span className="text-xs font-bold text-gray-700 uppercase">
                              Diskon:
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleItemDiskonType(index)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold shadow-md transition-all hover:scale-105 active:scale-95 ${
                                  (itemDiskonTypes[index] || "rupiah") ===
                                  "rupiah"
                                    ? "bg-green-500 text-white"
                                    : "bg-purple-500 text-white"
                                }`}
                              >
                                {(itemDiskonTypes[index] || "rupiah") ===
                                "rupiah"
                                  ? "Rp"
                                  : "%"}
                              </button>
                              <input
                                type="text"
                                value={getItemDiskonDisplayValue(index)}
                                onChange={(e) =>
                                  handleItemDiskonChange(
                                    index,
                                    e.target.value,
                                    itemDiskonTypes[index] || "rupiah"
                                  )
                                }
                                className="w-20 text-right text-xs border-2 border-yellow-300 rounded-lg px-2 py-1 font-bold bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all"
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Subtotal */}
                        <div className="flex items-center justify-between pt-2.5 border-t-2 border-blue-300 mt-2.5 bg-blue-50 -mx-3 -mb-3 px-3 py-2.5 rounded-b-2xl">
                          <span className="text-sm font-extrabold text-gray-800 uppercase">
                            Total:
                          </span>
                          <p className="font-extrabold text-blue-600 text-base">
                            {formatRupiah(item.hargaJual)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="bg-gray-100 p-4 rounded-full mb-3 mx-auto w-fit">
                        <ShoppingCart className="w-12 h-12 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">
                        Keranjang masih kosong
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        Tambahkan produk untuk memulai
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary & Checkout */}
              {currentPenjualan.items.length > 0 && (
                <div className="border-t border-gray-200 bg-white p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-bold text-gray-900">
                        {formatRupiah(currentPenjualan.subtotal)}
                      </span>
                    </div>

                    {totalDiskonItem > 0 && (
                      <div className="flex justify-between text-sm text-red-600">
                        <span>Diskon Item</span>
                        <span className="font-bold">
                          -{formatRupiah(totalDiskonItem)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-2">
                      <span className="text-gray-700 font-medium">
                        Diskon Nota
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleDiskonNotaType}
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            diskonNotaType === "rupiah"
                              ? "bg-green-500 text-white"
                              : "bg-purple-500 text-white"
                          }`}
                        >
                          {diskonNotaType === "rupiah" ? "Rp" : "%"}
                        </button>
                        <input
                          type="text"
                          value={diskonNota}
                          onChange={(e) =>
                            handleDiskonNotaChange(e.target.value)
                          }
                          className="w-16 text-right border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center font-bold text-base border-t-2 border-gray-200 pt-2 mt-2">
                      <span className="text-gray-900">TOTAL</span>
                      <span className="text-blue-600 text-lg">
                        {formatRupiah(currentPenjualan.totalHarga)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (!selectedCustomer) {
                        toast.error("Customer wajib dipilih!");
                        return;
                      }
                      if (!selectedKaryawan) {
                        toast.error("Sales wajib dipilih!");
                        return;
                      }

                      setShowCheckoutModal(true);
                    }}
                    disabled={currentPenjualan.items.length === 0}
                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                  >
                    <CreditCard className="w-5 h-5" />
                    {editPenjualanId ? "Simpan Perubahan" : "Bayar Sekarang"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-slate-700 p-5 rounded-t-2xl">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 p-2 rounded-lg">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold">Konfirmasi Pembayaran</h3>
                </div>
                <button
                  onClick={handleCloseCheckoutModal}
                  className="text-white hover:bg-white/10 p-1.5 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Customer & Sales Info */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-slate-100 p-1.5 rounded-lg">
                      <User className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 font-medium">
                        Customer
                      </p>
                      <p className="font-semibold text-gray-800 text-sm">
                        {selectedCustomer?.nama}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="bg-slate-100 p-1.5 rounded-lg">
                      <Briefcase className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 font-medium">Sales</p>
                      <p className="font-semibold text-gray-800 text-sm">
                        {selectedKaryawan?.nama}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-slate-600" />
                  Ringkasan Transaksi
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold text-gray-800">
                      {formatRupiah(currentPenjualan.subtotal)}
                    </span>
                  </div>
                  {totalDiskonItem > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Diskon Item</span>
                      <span className="font-semibold">
                        -{formatRupiah(totalDiskonItem)}
                      </span>
                    </div>
                  )}
                  {currentPenjualan.diskonNota > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Diskon Nota</span>
                      <span className="font-semibold">
                        -{formatRupiah(currentPenjualan.diskonNota)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200 text-base">
                    <span className="font-bold text-gray-900">Total Bayar</span>
                    <span className="font-bold text-slate-700">
                      {formatRupiah(currentPenjualan.totalHarga)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tanggal Penjualan */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  Tanggal Penjualan
                </label>
                <input
                  type="date"
                  value={tanggalPenjualan}
                  onChange={(e) => setTanggalPenjualan(e.target.value)}
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none text-sm font-semibold transition-all"
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-600" />
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    onClick={() => handleMetodePembayaranChange("CASH")}
                    className={`p-3 rounded-lg border transition-all font-semibold text-sm flex items-center justify-center gap-2 ${
                      currentPenjualan.metodePembayaran === "CASH"
                        ? "bg-slate-700 text-white border-slate-700"
                        : "bg-white text-gray-600 border-gray-300 hover:border-slate-400"
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    Cash
                  </button>
                  <button
                    onClick={() => handleMetodePembayaranChange("TRANSFER")}
                    className={`p-3 rounded-lg border transition-all font-semibold text-sm flex items-center justify-center gap-2 ${
                      currentPenjualan.metodePembayaran === "TRANSFER"
                        ? "bg-slate-700 text-white border-slate-700"
                        : "bg-white text-gray-600 border-gray-300 hover:border-slate-400"
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    Transfer
                  </button>
                  <button
                    onClick={() =>
                      handleMetodePembayaranChange("CASH_TRANSFER")
                    }
                    className={`p-3 rounded-lg border transition-all font-semibold text-sm flex items-center justify-center gap-2 ${
                      currentPenjualan.metodePembayaran === "CASH_TRANSFER"
                        ? "bg-slate-700 text-white border-slate-700"
                        : "bg-white text-gray-600 border-gray-300 hover:border-slate-400"
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    Cash + Transfer
                  </button>
                </div>
              </div>

              {/* Jumlah Dibayar */}
              <div className="space-y-2.5">
                {/* Payment Amount */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-slate-600" />
                    {currentPenjualan.metodePembayaran === "CASH_TRANSFER"
                      ? "Jumlah Pembayaran"
                      : "Jumlah Dibayar"}
                  </label>
                  {currentPenjualan.metodePembayaran === "CASH_TRANSFER" ? (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">
                            Rp
                          </span>
                          <input
                            type="text"
                            value={jumlahCash}
                            onChange={(e) => {
                              const formatted = formatRupiahInput(
                                e.target.value
                              );
                              setJumlahCash(formatted);
                              updatePembayaranFromJumlah(
                                parseRupiahToNumber(formatted) +
                                  parseRupiahToNumber(jumlahTransfer)
                              );
                            }}
                            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none text-sm font-semibold transition-all"
                            placeholder="Jumlah Cash"
                          />
                        </div>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">
                            Rp
                          </span>
                          <input
                            type="text"
                            value={jumlahTransfer}
                            onChange={(e) => {
                              const formatted = formatRupiahInput(
                                e.target.value
                              );
                              setJumlahTransfer(formatted);
                              updatePembayaranFromJumlah(
                                parseRupiahToNumber(jumlahCash) +
                                  parseRupiahToNumber(formatted)
                              );
                            }}
                            className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none text-sm font-semibold transition-all"
                            placeholder="Jumlah Transfer"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 font-medium">
                        Total dibayar: {formatRupiah(getEffectiveJumlahDibayar())}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">
                          Rp
                        </span>
                        <input
                          type="text"
                          value={jumlahDibayar}
                          onChange={(e) => {
                            const formatted = formatRupiahInput(e.target.value);
                            setJumlahDibayar(formatted);
                            updatePembayaranFromJumlah(
                              parseRupiahToNumber(formatted)
                            );
                          }}
                          className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none text-sm font-semibold transition-all"
                          placeholder="0"
                        />
                      </div>
                      {/* Payment Suggestions */}
                      <div className="flex gap-2">
                        {[
                          { label: "Semua", percent: 100 },
                          { label: "70%", percent: 70 },
                          { label: "50%", percent: 50 },
                          { label: "30%", percent: 30 },
                        ].map((suggestion) => (
                          <button
                            key={suggestion.percent}
                            onClick={() => {
                              const amount = Math.round(
                                (currentPenjualan.totalHarga *
                                  suggestion.percent) /
                                  100
                              );
                              setJumlahByNumber(
                                setJumlahDibayar,
                                amount
                              );
                              updatePembayaranFromJumlah(amount);
                            }}
                            className="flex-1 px-2 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors border border-slate-200 hover:border-slate-300"
                          >
                            {suggestion.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Rute Pengiriman */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-600" />
                  Rute Pengiriman
                </label>
                <input
                  type="text"
                  value={rutePengiriman}
                  onChange={(e) => setRutePengiriman(e.target.value)}
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none text-sm font-semibold transition-all"
                  placeholder="Contoh: Jakarta - Bandung"
                />
              </div>

              {/* Payment Status */}
              {paymentStatus && (
                <div
                  className={`p-3.5 rounded-lg border ${
                    paymentStatus.status === "LUNAS"
                      ? "bg-green-50 border-green-200"
                      : "bg-amber-50 border-amber-200"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600">
                        Status Pembayaran
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-md font-bold text-xs ${
                          paymentStatus.status === "LUNAS"
                            ? "bg-green-600 text-white"
                            : "bg-amber-500 text-white"
                        }`}
                      >
                        {paymentStatus.status}
                      </span>
                    </div>
                    {paymentStatus.status === "LUNAS" ? (
                      <div className="flex items-center justify-between pt-2 border-t border-green-200">
                        <span className="text-sm font-semibold text-gray-700">
                          Kembalian
                        </span>
                        <span className="font-bold text-green-700 text-base">
                          {formatRupiah(paymentStatus.kembalian)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-2 border-t border-amber-200">
                        <span className="text-sm font-semibold text-gray-700">
                          Sisa Hutang
                        </span>
                        <span className="font-bold text-amber-700 text-base">
                          {formatRupiah(paymentStatus.sisaHutang)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Due Date for Hutang */}
              {paymentStatus?.status === "HUTANG" && (
                <div className="space-y-2.5">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-600" />
                    Tanggal Jatuh Tempo
                  </label>
                  <input
                    type="date"
                    value={tanggalJatuhTempo}
                    onChange={(e) => setTanggalJatuhTempo(e.target.value)}
                    className="w-full px-3.5 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none text-sm font-semibold transition-all"
                  />
                </div>
              )}

              {/* Keterangan */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-slate-600" />
                  Keterangan
                </label>
                <textarea
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none text-sm font-semibold transition-all resize-none"
                  placeholder="Catatan transaksi (opsional)"
                  rows={3}
                />
              </div>

              {/* Error Message */}
              {paymentStatus?.message && (
                <div className="bg-red-50 border border-red-200 p-3.5 rounded-lg">
                  <div className="flex items-center gap-2.5 text-red-700">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <p className="text-sm font-semibold">
                      {paymentStatus.message}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-gray-50 border-t border-gray-200 rounded-b-2xl space-y-2.5">
              <button
                onClick={handleCheckout}
                disabled={loading || !paymentStatus?.canCheckout}
                className="w-full bg-slate-700 hover:bg-slate-800 disabled:bg-gray-300 text-white py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editPenjualanId ? "Simpan Perubahan" : "Konfirmasi Pembayaran"}
                  </>
                )}
              </button>
              <button
                onClick={handleCloseCheckoutModal}
                disabled={loading}
                className="w-full bg-white hover:bg-gray-50 text-gray-700 py-2.5 rounded-lg font-semibold text-sm transition-all border border-gray-300 hover:border-gray-400"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal - Enhanced */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
            {/* Success Header */}
            <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 p-8 rounded-t-3xl text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50"></div>
              <div className="relative">
                <div className="bg-white w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-xl">
                  <Check className="w-12 h-12 text-green-500" strokeWidth={3} />
                </div>
                <h3 className="text-2xl font-extrabold text-white mb-2 drop-shadow-md">
                  Transaksi Berhasil!
                </h3>
                <p className="text-green-100 text-sm font-medium">
                  {receiptData.kodePenjualan}
                </p>
              </div>
            </div>

            {/* Receipt Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Transaction Info */}
                <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 p-4 rounded-2xl border-2 border-gray-200 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-semibold">No Nota</span>
                    <span className="font-bold text-gray-900">
                      {receiptData.kodePenjualan}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-semibold">Customer</span>
                    <span className="font-bold text-gray-900">
                      {receiptData.customer?.nama}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-semibold">Sales</span>
                    <span className="font-bold text-gray-900">
                      {receiptData.karyawan?.nama}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-semibold">Metode</span>
                    <span className="font-bold text-gray-900">
                      {formatMetodePembayaranLabel(receiptData.metodePembayaran)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-semibold">Status</span>
                    <span
                      className={`px-3 py-1 rounded-lg font-extrabold text-xs ${
                        receiptData.statusPembayaran === "LUNAS"
                          ? "bg-green-500 text-white"
                          : "bg-yellow-500 text-white"
                      }`}
                    >
                      {receiptData.statusPembayaran}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto">
                    {receiptData.items?.map((item: any, index: number) => (
                      <div
                        key={index}
                        className="text-sm pb-2 border-b last:border-b-0"
                      >
                        {(() => {
                          const jumlahPerKemasan =
                            item.barang?.jumlahPerKemasan || 1;
                          const totalItem =
                            item.totalItem ??
                            item.jumlahDus * jumlahPerKemasan + item.jumlahPcs;
                          const { jumlahDus, jumlahPcs } = deriveDusPcsFromTotal(
                            totalItem,
                            jumlahPerKemasan
                          );
                          return (
                            <>
                              <div className="flex justify-between font-bold text-gray-900">
                                <span>{item.barang?.namaBarang}</span>
                                <span>{formatRupiah(item.hargaJual)}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {jumlahDus} dus + {jumlahPcs} pcs
                                {item.diskonPerItem > 0 && (
                                  <span className="text-red-600 ml-2">
                                    (Diskon: {formatRupiah(item.diskonPerItem)})
                                  </span>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-2xl border-2 border-blue-200 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 font-semibold">Subtotal</span>
                  <span className="font-bold text-gray-900">
                    {formatRupiah(receiptData.subtotal)}
                  </span>
                </div>
                {receiptData.diskonNota > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span className="font-semibold">Diskon Nota</span>
                    <span className="font-bold">
                      -{formatRupiah(receiptData.diskonNota)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 border-t-2 border-blue-300 text-lg">
                  <span className="font-extrabold text-gray-900">TOTAL</span>
                  <span className="font-extrabold text-blue-600">
                    {formatRupiah(receiptData.totalHarga)}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-blue-200">
                  <span className="text-gray-700 font-semibold">Dibayar</span>
                  <span className="font-bold text-gray-900">
                    {formatRupiah(receiptData.jumlahDibayar)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700 font-semibold">Kembalian</span>
                  <span className="font-bold text-green-600">
                    {formatRupiah(receiptData.kembalian)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 bg-gray-50 border-t-2 border-gray-200 rounded-b-3xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => {
                  window.open(`/api/penjualan/${receiptData.id}/print-receipt`, '_blank');
                }}
                className="w-full bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 hover:from-green-700 hover:via-emerald-700 hover:to-green-800 text-white py-4 rounded-2xl font-extrabold text-base transition-all flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl active:scale-98"
              >
                <Receipt className="w-5 h-5" />
                CETAK NOTA
              </button>
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  handleReset();
                }}
                className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:via-indigo-700 hover:to-blue-800 text-white py-4 rounded-2xl font-extrabold text-base transition-all flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl active:scale-98"
              >
                <ShoppingCart className="w-5 h-5" />
                TRANSAKSI BARU
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PenjualanPage;
