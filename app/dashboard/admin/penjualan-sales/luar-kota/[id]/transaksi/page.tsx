"use client";
import { useState, useEffect } from "react";
import {
  ShoppingCart,
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  User,
  Check,
  Package,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Search,
  Building2,
  Phone,
  CreditCard,
  Receipt,
  Banknote,
  X,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface ManifestBarang {
  id: number;
  barangId: number;
  barang: {
    id: number;
    namaBarang: string;
    satuan: string;
    jumlahPerKemasan: number;
    hargaJual: number;
    hargaBeli: number;
    ukuran: number;
    jenisKemasan: string;
  };
  totalItem: string;
}

interface PerjalananDetail {
  id: number;
  kodePerjalanan: string;
  karyawan: {
    id: number;
    nama: string;
  };
  statusPerjalanan: string;
  manifestBarang: ManifestBarang[];
}

interface Customer {
  id: number;
  nama: string;
  namaToko: string;
  alamat: string;
  noHp: string;
  limit_piutang?: number;
  piutang?: number;
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

interface TransaksiItem {
  barangId: number;
  jumlahDus: number;
  jumlahPcs: number;
  hargaJual: number;
  diskonPerItem: number;
  barang: ManifestBarang["barang"];
}

const InputTransaksiPage = () => {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [perjalanan, setPerjalanan] = useState<PerjalananDetail | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [searchCustomer, setSearchCustomer] = useState("");
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [expandCustomerSearch, setExpandCustomerSearch] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);

  const [newCustomer, setNewCustomer] = useState({
    nik: "",
    nama: "",
    namaToko: "",
    alamat: "",
    noHp: "",
    limitPiutang: 0,
    piutangAwal: 0,
  });
  const [items, setItems] = useState<TransaksiItem[]>([]);
  const [metodePembayaran, setMetodePembayaran] = useState<
    "TUNAI" | "TRANSFER"
  >("TUNAI");
  const [tanggalTransaksi, setTanggalTransaksi] = useState("");
  const [tanggalJatuhTempo, setTanggalJatuhTempo] = useState("");
  const [diskonNota, setDiskonNota] = useState(0);
  const [diskonNotaType, setDiskonNotaType] = useState<"rupiah" | "persen">(
    "rupiah"
  );
  const [diskonNotaValue, setDiskonNotaValue] = useState("0");
  const [itemDiskonTypes, setItemDiskonTypes] = useState<{
    [key: number]: "rupiah" | "persen";
  }>({});
  const [itemDiskonValues, setItemDiskonValues] = useState<{
    [key: number]: string;
  }>({});
  const [jumlahDibayar, setJumlahDibayar] = useState("");
  const [keterangan, setKeterangan] = useState("");

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [customerHutangInfo, setCustomerHutangInfo] =
    useState<CustomerHutangInfo | null>(null);
  const [loadingHutangInfo, setLoadingHutangInfo] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPerjalananDetail();
      fetchCustomers();
      const today = new Date().toISOString().split("T")[0];
      setTanggalTransaksi(today);
    }
  }, [id]);

  useEffect(() => {
    // Reset tanggal jatuh tempo jika pembayaran lunas
    const bayar = parseRupiahToNumber(jumlahDibayar);
    const total = calculateSubtotal() - diskonNota;

    if (bayar >= total && tanggalJatuhTempo) {
      setTanggalJatuhTempo("");
    }
  }, [jumlahDibayar, diskonNota, items]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchCustomer.trim().length >= 2) {
        searchCustomerByKeyword(searchCustomer);
      } else if (searchCustomer.trim().length === 0) {
        setCustomers([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchCustomer]);

  const fetchPerjalananDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/penjualan-luar-kota/${id}`);
      const data = await res.json();
      if (data.success) {
        setPerjalanan(data.data);
      } else {
        toast.error("Gagal mengambil detail perjalanan");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/customer?limit=100");
      const data = await res.json();
      if (data.data) {
        setCustomers(data.data);
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
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
        setCustomers(data.data);
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

  const handleAddItem = (manifest: ManifestBarang) => {
    const existing = items.find((item) => item.barangId === manifest.barangId);
    if (existing) {
      toast.error("Barang sudah ditambahkan");
      return;
    }

    setItems([
      ...items,
      {
        barangId: manifest.barangId,
        jumlahDus: 0,
        jumlahPcs: 0,
        hargaJual: parseInt(manifest.barang.hargaJual.toString()),
        diskonPerItem: 0,
        barang: manifest.barang,
      },
    ]);
    toast.success(`${manifest.barang.namaBarang} ditambahkan`);
  };

  const handleUpdateItem = (
    barangId: number,
    field: keyof TransaksiItem,
    value: number
  ) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.barangId !== barangId) return item;

        const nextItem = { ...item, [field]: Math.max(0, value) };

        if (field !== "jumlahDus" && field !== "jumlahPcs") {
          return nextItem;
        }

        const manifest = perjalanan?.manifestBarang.find(
          (m) => m.barangId === barangId
        );

        if (!manifest) return nextItem;

        const jumlahPerDus = Number(manifest.barang.jumlahPerKemasan) || 0;
        const maxTotalPcs = Number(manifest.totalItem); // totalItem adalah stok tersisa

        const totalPcs = nextItem.jumlahDus * jumlahPerDus + nextItem.jumlahPcs;

        if (totalPcs > maxTotalPcs) {
          const maxDus = jumlahPerDus
            ? Math.floor(maxTotalPcs / jumlahPerDus)
            : 0;
          const remainingPcs = maxTotalPcs - maxDus * jumlahPerDus;

          return {
            ...nextItem,
            jumlahDus: maxDus,
            jumlahPcs: remainingPcs,
          };
        }

        return nextItem;
      })
    );
  };

  const handleRemoveItem = (barangId: number) => {
    setItems(items.filter((item) => item.barangId !== barangId));

    // Reset diskon type dan value untuk item yang dihapus
    setItemDiskonTypes((prev) => {
      const newTypes = { ...prev };
      delete newTypes[barangId];
      return newTypes;
    });
    setItemDiskonValues((prev) => {
      const newValues = { ...prev };
      delete newValues[barangId];
      return newValues;
    });
  };

  const calculateSubtotal = () => {
    return items.reduce((total, item) => {
      const manifest = perjalanan?.manifestBarang.find(
        (m) => m.barangId === item.barangId
      );
      if (!manifest) return total;

      const totalPcs =
        item.jumlahDus * parseInt(manifest.barang.jumlahPerKemasan.toString()) +
        item.jumlahPcs;
      const itemTotal = totalPcs * item.hargaJual - item.diskonPerItem;
      return total + itemTotal;
    }, 0);
  };

  const handleDiskonNotaChange = (value: string, type: "rupiah" | "persen") => {
    setDiskonNotaValue(value);

    const subtotal = calculateSubtotal();

    let diskonRupiah: number;
    if (type === "persen") {
      const persen = parseInt(value) || 0;
      diskonRupiah = Math.round((subtotal * persen) / 100);
    } else {
      const numericValue = value.replace(/[^\d]/g, "");
      diskonRupiah = parseInt(numericValue) || 0;
    }

    setDiskonNota(diskonRupiah);
  };

  const toggleDiskonNotaType = () => {
    const newType = diskonNotaType === "rupiah" ? "persen" : "rupiah";
    const subtotal = calculateSubtotal();

    if (newType === "persen") {
      const persen =
        subtotal > 0 ? Math.round((diskonNota / subtotal) * 100) : 0;
      setDiskonNotaValue(persen.toString());
    } else {
      setDiskonNotaValue(
        diskonNota === 0 ? "0" : diskonNota.toLocaleString("id-ID")
      );
    }

    setDiskonNotaType(newType);
  };

  const getDiskonNotaDisplayValue = (): string => {
    if (diskonNotaType === "persen") {
      const subtotal = calculateSubtotal();
      const persen =
        subtotal > 0 ? Math.round((diskonNota / subtotal) * 100) : 0;
      return persen.toString();
    } else {
      return diskonNota === 0 ? "0" : diskonNota.toLocaleString("id-ID");
    }
  };

  const hasItemsWithQuantity = () => {
    return items.some((item) => item.jumlahDus > 0 || item.jumlahPcs > 0);
  };

  const handleItemDiskonChange = (
    barangId: number,
    value: string,
    type: "rupiah" | "persen"
  ) => {
    setItemDiskonValues((prev) => ({ ...prev, [barangId]: value }));

    const item = items.find((i) => i.barangId === barangId);
    if (!item) return;

    const manifest = perjalanan?.manifestBarang.find(
      (m) => m.barangId === barangId
    );
    if (!manifest) return;

    let diskonRupiah: number;
    if (type === "persen") {
      const persen = parseInt(value) || 0;
      const hargaPerDus = Number(manifest.barang.hargaJual);
      diskonRupiah = Math.round((hargaPerDus * persen) / 100);
    } else {
      const numericValue = value.replace(/[^\d]/g, "");
      diskonRupiah = parseInt(numericValue) || 0;
    }

    setItems((prevItems) =>
      prevItems.map((i) =>
        i.barangId === barangId ? { ...i, diskonPerItem: diskonRupiah } : i
      )
    );
  };

  const toggleItemDiskonType = (barangId: number) => {
    const currentType = itemDiskonTypes[barangId] || "rupiah";
    const newType = currentType === "rupiah" ? "persen" : "rupiah";

    setItemDiskonTypes((prev) => ({ ...prev, [barangId]: newType }));

    const item = items.find((i) => i.barangId === barangId);
    if (!item) return;

    const manifest = perjalanan?.manifestBarang.find(
      (m) => m.barangId === barangId
    );
    if (!manifest) return;

    if (newType === "persen") {
      const hargaPerDus = Number(manifest.barang.hargaJual);
      const persen =
        hargaPerDus > 0
          ? Math.round((item.diskonPerItem / hargaPerDus) * 100)
          : 0;
      setItemDiskonValues((prev) => ({
        ...prev,
        [barangId]: persen.toString(),
      }));
    } else {
      setItemDiskonValues((prev) => ({
        ...prev,
        [barangId]:
          item.diskonPerItem === 0
            ? "0"
            : item.diskonPerItem.toLocaleString("id-ID"),
      }));
    }
  };

  const getItemDiskonDisplayValue = (barangId: number): string => {
    const item = items.find((i) => i.barangId === barangId);
    if (!item) return "0";

    const storedValue = itemDiskonValues[barangId];
    if (storedValue !== undefined) return storedValue;

    const type = itemDiskonTypes[barangId] || "rupiah";

    if (type === "persen") {
      const manifest = perjalanan?.manifestBarang.find(
        (m) => m.barangId === barangId
      );
      if (!manifest) return "0";

      const hargaPerDus = Number(manifest.barang.hargaJual);
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

  const getPaymentStatus = () => {
    const bayar = parseRupiahToNumber(jumlahDibayar);
    const total = calculateSubtotal() - diskonNota;

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

      // Set default tanggal jatuh tempo 30 hari dari sekarang jika belum diset
      if (!tanggalJatuhTempo) {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        setTanggalJatuhTempo(date.toISOString().split("T")[0]);
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

  const handleOpenCheckoutModal = async () => {
    if (items.length === 0) {
      toast.error("Tambahkan minimal 1 barang");
      return;
    }

    if (!hasItemsWithQuantity()) {
      toast.error("Atur jumlah barang (dus/pcs tidak boleh semua 0)");
      return;
    }

    if (!selectedCustomer && !newCustomer.nama) {
      toast.error("Pilih customer atau isi data customer baru");
      return;
    }

    setShowCheckoutModal(true);
  };

  const handleCloseCheckoutModal = () => {
    setShowCheckoutModal(false);
  };

  const handleCheckout = async () => {
    const subtotal = calculateSubtotal();
    const total = subtotal - diskonNota;
    const dibayar = parseRupiahToNumber(jumlahDibayar);

    // Validasi customer baru tidak bisa hutang
    if (!selectedCustomer && newCustomer.nama && dibayar < total) {
      toast.error(
        "Customer baru tidak dapat melakukan transaksi hutang. Silakan bayar lunas atau tambahkan customer melalui Master Data terlebih dahulu.",
        { duration: 5000 }
      );
      return;
    }

    if (dibayar < total && !tanggalJatuhTempo) {
      toast.error("Tanggal jatuh tempo wajib diisi untuk pembayaran hutang");
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        items: items.map((item) => ({
          barangId: item.barangId,
          jumlahDus: item.jumlahDus,
          jumlahPcs: item.jumlahPcs,
          hargaJual: item.hargaJual,
          diskonPerItem: item.diskonPerItem,
        })),
        metodePembayaran,
        statusPembayaran: dibayar >= total ? "LUNAS" : "HUTANG",
        tanggalTransaksi,
        diskonNota,
        jumlahDibayar: dibayar,
        keterangan,
      };

      if (dibayar < total) {
        payload.tanggalJatuhTempo = tanggalJatuhTempo;
      }

      if (selectedCustomer) {
        payload.customerId = selectedCustomer.id;
      } else {
        payload.nik = newCustomer.nik;
        payload.namaCustomer = newCustomer.nama;
        payload.namaToko = newCustomer.namaToko;
        payload.alamat = newCustomer.alamat;
        payload.noHp = newCustomer.noHp;
        payload.limitPiutang = 0; // Customer baru selalu 0
        payload.piutangAwal = 0; // Customer baru selalu 0
      }

      const res = await fetch(`/api/penjualan-luar-kota/${id}/transaksi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Transaksi berhasil disimpan");
        setShowCheckoutModal(false);
        setReceiptData(data.data);
        setShowReceiptModal(true);
      } else {
        toast.error(data.message || "Gagal menyimpan transaksi");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <div className="animate-spin w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (
    !perjalanan ||
    !["KEMBALI", "DI_PERJALANAN"].includes(perjalanan.statusPerjalanan)
  ) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">
            {!perjalanan
              ? "Perjalanan tidak ditemukan"
              : "Transaksi hanya bisa diinput saat status KEMBALI atau DI_PERJALANAN"}
          </p>
          <Link
            href={`/dashboard/admin/penjualan-sales/luar-kota/${id}`}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold"
          >
            Kembali
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = calculateSubtotal();
  const total = subtotal - diskonNota;
  const paymentStatus = jumlahDibayar ? getPaymentStatus() : null;

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
          success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
          error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
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
                  Input Transaksi Penjualan
                </h1>
                <div className="flex items-center gap-3 mt-1 text-sm text-blue-100">
                  <span className="font-semibold">
                    {perjalanan.kodePerjalanan}
                  </span>
                  <span>•</span>
                  <span>{perjalanan.karyawan.nama}</span>
                </div>
              </div>
            </div>
            <Link
              href={`/dashboard/admin/penjualan-sales/luar-kota/${id}`}
              className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-semibold shadow-lg text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        <div className="h-full min-h-0 flex gap-3">
          {/* Left Side - 68% */}
          <div className="w-[68%] flex flex-col gap-3 h-full min-h-0">
            {/* Customer Selection */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200">
              <div className="p-4">
                <label className="text-xs font-extrabold text-gray-800 mb-3 uppercase tracking-wider flex items-center gap-2">
                  <div className="bg-blue-100 p-1.5 rounded-lg">
                    <User className="w-4 h-4 text-blue-600" />
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
                          <Trash2 className="w-4 h-4" />
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

                        {showCustomerDropdown && searchCustomer.length >= 2 && (
                          <div className="absolute z-50 mt-2 w-full bg-white border-2 border-blue-300 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                            {searchingCustomer ? (
                              <div className="p-6 text-center">
                                <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
                                <p className="text-sm text-gray-600 font-medium">
                                  Mencari customer...
                                </p>
                              </div>
                            ) : customers.length > 0 ? (
                              customers.map((c) => (
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

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() =>
                          setExpandCustomerSearch(!expandCustomerSearch)
                        }
                        className="w-full bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 text-blue-700 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 border-2 border-blue-200 hover:border-blue-300 hover:shadow-md active:scale-98"
                      >
                        <Search className="w-4 h-4" />
                        {expandCustomerSearch
                          ? "Tutup Pencarian"
                          : "Cari Customer"}
                      </button>
                      <button
                        onClick={() => {
                          setShowNewCustomerForm(!showNewCustomerForm);
                          if (!showNewCustomerForm) {
                            setExpandCustomerSearch(false);
                          }
                        }}
                        className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 border-2 active:scale-98 ${
                          showNewCustomerForm
                            ? "bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 text-red-700 border-red-200 hover:border-red-300"
                            : "bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 text-green-700 border-green-200 hover:border-green-300 hover:shadow-md"
                        }`}
                      >
                        <User className="w-4 h-4" />
                        {showNewCustomerForm
                          ? "Tutup Form"
                          : "Customer Baru"}
                      </button>
                    </div>

                    {!selectedCustomer && showNewCustomerForm && (
                      <div className="pt-3 border-t-2 border-gray-200 animate-in fade-in slide-in-from-top-2 duration-300">
                        <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-2">
                          <User className="w-4 h-4 text-green-600" />
                          Buat Customer Baru:
                        </p>
                        <div className="space-y-2">
                          <input
                            placeholder="Masukkan NIK (16 digit) *"
                            value={newCustomer.nik}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "");
                              if (value.length <= 16) {
                                setNewCustomer({
                                  ...newCustomer,
                                  nik: value,
                                });
                              }
                            }}
                            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                            maxLength={16}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              placeholder="Masukkan nama lengkap *"
                              value={newCustomer.nama}
                              onChange={(e) =>
                                setNewCustomer({
                                  ...newCustomer,
                                  nama: e.target.value,
                                })
                              }
                              className="px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                            />
                            <input
                              placeholder="Masukkan nama toko *"
                              value={newCustomer.namaToko}
                              onChange={(e) =>
                                setNewCustomer({
                                  ...newCustomer,
                                  namaToko: e.target.value,
                                })
                              }
                              className="px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                            />
                          </div>
                          <textarea
                            placeholder="Masukkan alamat lengkap *"
                            value={newCustomer.alamat}
                            onChange={(e) =>
                              setNewCustomer({
                                ...newCustomer,
                                alamat: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                            rows={3}
                          />
                          <input
                            placeholder="Contoh: 081234567890 *"
                            value={newCustomer.noHp}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "");
                              setNewCustomer({
                                ...newCustomer,
                                noHp: value,
                              });
                            }}
                            className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Daftar Barang */}
            <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
              <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
                <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <div className="bg-blue-600 p-1.5 rounded-lg shadow-md">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  Barang Dibawa
                  <span className="ml-auto text-xs bg-blue-600 text-white px-2.5 py-1 rounded-full font-bold">
                    {perjalanan.manifestBarang.length} produk
                  </span>
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-gradient-to-br from-gray-50 via-blue-50/20 to-gray-50">
                <div className="grid grid-cols-3 gap-3">
                  {perjalanan.manifestBarang.map((m) => {
                    const isInCart = items.some(
                      (item) => item.barangId === m.barangId
                    );

                    // Hitung jumlah dus dan pcs dari totalItem
                    const totalItemPcs = Number(m.totalItem);
                    const jumlahPerDus = Number(m.barang.jumlahPerKemasan);
                    const displayDus =
                      jumlahPerDus > 0
                        ? Math.floor(totalItemPcs / jumlahPerDus)
                        : 0;
                    const displayPcs =
                      jumlahPerDus > 0
                        ? totalItemPcs % jumlahPerDus
                        : totalItemPcs;

                    return (
                      <div
                        key={m.id}
                        className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 transform hover:scale-[1.02] ${
                          isInCart
                            ? "border-green-400 bg-gradient-to-br from-green-50 to-emerald-100/50 shadow-md shadow-green-100/50"
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

                        <div className="relative p-3">
                          {/* Product Name with Icon */}
                          <div className="flex items-start gap-1.5 mb-2">
                            <div className="bg-blue-100 p-1 rounded-lg mt-0.5 group-hover:bg-blue-200 transition-colors flex-shrink-0">
                              <Package className="w-3 h-3 text-blue-600" />
                            </div>
                            <h4 className="font-extrabold text-gray-900 text-xs leading-tight group-hover:text-blue-700 transition-colors line-clamp-2">
                              {m.barang.namaBarang}
                            </h4>
                          </div>

                          {/* Product Details */}
                          <div className="space-y-1.5 mb-3">
                            {/* Ukuran & Kemasan */}
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="bg-gray-200 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-gray-700">
                                {m.barang.ukuran} {m.barang.satuan}
                              </span>
                              <span className="text-gray-400 text-[10px]">
                                •
                              </span>
                              <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
                                {m.barang.jumlahPerKemasan} pcs/
                                {m.barang.jenisKemasan}
                              </span>
                            </div>

                            {/* Price */}
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-1 rounded-lg shadow-md group-hover:shadow-lg transition-shadow inline-block">
                              <p className="text-[11px] font-extrabold">
                                {formatRupiah(Number(m.barang?.hargaJual ?? 0))}
                                <span className="text-[9px] font-medium opacity-90 ml-0.5">
                                  /{m.barang.jenisKemasan}
                                </span>
                              </p>
                            </div>

                            {/* Dibawa Info */}
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-2 py-1.5 rounded-lg border border-blue-200">
                              <p className="text-[10px] font-bold text-blue-700">
                                Sisa Manifest: {displayDus}{" "}
                                {m.barang.jenisKemasan}
                                {displayPcs > 0
                                  ? ` & ${displayPcs} ${m.barang.satuan}`
                                  : ""}
                              </p>
                              <p className="text-[10px] font-bold text-blue-600 mt-0.5">
                                Total: {totalItemPcs} pcs
                              </p>
                            </div>
                          </div>

                          {/* Action Button */}
                          <button
                            onClick={() => handleAddItem(m)}
                            disabled={isInCart}
                            className={`relative overflow-hidden w-full py-2 rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 font-bold text-xs ${
                              isInCart
                                ? "bg-green-200 text-green-700 cursor-not-allowed"
                                : "bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl active:scale-95"
                            }`}
                          >
                            {/* Button Shine Effect */}
                            {!isInCart && (
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                            )}

                            <Plus
                              className={`w-4 h-4 relative z-10 ${
                                isInCart ? "text-green-700" : "text-white"
                              }`}
                              strokeWidth={3}
                            />
                            <span className="relative z-10">
                              {isInCart ? "Ditambahkan" : "Tambah"}
                            </span>
                          </button>
                        </div>

                        {/* Bottom Border Accent */}
                        <div
                          className={`h-1 ${
                            isInCart
                              ? "bg-gradient-to-r from-green-400 to-emerald-600"
                              : "bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          }`}
                        ></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Keranjang - 32% */}
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
                    {items.length} item
                  </span>
                </div>
              </div>

              {/* Keranjang Items */}
              <div className="flex-1 overflow-y-auto p-3 min-h-0 bg-gray-50">
                {items.length > 0 ? (
                  <div className="space-y-2">
                    {items.map((item) => {
                      const m = perjalanan.manifestBarang.find(
                        (x) => x.barangId === item.barangId
                      );
                      if (!m) return null;
                      const jumlahPerDus =
                        Number(m.barang.jumlahPerKemasan) || 0;
                      const manifestTotalPcs = Number(m.totalItem);
                      const currentTotalPcs =
                        item.jumlahDus * jumlahPerDus + item.jumlahPcs;
                      const canAddDus =
                        jumlahPerDus > 0 &&
                        currentTotalPcs + jumlahPerDus <= manifestTotalPcs;
                      const canAddPcs = currentTotalPcs + 1 <= manifestTotalPcs;

                      const itemTotal =
                        currentTotalPcs * item.hargaJual - item.diskonPerItem;

                      return (
                        <div
                          key={item.barangId}
                          className="border border-gray-200 rounded-lg p-3 bg-white"
                        >
                          {/* Item Header */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-extrabold text-gray-900 text-sm truncate mb-1">
                                {m.barang.namaBarang}
                              </h4>
                              <p className="text-xs text-gray-600 font-semibold truncate bg-gray-100 px-2 py-0.5 rounded-md inline-block">
                                {formatRupiah(item.hargaJual)}/
                                {m.barang.jenisKemasan}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRemoveItem(item.barangId)}
                              className="text-red-500 hover:bg-red-100 p-1.5 rounded-lg transition-all flex-shrink-0 ml-2 hover:scale-110 active:scale-95 shadow-sm hover:shadow-md"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Quantity Controls */}
                          <div className="space-y-2">
                            {/* Jika jumlahPerKemasan > 1, tampilkan kontrol terpisah */}
                            {m.barang.jumlahPerKemasan > 1 ? (
                              <>
                                {/* Kemasan */}
                                <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-purple-100 p-2 rounded-xl">
                                  <span className="text-xs font-bold text-gray-700 uppercase">
                                    {m.barang.jenisKemasan}:
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() =>
                                        handleUpdateItem(
                                          item.barangId,
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
                                        handleUpdateItem(
                                          item.barangId,
                                          "jumlahDus",
                                          parseInt(e.target.value) || 0
                                        )
                                      }
                                      className="w-12 text-center text-sm border-2 border-gray-300 rounded-lg px-1 py-1 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                      min="0"
                                    />
                                    <button
                                      onClick={() =>
                                        handleUpdateItem(
                                          item.barangId,
                                          "jumlahDus",
                                          item.jumlahDus + 1
                                        )
                                      }
                                      disabled={!canAddDus}
                                      className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                                    >
                                      <Plus
                                        className="w-3.5 h-3.5"
                                        strokeWidth={3}
                                      />
                                    </button>
                                  </div>
                                </div>

                                {/* Pcs */}
                                <div className="flex items-center justify-between bg-gradient-to-r from-orange-50 to-orange-100 p-2 rounded-xl">
                                  <span className="text-xs font-bold text-gray-700 uppercase">
                                    {m.barang.satuan}:
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() =>
                                        handleUpdateItem(
                                          item.barangId,
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
                                        handleUpdateItem(
                                          item.barangId,
                                          "jumlahPcs",
                                          parseInt(e.target.value) || 0
                                        )
                                      }
                                      className="w-12 text-center text-sm border-2 border-gray-300 rounded-lg px-1 py-1 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                      min="0"
                                    />
                                    <button
                                      onClick={() =>
                                        handleUpdateItem(
                                          item.barangId,
                                          "jumlahPcs",
                                          item.jumlahPcs + 1
                                        )
                                      }
                                      disabled={!canAddPcs}
                                      className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                                    >
                                      <Plus
                                        className="w-3.5 h-3.5"
                                        strokeWidth={3}
                                      />
                                    </button>
                                  </div>
                                </div>
                              </>
                            ) : (
                              /* Jika jumlahPerKemasan = 1, tampilkan hanya kontrol pcs */
                              <div className="flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 p-2 rounded-xl">
                                <span className="text-xs font-bold text-gray-700 uppercase">
                                  {m.barang.satuan}:
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() =>
                                      handleUpdateItem(
                                        item.barangId,
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
                                      handleUpdateItem(
                                        item.barangId,
                                        "jumlahPcs",
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="w-12 text-center text-sm border-2 border-gray-300 rounded-lg px-1 py-1 font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    min="0"
                                  />
                                  <button
                                    onClick={() =>
                                      handleUpdateItem(
                                        item.barangId,
                                        "jumlahPcs",
                                        item.jumlahPcs + 1
                                      )
                                    }
                                    disabled={!canAddPcs}
                                    className="w-7 h-7 rounded-lg bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all active:scale-95"
                                  >
                                    <Plus
                                      className="w-3.5 h-3.5"
                                      strokeWidth={3}
                                    />
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
                                  onClick={() =>
                                    toggleItemDiskonType(item.barangId)
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold shadow-md transition-all hover:scale-105 active:scale-95 ${
                                    (itemDiskonTypes[item.barangId] ||
                                      "rupiah") === "rupiah"
                                      ? "bg-green-500 text-white"
                                      : "bg-purple-500 text-white"
                                  }`}
                                >
                                  {(itemDiskonTypes[item.barangId] ||
                                    "rupiah") === "rupiah"
                                    ? "Rp"
                                    : "%"}
                                </button>
                                <input
                                  type="text"
                                  value={getItemDiskonDisplayValue(
                                    item.barangId
                                  )}
                                  onChange={(e) =>
                                    handleItemDiskonChange(
                                      item.barangId,
                                      e.target.value,
                                      itemDiskonTypes[item.barangId] || "rupiah"
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
                              {formatRupiah(itemTotal)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
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
              {items.length > 0 && (
                <div className="border-t border-gray-200 bg-white p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-bold text-gray-900">
                        {formatRupiah(subtotal)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-2">
                      <span className="text-gray-700 font-medium">
                        Diskon Nota
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleDiskonNotaType}
                          className={`px-2.5 py-1 rounded-lg text-xs font-extrabold shadow-md transition-all hover:scale-105 active:scale-95 ${
                            diskonNotaType === "rupiah"
                              ? "bg-green-500 text-white"
                              : "bg-purple-500 text-white"
                          }`}
                        >
                          {diskonNotaType === "rupiah" ? "Rp" : "%"}
                        </button>
                        <input
                          type="text"
                          value={getDiskonNotaDisplayValue()}
                          onChange={(e) =>
                            handleDiskonNotaChange(
                              e.target.value,
                              diskonNotaType
                            )
                          }
                          className="w-20 text-right text-xs border-2 border-gray-300 rounded-lg px-2 py-1 font-bold bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center font-bold text-base border-t-2 border-gray-200 pt-2 mt-2">
                      <span className="text-gray-900">TOTAL</span>
                      <span className="text-blue-600 text-lg">
                        {formatRupiah(total)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleOpenCheckoutModal}
                    disabled={
                      items.length === 0 ||
                      !hasItemsWithQuantity() ||
                      (!selectedCustomer && !newCustomer.nama)
                    }
                    className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                  >
                    <CreditCard className="w-5 h-5" />
                    {!hasItemsWithQuantity() && items.length > 0
                      ? "Atur Jumlah Barang"
                      : !selectedCustomer && !newCustomer.nama
                      ? "Pilih Customer"
                      : "Bayar Sekarang"}
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
                        {selectedCustomer?.nama || newCustomer.nama}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="bg-slate-100 p-1.5 rounded-lg">
                      <Building2 className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 font-medium">Sales</p>
                      <p className="font-semibold text-gray-800 text-sm">
                        {perjalanan.karyawan.nama}
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
                      {formatRupiah(subtotal)}
                    </span>
                  </div>
                  {diskonNota > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Diskon Nota</span>
                      <span className="font-semibold">
                        -{formatRupiah(diskonNota)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200 text-base">
                    <span className="font-bold text-gray-900">Total Bayar</span>
                    <span className="font-bold text-slate-700">
                      {formatRupiah(total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tanggal Transaksi */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  Tanggal Transaksi
                </label>
                <input
                  type="date"
                  value={tanggalTransaksi}
                  onChange={(e) => setTanggalTransaksi(e.target.value)}
                  className="w-full px-3.5 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none text-sm font-semibold transition-all"
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-600" />
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setMetodePembayaran("TUNAI")}
                    className={`p-3 rounded-lg border transition-all font-semibold text-sm flex items-center justify-center gap-2 ${
                      metodePembayaran === "TUNAI"
                        ? "bg-slate-700 text-white border-slate-700"
                        : "bg-white text-gray-600 border-gray-300 hover:border-slate-400"
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    Tunai
                  </button>
                  <button
                    onClick={() => setMetodePembayaran("TRANSFER")}
                    className={`p-3 rounded-lg border transition-all font-semibold text-sm flex items-center justify-center gap-2 ${
                      metodePembayaran === "TRANSFER"
                        ? "bg-slate-700 text-white border-slate-700"
                        : "bg-white text-gray-600 border-gray-300 hover:border-slate-400"
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    Transfer
                  </button>
                </div>
              </div>

              {/* Jumlah Dibayar */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-slate-600" />
                  Jumlah Dibayar
                </label>
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
                          (total * suggestion.percent) / 100
                        );
                        const formatted = amount.toLocaleString("id-ID");
                        setJumlahDibayar(formatted);
                      }}
                      className="flex-1 px-2 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors border border-slate-200 hover:border-slate-300"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Status */}
              {paymentStatus && (
                <div>
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

                  {/* Warning untuk customer baru yang hutang */}
                  {!selectedCustomer &&
                    newCustomer.nama &&
                    paymentStatus.status === "HUTANG" && (
                      <div className="mt-3 p-3.5 rounded-lg border-2 border-red-300 bg-red-50 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-start gap-2.5">
                          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-bold text-red-800 mb-1">
                              Customer Baru Tidak Dapat Hutang
                            </p>
                            <p className="text-xs text-red-700 leading-relaxed">
                              Customer yang baru dibuat tidak memiliki limit
                              piutang. Silakan{" "}
                              <strong>bayar lunas (100%)</strong> atau tambahkan
                              customer melalui{" "}
                              <strong>Menu Master Data Customer</strong> terlebih
                              dahulu untuk mendapatkan limit piutang.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
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
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-gray-50 border-t border-gray-200 rounded-b-2xl space-y-2.5">
              <button
                onClick={handleCheckout}
                disabled={
                  submitting ||
                  !paymentStatus?.canCheckout ||
                  (!selectedCustomer &&
                    !!newCustomer.nama &&
                    paymentStatus?.status === "HUTANG")
                }
                className="w-full bg-slate-700 hover:bg-slate-800 disabled:bg-gray-300 text-white py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {!selectedCustomer &&
                    !!newCustomer.nama &&
                    paymentStatus?.status === "HUTANG"
                      ? "Customer Baru Tidak Dapat Hutang"
                      : "Konfirmasi Pembayaran"}
                  </>
                )}
              </button>
              <button
                onClick={handleCloseCheckoutModal}
                disabled={submitting}
                className="w-full bg-white hover:bg-gray-50 text-gray-700 py-2.5 rounded-lg font-semibold text-sm transition-all border border-gray-300 hover:border-gray-400"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
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
                    {receiptData.customer?.nama || receiptData.namaCustomer}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-semibold">Sales</span>
                  <span className="font-bold text-gray-900">
                    {receiptData.karyawan?.nama || perjalanan?.karyawan?.nama}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-semibold">Metode</span>
                  <span className="font-bold text-gray-900">
                    {receiptData.metodePembayaran}
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
                <h4 className="font-extrabold text-gray-900 text-sm uppercase tracking-wide">
                  Detail Pembelian
                </h4>
                <div className="bg-white border-2 border-gray-200 rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto">
                  {receiptData.items?.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="text-sm pb-2 border-b last:border-b-0"
                    >
                      <div className="flex justify-between font-bold text-gray-900">
                        <span>{item.barang?.namaBarang}</span>
                        <span>{formatRupiah(item.hargaJual)}</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {item.jumlahDus} dus + {item.jumlahPcs} pcs
                        {item.diskonPerItem > 0 && (
                          <span className="text-red-600 ml-2">
                            (Diskon: {formatRupiah(item.diskonPerItem)})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
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
            <div className="p-6 bg-gray-50 border-t-2 border-gray-200 rounded-b-3xl space-y-3">
              <button
                onClick={() => {
                  window.open(
                    `/api/penjualan/${receiptData.id}/print-receipt`,
                    "_blank"
                  );
                }}
                className="w-full bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 hover:from-green-700 hover:via-emerald-700 hover:to-green-800 text-white py-4 rounded-2xl font-extrabold text-base transition-all flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl active:scale-98"
              >
                <Receipt className="w-5 h-5" />
                CETAK NOTA
              </button>
              <button
                onClick={() => {
                  router.push(`/dashboard/admin/penjualan-sales/kanvas`);
                }}
                className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:via-indigo-700 hover:to-blue-800 text-white py-4 rounded-2xl font-extrabold text-base transition-all flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl active:scale-98"
              >
                <ShoppingCart className="w-5 h-5" />
                KEMBALI KE KANVAS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InputTransaksiPage;
