"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Search,
  Menu,
  X,
  Star,
  Truck,
  Shield,
  Clock,
  ChevronRight,
  Minus,
  Plus,
  Trash2,
  User,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

// --- Types ---
type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
  rating: number;
  color: string;
  icon: React.ReactNode;
};

type CartItem = Product & { quantity: number };

// --- Animated SVG Icons (Flat Design) ---
const RiceIcon = () => (
  <svg viewBox="0 0 200 200" className="w-full h-full">
    <rect x="40" y="120" width="120" height="60" rx="8" fill="#F5F5DC" />
    <rect x="50" y="110" width="100" height="20" rx="4" fill="#8B4513" />
    <path
      d="M60 110 L60 90 Q60 70 100 70 Q140 70 140 90 L140 110"
      fill="#F5F5DC"
      stroke="#E0E0E0"
      strokeWidth="2"
    />
    <circle cx="70" cy="100" r="3" fill="#D2691E" opacity="0.5" />
    <circle cx="90" cy="95" r="3" fill="#D2691E" opacity="0.5" />
    <circle cx="110" cy="98" r="3" fill="#D2691E" opacity="0.5" />
    <circle cx="130" cy="102" r="3" fill="#D2691E" opacity="0.5" />
    <text
      x="100"
      y="155"
      textAnchor="middle"
      fontSize="14"
      fill="#8B4513"
      fontWeight="bold"
    >
      BERAS
    </text>
  </svg>
);

const SugarIcon = () => (
  <svg viewBox="0 0 200 200" className="w-full h-full">
    <rect
      x="50"
      y="60"
      width="100"
      height="100"
      rx="12"
      fill="#FFFFFF"
      stroke="#E0E0E0"
      strokeWidth="3"
    />
    <rect x="60" y="50" width="80" height="20" rx="4" fill="#FF6B6B" />
    <text
      x="100"
      y="120"
      textAnchor="middle"
      fontSize="14"
      fill="#666"
      fontWeight="bold"
    >
      GULA
    </text>
    <text x="100" y="140" textAnchor="middle" fontSize="12" fill="#999">
      PASIR
    </text>
    <circle cx="70" cy="80" r="2" fill="#EEE" />
    <circle cx="130" cy="90" r="2" fill="#EEE" />
    <circle cx="90" cy="100" r="2" fill="#EEE" />
    <circle cx="110" cy="85" r="2" fill="#EEE" />
  </svg>
);

const OilIcon = () => (
  <svg viewBox="0 0 200 200" className="w-full h-full">
    <rect
      x="60"
      y="40"
      width="80"
      height="120"
      rx="15"
      fill="#FFD700"
      opacity="0.3"
    />
    <rect
      x="60"
      y="40"
      width="80"
      height="120"
      rx="15"
      fill="none"
      stroke="#FFA500"
      strokeWidth="4"
    />
    <rect x="75" y="30" width="50" height="15" rx="4" fill="#FF8C00" />
    <path
      d="M70 60 Q100 80 130 60 L130 140 Q100 160 70 140 Z"
      fill="#FFD700"
      opacity="0.8"
    />
    <text
      x="100"
      y="110"
      textAnchor="middle"
      fontSize="14"
      fill="#B8860B"
      fontWeight="bold"
    >
      MINYAK
    </text>
    <text x="100" y="130" textAnchor="middle" fontSize="12" fill="#DAA520">
      GORENG
    </text>
  </svg>
);

const NoodleIcon = () => (
  <svg viewBox="0 0 200 200" className="w-full h-full">
    <rect x="40" y="80" width="120" height="80" rx="8" fill="#FF6347" />
    <rect x="50" y="70" width="100" height="15" rx="3" fill="#CD5C5C" />
    <rect x="55" y="90" width="90" height="60" rx="4" fill="#FFE4E1" />
    <path
      d="M70 100 Q80 120 70 140"
      stroke="#FFD700"
      strokeWidth="4"
      fill="none"
    />
    <path
      d="M85 100 Q95 120 85 140"
      stroke="#FFD700"
      strokeWidth="4"
      fill="none"
    />
    <path
      d="M100 100 Q110 120 100 140"
      stroke="#FFD700"
      strokeWidth="4"
      fill="none"
    />
    <path
      d="M115 100 Q125 120 115 140"
      stroke="#FFD700"
      strokeWidth="4"
      fill="none"
    />
    <path
      d="M130 100 Q140 120 130 140"
      stroke="#FFD700"
      strokeWidth="4"
      fill="none"
    />
    <text
      x="100"
      y="165"
      textAnchor="middle"
      fontSize="14"
      fill="#FFF"
      fontWeight="bold"
    >
      MIE INSTAN
    </text>
  </svg>
);

// --- Data ---
const products: Product[] = [
  {
    id: 1,
    name: "Beras Premium",
    category: "Beras",
    price: 65000,
    unit: "5kg",
    rating: 4.8,
    color: "bg-amber-100",
    icon: <RiceIcon />,
  },
  {
    id: 2,
    name: "Gula Pasir",
    category: "Gula",
    price: 15000,
    unit: "1kg",
    rating: 4.9,
    color: "bg-red-50",
    icon: <SugarIcon />,
  },
  {
    id: 3,
    name: "Minyak Goreng",
    category: "Minyak",
    price: 28000,
    unit: "2L",
    rating: 4.7,
    color: "bg-yellow-50",
    icon: <OilIcon />,
  },
  {
    id: 4,
    name: "Mie Instan",
    category: "Mie",
    price: 120000,
    unit: "1 dus (40pcs)",
    rating: 4.9,
    color: "bg-orange-50",
    icon: <NoodleIcon />,
  },
  {
    id: 5,
    name: "Beras Medium",
    category: "Beras",
    price: 55000,
    unit: "5kg",
    rating: 4.5,
    color: "bg-amber-100",
    icon: <RiceIcon />,
  },
  {
    id: 6,
    name: "Minyak Goreng Premium",
    category: "Minyak",
    price: 45000,
    unit: "2L",
    rating: 4.8,
    color: "bg-yellow-50",
    icon: <OilIcon />,
  },
  {
    id: 7,
    name: "Gula Merah",
    category: "Gula",
    price: 18000,
    unit: "1kg",
    rating: 4.6,
    color: "bg-red-50",
    icon: <SugarIcon />,
  },
  {
    id: 8,
    name: "Mie Instan Premium",
    category: "Mie",
    price: 150000,
    unit: "1 dus (40pcs)",
    rating: 4.7,
    color: "bg-orange-50",
    icon: <NoodleIcon />,
  },
];

// --- Components ---
export default function LandingPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");

  // Login form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isTwoFA, setIsTwoFA] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const categories = ["Semua", "Beras", "Gula", "Minyak", "Mie"];

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      selectedCategory === "Semua" || product.category === selectedCategory;
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  function getRedirectPath(role?: string) {
    switch (role?.toLowerCase()) {
      case "admin":
        return "/dashboard/admin";
      case "kasir":
        return "/dashboard/kasir";
      case "kepala_gudang":
        return "/dashboard/kepala_gudang";
      case "sales":
        return "/dashboard/sales";
      default:
        return "/dashboard";
    }
  }

  const closeModal = () => {
    setIsLoginModalOpen(false);
    setIsTwoFA(false);
    setOtpCode("");
    setLoginError("");
    setUsername("");
    setPassword("");
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === productId) {
          const newQuantity = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      }),
    );
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        if (data?.twoFARequired) {
          setIsTwoFA(true); // tambah state ini
          setLoginError("");
        } else {
          setIsLoggedIn(true);
          closeModal();
          setUsername("");
          setPassword("");
          router.push(getRedirectPath(data?.user?.role));
        }
      } else {
        setLoginError(data?.error || "Username atau password salah");
      }
    } catch {
      setLoginError("Gagal menghubungi server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);

    try {
      const res = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpCode }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setIsLoggedIn(true);
        closeModal();
        setIsTwoFA(false);
        setOtpCode("");
        router.push(getRedirectPath(data?.user?.role));
      } else {
        setLoginError(data?.error || "Kode OTP salah");
      }
    } catch {
      setLoginError("Gagal menghubungi server");
    } finally {
      setIsVerifying(false);
    }
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const formatPrice = (price: number): string => {
    const rounded = Math.round(price);
    return "Rp" + rounded.toLocaleString("id-ID");
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">A</span>
              </div>
              <span className="text-xl font-bold text-gray-800">AwSembako</span>
            </div>

            {/* Desktop Search */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari produk..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                />
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-4">
              {/* Login Button / User Profile */}
              {isLoggedIn ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsCartOpen(true)}
                    className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <ShoppingCart className="w-6 h-6 text-gray-700" />
                    {totalItems > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {totalItems}
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-purple-600" />
                    </div>
                    <span className="hidden md:block text-sm font-medium text-gray-700">
                      Admin
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition-colors shadow-lg shadow-purple-600/30"
                >
                  <User className="w-5 h-5" />
                  <span className="hidden sm:inline">Masuk</span>
                </button>
              )}

              <button
                className="md:hidden p-2 hover:bg-gray-100 rounded-full"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <div className="px-4 py-3 space-y-3">
              <input
                type="text"
                placeholder="Cari produk..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              {!isLoggedIn && (
                <button
                  onClick={() => {
                    setIsLoginModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full py-3 bg-purple-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <User className="w-5 h-5" />
                  Masuk ke Akun
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-600 to-violet-700 text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
                <span className="w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></span>
                Gratis Ongkir untuk pembelian pertama
              </div>
              <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                Kebutuhan Pokok
                <br />
                <span className="text-yellow-300">Berkualitas</span> &
                Terjangkau
              </h1>
              <p className="text-lg text-purple-100 max-w-lg">
                Dapatkan beras, gula, minyak, dan mie instan terbaik dengan
                harga pasar. Pengiriman cepat ke seluruh wilayah Sarolangun.
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="px-8 py-4 bg-white text-purple-600 rounded-full font-bold hover:bg-gray-100 transition-colors shadow-lg">
                  Belanja Sekarang
                </button>
                <button className="px-8 py-4 bg-purple-800 text-white rounded-full font-bold hover:bg-purple-900 transition-colors border border-purple-700">
                  Lihat Katalog
                </button>
              </div>

              <div className="flex items-center gap-8 pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">10k+</div>
                  <div className="text-sm text-purple-200">Pelanggan</div>
                </div>
                <div className="w-px h-10 bg-purple-400"></div>
                <div className="text-center">
                  <div className="text-2xl font-bold">4.9</div>
                  <div className="text-sm text-purple-200">Rating</div>
                </div>
                <div className="w-px h-10 bg-purple-400"></div>
                <div className="text-center">
                  <div className="text-2xl font-bold">2jam</div>
                  <div className="text-sm text-purple-200">Pengiriman</div>
                </div>
              </div>
            </div>

            <div className="hidden md:block">
              <div className="relative">
                <div className="absolute inset-0 bg-white/10 rounded-3xl transform rotate-3"></div>
                <div className="relative bg-white rounded-3xl p-8 shadow-2xl">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-amber-100 rounded-2xl p-4 aspect-square">
                      <RiceIcon />
                    </div>
                    <div className="bg-red-50 rounded-2xl p-4 aspect-square mt-8">
                      <SugarIcon />
                    </div>
                    <div className="bg-yellow-50 rounded-2xl p-4 aspect-square -mt-8">
                      <OilIcon />
                    </div>
                    <div className="bg-orange-50 rounded-2xl p-4 aspect-square">
                      <NoodleIcon />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-center gap-4 p-6 rounded-2xl bg-gray-50 hover:bg-purple-50 transition-colors">
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
                <Truck className="w-7 h-7 text-purple-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Pengiriman Cepat</h3>
                <p className="text-sm text-gray-600">
                  2 jam sampai untuk area kota
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-6 rounded-2xl bg-gray-50 hover:bg-blue-50 transition-colors">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                <Shield className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Jaminan Kualitas</h3>
                <p className="text-sm text-gray-600">
                  Produk fresh dan berkualitas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-6 rounded-2xl bg-gray-50 hover:bg-pink-50 transition-colors">
              <div className="w-14 h-14 bg-pink-100 rounded-xl flex items-center justify-center">
                <Clock className="w-7 h-7 text-pink-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Buka 24 Jam</h3>
                <p className="text-sm text-gray-600">Pesan kapan saja</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            Produk Unggulan
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Pilih dari berbagai kebutuhan pokok berkualitas dengan harga terbaik
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                selectedCategory === category
                  ? "bg-purple-600 text-white shadow-lg transform scale-105"
                  : "bg-white text-gray-700 border border-gray-200 hover:border-purple-500 hover:text-purple-600"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div
                className={`${product.color} p-6 aspect-square relative overflow-hidden`}
              >
                <div className="w-full h-full transform group-hover:scale-110 transition-transform duration-300">
                  {product.icon}
                </div>
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-gray-700 shadow-sm">
                  {product.unit}
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-1 mb-2">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium text-gray-600">
                    {product.rating}
                  </span>
                </div>

                <h3 className="font-bold text-gray-800 text-lg mb-1">
                  {product.name}
                </h3>
                <p className="text-sm text-gray-500 mb-4">{product.category}</p>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 line-through">
                      {formatPrice(product.price * 1.2)}
                    </p>
                    <p className="text-xl font-bold text-purple-600">
                      {formatPrice(product.price)}
                    </p>
                  </div>

                  <button
                    onClick={() => addToCart(product)}
                    className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-600/30 active:scale-95"
                  >
                    <ShoppingCart className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              Produk tidak ditemukan
            </h3>
            <p className="text-gray-600">Coba cari dengan kata kunci lain</p>
          </div>
        )}
      </section>

      {/* Promo Banner */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 text-center md:text-left">
              <span className="inline-block bg-white/20 px-4 py-1 rounded-full text-sm font-medium">
                Promo Spesial
              </span>
              <h2 className="text-3xl md:text-4xl font-bold">
                Diskon 20% untuk
                <br />
                Pembelian Pertama
              </h2>
              <p className="text-purple-100">Gunakan kode: SEMBAKO20</p>
            </div>
            <button className="px-8 py-4 bg-white text-purple-600 rounded-full font-bold hover:bg-gray-100 transition-colors shadow-xl whitespace-nowrap">
              Klaim Sekarang
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">A</span>
                </div>
                <span className="text-lg font-bold text-gray-800">
                  AwSembako
                </span>
              </div>
              <p className="text-gray-600 text-sm">
                Solusi terbaik untuk kebutuhan pokok keluarga Anda. Kualitas
                terjamin, harga bersahabat.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-gray-800 mb-4">Kategori</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <a href="#" className="hover:text-purple-600">
                    Beras
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-purple-600">
                    Gula
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-purple-600">
                    Minyak Goreng
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-purple-600">
                    Mie Instan
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-gray-800 mb-4">Layanan</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <a href="#" className="hover:text-purple-600">
                    Cara Pemesanan
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-purple-600">
                    Pengiriman
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-purple-600">
                    Pengembalian
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-purple-600">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-gray-800 mb-4">Kontak</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>WhatsApp: 0812-3456-7890</li>
                <li>Email: halo@awsembako.id</li>
                <li>Jl. Sembako No. 123, Jakarta</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500">
              © 2024 AwSembako. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-gray-500">
              <a href="#" className="hover:text-gray-800">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-gray-800">
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => closeModal()}
          />

          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
            {/* Header */}
            <div className="bg-gradient-to-br from-purple-600 to-violet-700 p-8 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full opacity-10">
                <div className="absolute top-10 left-10 w-20 h-20 bg-white rounded-full"></div>
                <div className="absolute bottom-10 right-10 w-32 h-32 bg-white rounded-full"></div>
              </div>

              <button
                onClick={() => closeModal()}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="relative z-10">
                <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
                  <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-xl">A</span>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Selamat Datang
                </h2>
                <p className="text-purple-100 text-sm">
                  Masuk untuk melanjutkan belanja
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="p-8">
              {!isTwoFA ? (
                <form onSubmit={handleLogin} className="space-y-5">
                  {/* Username Field */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 block">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <User className="w-5 h-5" />
                      </div>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Masukkan username"
                        className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 block">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <Lock className="w-5 h-5" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Masukkan password"
                        className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Error Message */}
                  {loginError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
                      {loginError}
                    </div>
                  )}

                  {/* Remember & Forgot */}
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-gray-600">Ingat saya</span>
                    </label>
                    <a
                      href="#"
                      className="text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Lupa password?
                    </a>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-600/30 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Memuat...
                      </>
                    ) : (
                      "Masuk"
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerify2FA} className="space-y-5">
                  <p className="text-gray-600 text-sm text-center">
                    Masukkan kode 6 digit dari aplikasi Authenticator.
                  </p>
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    className="w-full text-center text-2xl tracking-widest py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  {loginError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
                      {loginError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Memverifikasi...
                      </>
                    ) : (
                      "Verifikasi"
                    )}
                  </button>
                </form>
              )}

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">atau</span>
                </div>
              </div>

              {/* Demo Credentials */}
              <div className="mt-6 p-4 bg-purple-50 rounded-xl border border-purple-100">
                <p className="text-xs text-purple-800 text-center font-medium mb-1">
                  Demo Credentials:
                </p>
                <p className="text-xs text-purple-600 text-center">
                  Username: xxx | Password: ***
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Sidebar (Only show when logged in) */}
      {isLoggedIn && (
        <div
          className={`fixed inset-0 z-50 ${isCartOpen ? "visible" : "invisible"}`}
        >
          <div
            className={`absolute inset-0 bg-black/50 transition-opacity ${isCartOpen ? "opacity-100" : "opacity-0"}`}
            onClick={() => setIsCartOpen(false)}
          />

          <div
            className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl transform transition-transform ${isCartOpen ? "translate-x-0" : "translate-x-full"}`}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <ShoppingCart className="w-6 h-6" />
                  Keranjang ({totalItems})
                </h2>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <ShoppingCart className="w-12 h-12 text-gray-400" />
                    </div>
                    <p className="text-gray-500">Keranjang masih kosong</p>
                    <button
                      onClick={() => setIsCartOpen(false)}
                      className="mt-4 text-purple-600 font-medium hover:underline"
                    >
                      Mulai Belanja
                    </button>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 bg-gray-50 p-4 rounded-xl"
                    >
                      <div
                        className={`w-20 h-20 ${item.color} rounded-lg p-2 flex-shrink-0`}
                      >
                        <div className="w-full h-full">{item.icon}</div>
                      </div>

                      <div className="flex-1">
                        <h4 className="font-bold text-gray-800">{item.name}</h4>
                        <p className="text-sm text-gray-500">{item.unit}</p>
                        <p className="text-purple-600 font-bold mt-1">
                          {formatPrice(item.price)}
                        </p>

                        <div className="flex items-center gap-3 mt-2">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-medium w-8 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="ml-auto p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="border-t border-gray-100 p-6 space-y-4 bg-gray-50">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">
                      {formatPrice(totalPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Ongkir</span>
                    <span className="font-medium text-purple-600">Gratis</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                    <span>Total</span>
                    <span className="text-purple-600">
                      {formatPrice(totalPrice)}
                    </span>
                  </div>

                  <button className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2">
                    Checkout
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
