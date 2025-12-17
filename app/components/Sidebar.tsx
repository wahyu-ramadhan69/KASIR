// components/Sidebar.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import {
  Package,
  Users,
  UserCheck,
  LogOut,
  ShoppingCart,
  ShoppingBag,
  ChevronDown,
  ChevronRight,
  History,
  FileText,
  DollarSign,
  LayoutDashboard,
  Menu,
  X,
  User2,
  Database,
  Truck,
  ReceiptText,
  PackageOpen,
  Wallet2,
  Wallet,
} from "lucide-react";

const navLinks = [
  {
    label: "Dashboard",
    href: "/dashboard/admin",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
];

const masterDataLinks = [
  {
    label: "Master Data",
    href: "/dashboard/admin/barang",
    icon: <Database className="w-5 h-5" />,
    subMenu: [
      {
        label: "Barang",
        href: "/dashboard/admin/barang",
        icon: <Package className="w-4 h-4" />,
      },
      {
        label: "Supplier",
        href: "/dashboard/admin/supplier",
        icon: <Users className="w-4 h-4" />,
      },
      {
        label: "Customer",
        href: "/dashboard/admin/customer",
        icon: <UserCheck className="w-4 h-4" />,
      },
      {
        label: "Karyawan",
        href: "/dashboard/admin/karyawan",
        icon: <Truck className="w-4 h-4" />,
      },
      {
        label: "Users",
        href: "/dashboard/admin/users",
        icon: <User2 className="w-4 h-4" />,
      },
    ],
  },
];

const transactionLinks = [
  {
    label: "Pembelian",
    href: "/dashboard/admin/pembelian",
    icon: <ShoppingCart className="w-5 h-5" />,
    subMenu: [
      {
        label: "Transaksi Pembelian",
        href: "/dashboard/admin/pembelian",
        icon: <ShoppingCart className="w-4 h-4" />,
      },
      {
        label: "Riwayat Pembelian",
        href: "/dashboard/admin/pembelian/riwayat",
        icon: <History className="w-4 h-4" />,
      },
    ],
  },
  {
    label: "Penjualan",
    href: "/dashboard/admin/penjualan",
    icon: <ShoppingBag className="w-5 h-5" />,
    subMenu: [
      {
        label: "Penjualan Toko",
        href: "/dashboard/admin/penjualan",
        icon: <ShoppingBag className="w-4 h-4" />,
      },
      {
        label: "Riwayat Penjualan",
        href: "/dashboard/admin/penjualan/riwayat",
        icon: <History className="w-4 h-4" />,
      },
    ],
  },
  {
    label: "Penjualan Sales",
    href: "/dashboard/admin/penjualan-sales",
    icon: <Truck className="w-5 h-5" />,
    subMenu: [
      {
        label: "Dalam Kota",
        href: "/dashboard/admin/penjualan-sales",
        icon: <PackageOpen className="w-4 h-4" />,
      },
      {
        label: "Luar Kota",
        href: "/dashboard/admin/penjualan-sales/luar-kota",
        icon: <Truck className="w-4 h-4" />,
      },
      {
        label: "Kanvas Sales",
        href: "/dashboard/admin/penjualan-sales/kanvas",
        icon: <Truck className="w-4 h-4" />,
      },
      {
        label: "Riwayat Kanvas Sales",
        href: "/dashboard/admin/penjualan-sales/luar-kota/riwayat",
        icon: <History className="w-4 h-4" />,
      },
      {
        label: "Riwayat Penjualan",
        href: "/dashboard/admin/penjualan-sales/riwayat",
        icon: <History className="w-4 h-4" />,
      },
    ],
  },
  {
    label: "Hutang-Piutang",
    href: "/dashboard/admin/hutang-piutang/hutang-pembelian",
    icon: <Wallet2 className="w-5 h-5" />,
    subMenu: [
      {
        label: "Hutang Pembelian",
        href: "/dashboard/admin/hutang-piutang/hutang-pembelian",
        icon: <Wallet className="w-4 h-4" />,
      },
      {
        label: "Piutang Customer",
        href: "/dashboard/admin/hutang-piutang/piutang-customer",
        icon: <ReceiptText className="w-4 h-4" />,
      },
      {
        label: "Piutang Kanvas",
        href: "/dashboard/admin/hutang-piutang/piutang-kanvas",
        icon: <ReceiptText className="w-4 h-4" />,
      },
    ],
  },
  {
    label: "Pengeluaran",
    href: "/dashboard/admin/pengeluaran",
    icon: <DollarSign className="w-5 h-5" />,
    subMenu: [
      {
        label: "Catat Pengeluaran",
        href: "/dashboard/admin/pengeluaran",
        icon: <DollarSign className="w-4 h-4" />,
      },
    ],
  },
  {
    label: "Laporan Transaksi",
    href: "/dashboard/admin/laporan/pembelian",
    icon: <FileText className="w-5 h-5" />,
    subMenu: [
      {
        label: "Laporan Pembelian",
        href: "/dashboard/admin/laporan/pembelian",
        icon: <FileText className="w-4 h-4" />,
      },
      {
        label: "Laporan Penjualan",
        href: "/dashboard/admin/laporan/penjualan",
        icon: <FileText className="w-4 h-4" />,
      },
      {
        label: "Laporan Pengeluaran",
        href: "/dashboard/admin/laporan/pengeluaran",
        icon: <FileText className="w-4 h-4" />,
      },
      {
        label: "Semua Pengeluaran",
        href: "/dashboard/admin/laporan/all",
        icon: <FileText className="w-4 h-4" />,
      },
    ],
  },
];

const Sidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Auto-expand menu jika ada submenu yang aktif
  useEffect(() => {
    // Check master data links
    masterDataLinks.forEach((link) => {
      if (isSubMenuActive(link.subMenu) && !openMenus.includes(link.label)) {
        setOpenMenus((prev) => [...prev, link.label]);
      }
    });

    // Check transaction links
    transactionLinks.forEach((link) => {
      if (isSubMenuActive(link.subMenu) && !openMenus.includes(link.label)) {
        setOpenMenus((prev) => [...prev, link.label]);
      }
    });
  }, [pathname]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "DELETE" });
      localStorage.removeItem("token");
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
      router.push("/");
    }
  };

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  const isMenuOpen = (label: string) => openMenus.includes(label);

  const isSubMenuActive = (subMenu: { href: string }[]) =>
    subMenu.some((item) => pathname === item.href);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="xl:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-gray-800 text-white shadow-lg hover:bg-gray-700 transition-colors"
        type="button"
      >
        {isMobileOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <Menu className="w-6 h-6" />
        )}
      </button>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="xl:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800 fixed inset-0 z-50 my-4 ml-4 h-[calc(100vh-32px)] w-72 rounded-xl transition-transform duration-300 shadow-2xl border border-white/10 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-80"
        } xl:translate-x-0`}
      >
        {/* Header */}
        <div className="relative border-b border-white/10 bg-gradient-to-r from-blue-600/10 to-purple-600/10">
          <Link
            className="flex items-center gap-3 py-6 px-6 group"
            href="/dashboard/admin"
          >
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-shadow">
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h6 className="block font-sans text-sm font-bold text-white tracking-wide">
                ADMIN
              </h6>
              <p className="text-xs text-gray-400">Dashboard</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <div className="px-4 py-4 h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar">
          {/* Menu Utama */}
          <div className="mb-6">
            <h3 className="px-4 mb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
              Menu Utama
            </h3>
            <ul className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} scroll={false}>
                    <button
                      className={`group w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                        pathname === link.href
                          ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30"
                          : "text-gray-300 hover:bg-white/5 hover:text-white"
                      }`}
                      type="button"
                    >
                      <span
                        className={`${
                          pathname === link.href
                            ? "text-white"
                            : "text-gray-400 group-hover:text-white"
                        }`}
                      >
                        {link.icon}
                      </span>
                      <span>{link.label}</span>
                    </button>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Master Data */}
          <div className="mb-6">
            <h3 className="px-4 mb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
              Data
            </h3>
            <ul className="flex flex-col gap-1">
              {masterDataLinks.map((link) => (
                <li key={link.label}>
                  {/* Parent Menu Button */}
                  <button
                    onClick={() => toggleMenu(link.label)}
                    className={`group w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                      isSubMenuActive(link.subMenu)
                        ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30"
                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                    }`}
                    type="button"
                  >
                    <span
                      className={`${
                        isSubMenuActive(link.subMenu)
                          ? "text-white"
                          : "text-gray-400 group-hover:text-white"
                      }`}
                    >
                      {link.icon}
                    </span>
                    <span className="flex-1 text-left">{link.label}</span>
                    <span
                      className={`transform transition-transform duration-200 ${
                        isMenuOpen(link.label) ? "rotate-180" : ""
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </button>

                  {/* Sub Menu */}
                  <ul
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isMenuOpen(link.label)
                        ? "max-h-96 opacity-100 mt-1"
                        : "max-h-0 opacity-0"
                    }`}
                  >
                    {link.subMenu.map((subItem) => (
                      <li key={subItem.href}>
                        <Link href={subItem.href} scroll={false}>
                          <button
                            className={`group w-full flex items-center gap-3 pl-12 pr-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
                              pathname === subItem.href
                                ? "text-blue-400 bg-blue-500/10"
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                            }`}
                            type="button"
                          >
                            <span
                              className={`${
                                pathname === subItem.href
                                  ? "text-blue-400"
                                  : "text-gray-500 group-hover:text-gray-300"
                              }`}
                            >
                              {subItem.icon}
                            </span>
                            <span className="text-xs">{subItem.label}</span>
                          </button>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>

          {/* Transaksi */}
          <div className="mb-6">
            <h3 className="px-4 mb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
              Transaksi
            </h3>
            <ul className="flex flex-col gap-1">
              {transactionLinks.map((link) => (
                <li key={link.label}>
                  {/* Parent Menu Button */}
                  <button
                    onClick={() => toggleMenu(link.label)}
                    className={`group w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                      isSubMenuActive(link.subMenu)
                        ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30"
                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                    }`}
                    type="button"
                  >
                    <span
                      className={`${
                        isSubMenuActive(link.subMenu)
                          ? "text-white"
                          : "text-gray-400 group-hover:text-white"
                      }`}
                    >
                      {link.icon}
                    </span>
                    <span className="flex-1 text-left">{link.label}</span>
                    <span
                      className={`transform transition-transform duration-200 ${
                        isMenuOpen(link.label) ? "rotate-180" : ""
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </button>

                  {/* Sub Menu */}
                  <ul
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isMenuOpen(link.label)
                        ? "max-h-96 opacity-100 mt-1"
                        : "max-h-0 opacity-0"
                    }`}
                  >
                    {link.subMenu.map((subItem) => (
                      <li key={subItem.href}>
                        <Link href={subItem.href} scroll={false}>
                          <button
                            className={`group w-full flex items-center gap-3 pl-12 pr-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
                              pathname === subItem.href
                                ? "text-blue-400 bg-blue-500/10"
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                            }`}
                            type="button"
                          >
                            <span
                              className={`${
                                pathname === subItem.href
                                  ? "text-blue-400"
                                  : "text-gray-500 group-hover:text-gray-300"
                              }`}
                            >
                              {subItem.icon}
                            </span>
                            <span className="text-xs">{subItem.label}</span>
                          </button>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div className="pt-4 border-t border-white/10">
            <h3 className="px-4 mb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
              Account
            </h3>
            <button
              onClick={handleLogout}
              className="group w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm text-gray-300 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
              type="button"
            >
              <span className="text-gray-400 group-hover:text-red-400">
                <LogOut className="w-5 h-5" />
              </span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </>
  );
};

export default Sidebar;
