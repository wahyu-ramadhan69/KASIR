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
  Calendar1,
  CalendarDays,
  Undo2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Menu untuk Admin
const adminNavLinks = [
  {
    label: "Dashboard",
    href: "/dashboard/admin",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
];

const adminMasterDataLinks = [
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

const adminTransactionLinks = [
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
    label: "Transaksi Kasir",
    href: "/dashboard/admin/penjualan",
    icon: <ShoppingBag className="w-5 h-5" />,
    subMenu: [
      {
        label: "Penjualan Toko",
        href: "/dashboard/admin/penjualan",
        icon: <ShoppingBag className="w-4 h-4" />,
      },
      {
        label: "Pengembalian Barang",
        href: "/dashboard/admin/penjualan/pengembalian",
        icon: <Undo2 className="w-4 h-4" />,
      },
      {
        label: "Riwayat Penjualan",
        href: "/dashboard/admin/penjualan/riwayat",
        icon: <History className="w-4 h-4" />,
      },
      {
        label: "Riwayat Pengembalian",
        href: "/dashboard/admin/penjualan/pengembalian/riwayat",
        icon: <History className="w-4 h-4" />,
      },
    ],
  },
  {
    label: "Sales dan Kanvas",
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
        label: "Riwayat Penjualan",
        href: "/dashboard/admin/penjualan-sales/riwayat",
        icon: <History className="w-4 h-4" />,
      },
      {
        label: "Riwayat Kanvas",
        href: "/dashboard/admin/penjualan-sales/luar-kota/riwayat",
        icon: <History className="w-4 h-4" />,
      },
      {
        label: "Pengembalian Kanvas",
        href: "/dashboard/admin/penjualan-sales/riwayat/pengembalian",
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
    href: "/dashboard/admin/pengeluaran/harian",
    icon: <DollarSign className="w-5 h-5" />,
    subMenu: [
      {
        label: "Pengeluaran Harian",
        href: "/dashboard/admin/pengeluaran/harian",
        icon: <CalendarDays className="w-4 h-4" />,
      },
      {
        label: "Pengeluaran Bulanan",
        href: "/dashboard/admin/pengeluaran/bulanan",
        icon: <Calendar1 className="w-4 h-4" />,
      },
    ],
  },
  {
    label: "Laporan",
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
        label: "Laporan laba Barang",
        href: "/dashboard/admin/laporan/laba-barang",
        icon: <FileText className="w-4 h-4" />,
      },
      {
        label: "Semua Laporan",
        href: "/dashboard/admin/laporan/all",
        icon: <FileText className="w-4 h-4" />,
      },
    ],
  },
];

// Menu untuk Kasir
const kasirNavLinks = [
  {
    label: "Dashboard",
    href: "/dashboard/kasir",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
];

const kasirMasterDataLinks = [
  {
    label: "Master Data",
    href: "/dashboard/kasir/barang",
    icon: <Database className="w-5 h-5" />,
    subMenu: [
      {
        label: "Supplier",
        href: "/dashboard/kasir/supplier",
        icon: <Users className="w-4 h-4" />,
      },
      {
        label: "Customer",
        href: "/dashboard/kasir/customer",
        icon: <UserCheck className="w-4 h-4" />,
      },
    ],
  },
];

const kasirTransactionLinks = [
  {
    label: "Transaksi Kasir",
    href: "/dashboard/kasir/penjualan",
    icon: <ShoppingBag className="w-5 h-5" />,
    subMenu: [
      {
        label: "Penjualan Toko",
        href: "/dashboard/kasir/penjualan",
        icon: <ShoppingBag className="w-4 h-4" />,
      },
      {
        label: "Pengembalian Barang",
        href: "/dashboard/kasir/penjualan/pengembalian",
        icon: <Undo2 className="w-4 h-4" />,
      },
      {
        label: "Riwayat Penjualan",
        href: "/dashboard/kasir/penjualan/riwayat",
        icon: <History className="w-4 h-4" />,
      },
      {
        label: "Riwayat Pengembalian",
        href: "/dashboard/kasir/penjualan/pengembalian/riwayat",
        icon: <History className="w-4 h-4" />,
      },
    ],
  },
  // {
  //   label: "Sales dan Kanvas",
  //   href: "/dashboard/kasir/penjualan-sales",
  //   icon: <Truck className="w-5 h-5" />,
  //   subMenu: [
  //     {
  //       label: "Dalam Kota",
  //       href: "/dashboard/kasir/penjualan-sales",
  //       icon: <PackageOpen className="w-4 h-4" />,
  //     },
  //     {
  //       label: "Luar Kota",
  //       href: "/dashboard/kasir/penjualan-sales/luar-kota",
  //       icon: <Truck className="w-4 h-4" />,
  //     },
  //     {
  //       label: "Kanvas Sales",
  //       href: "/dashboard/kasir/penjualan-sales/kanvas",
  //       icon: <Truck className="w-4 h-4" />,
  //     },
  //     {
  //       label: "Riwayat Penjualan",
  //       href: "/dashboard/kasir/penjualan-sales/riwayat",
  //       icon: <History className="w-4 h-4" />,
  //     },
  //     {
  //       label: "Riwayat Kanvas",
  //       href: "/dashboard/kasir/penjualan-sales/luar-kota/riwayat",
  //       icon: <History className="w-4 h-4" />,
  //     },
  //     {
  //       label: "Pengembalian Kanvas",
  //       href: "/dashboard/kasir/penjualan-sales/riwayat/pengembalian",
  //       icon: <History className="w-4 h-4" />,
  //     },
  //   ],
  // },
  {
    label: "Hutang-Piutang",
    href: "/dashboard/kasir/hutang-piutang/hutang-pembelian",
    icon: <Wallet2 className="w-5 h-5" />,
    subMenu: [
      {
        label: "Piutang Customer",
        href: "/dashboard/kasir/hutang-piutang/piutang-customer",
        icon: <ReceiptText className="w-4 h-4" />,
      },
      {
        label: "Piutang Kanvas",
        href: "/dashboard/kasir/hutang-piutang/piutang-kanvas",
        icon: <ReceiptText className="w-4 h-4" />,
      },
    ],
  },
  {
    label: "Pengeluaran",
    href: "/dashboard/kasir/pengeluaran/harian",
    icon: <DollarSign className="w-5 h-5" />,
    subMenu: [
      {
        label: "Pengeluaran Harian",
        href: "/dashboard/kasir/pengeluaran/harian",
        icon: <CalendarDays className="w-4 h-4" />,
      },
    ],
  },
];

interface SidebarProps {
  role: string;
  username?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ role, username }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Dapatkan menu berdasarkan role
  const userRole = role.toLowerCase() as "admin" | "kasir";
  const navLinks = userRole === "admin" ? adminNavLinks : kasirNavLinks;
  const masterDataLinks =
    userRole === "admin" ? adminMasterDataLinks : kasirMasterDataLinks;
  const transactionLinks =
    userRole === "admin" ? adminTransactionLinks : kasirTransactionLinks;

  // Auto-expand menu jika ada submenu yang aktif
  useEffect(() => {
    if (!isCollapsed) {
      masterDataLinks.forEach((link) => {
        if (
          link.subMenu &&
          isSubMenuActive(link.subMenu) &&
          !openMenus.includes(link.label)
        ) {
          setOpenMenus((prev) => [...prev, link.label]);
        }
      });

      transactionLinks.forEach((link) => {
        if (
          link.subMenu &&
          isSubMenuActive(link.subMenu) &&
          !openMenus.includes(link.label)
        ) {
          setOpenMenus((prev) => [...prev, link.label]);
        }
      });
    }
  }, [pathname, isCollapsed, masterDataLinks, transactionLinks, openMenus]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Close all menus when sidebar is collapsed
  useEffect(() => {
    if (isCollapsed) {
      setOpenMenus([]);
    }
  }, [isCollapsed]);

  // Update body class for layout adjustment
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (isCollapsed) {
        document.body.classList.add("sidebar-collapsed");
      } else {
        document.body.classList.remove("sidebar-collapsed");
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        document.body.classList.remove("sidebar-collapsed");
      }
    };
  }, [isCollapsed]);

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
    if (!isCollapsed) {
      setOpenMenus((prev) =>
        prev.includes(label)
          ? prev.filter((item) => item !== label)
          : [...prev, label]
      );
    }
  };

  const isMenuOpen = (label: string) =>
    openMenus.includes(label) && !isCollapsed;

  const isSubMenuActive = (subMenu: { href: string }[]) =>
    subMenu.some((item) => pathname === item.href);

  const renderMenuItem = (link: any, isSubMenu: boolean = false) => {
    const hasSubMenu = link.subMenu && link.subMenu.length > 0;
    const isActive = hasSubMenu
      ? isSubMenuActive(link.subMenu)
      : pathname === link.href;

    if (hasSubMenu) {
      return (
        <li key={link.label} className="relative group">
          <button
            onClick={() => toggleMenu(link.label)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
              isActive
                ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30"
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            } ${isCollapsed ? "justify-center" : ""}`}
            type="button"
          >
            <span
              className={`flex-shrink-0 ${
                isActive ? "text-white" : "text-gray-400 group-hover:text-white"
              }`}
            >
              {link.icon}
            </span>
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left">{link.label}</span>
                <span
                  className={`transform transition-transform duration-200 ${
                    isMenuOpen(link.label) ? "rotate-180" : ""
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </span>
              </>
            )}
          </button>

          {/* Tooltip for collapsed state */}
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
              {link.label}
            </div>
          )}

          {/* Sub Menu */}
          {!isCollapsed && (
            <ul
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                isMenuOpen(link.label)
                  ? "max-h-96 opacity-100 mt-1"
                  : "max-h-0 opacity-0"
              }`}
            >
              {link.subMenu.map((subItem: any) => (
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
          )}
        </li>
      );
    }

    return (
      <li key={link.href} className="relative group">
        <Link href={link.href} scroll={false}>
          <button
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
              isActive
                ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30"
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            } ${isCollapsed ? "justify-center" : ""}`}
            type="button"
          >
            <span
              className={`flex-shrink-0 ${
                isActive ? "text-white" : "text-gray-400 group-hover:text-white"
              }`}
            >
              {link.icon}
            </span>
            {!isCollapsed && <span>{link.label}</span>}
          </button>
        </Link>
        {isCollapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
            {link.label}
          </div>
        )}
      </li>
    );
  };

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
        className={`bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800 fixed inset-0 z-40 my-4 ml-4 h-[calc(100vh-32px)] rounded-xl transition-all duration-300 shadow-2xl border border-white/10 ${
          isMobileOpen ? "translate-x-0 w-72" : "-translate-x-80 w-72"
        } xl:translate-x-0 ${isCollapsed ? "xl:w-20" : "xl:w-72"}`}
      >
        {/* Header */}
        <div className="relative border-b border-white/10 bg-gradient-to-r from-blue-600/10 to-purple-600/10">
          <div
            className={`flex items-center py-6 px-6 ${
              isCollapsed ? "flex-col gap-4" : "justify-between"
            }`}
          >
            <Link
              className={`flex items-center gap-3 group ${
                isCollapsed ? "justify-center w-full" : "flex-1"
              }`}
              href={
                userRole === "admin" ? "/dashboard/admin" : "/dashboard/kasir"
              }
            >
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-shadow flex-shrink-0">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <h6 className="block font-sans text-sm font-bold text-white tracking-wide whitespace-nowrap uppercase">
                    {userRole}
                  </h6>
                  <p className="text-xs text-gray-400 whitespace-nowrap">
                    {username || "Dashboard"}
                  </p>
                </div>
              )}
            </Link>

            {/* Toggle Button - Desktop Only */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`hidden xl:flex p-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-200 items-center justify-center group border border-white/10 ${
                isCollapsed ? "w-full" : ""
              }`}
              type="button"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div
          className={`py-4 h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar ${
            isCollapsed ? "px-2" : "px-4"
          }`}
        >
          {/* Menu Utama */}
          <div className="mb-6">
            {!isCollapsed && (
              <h3 className="px-4 mb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                Menu Utama
              </h3>
            )}
            <ul className="flex flex-col gap-1">
              {navLinks.map((link) => renderMenuItem(link))}
            </ul>
          </div>

          {/* Master Data */}
          {masterDataLinks.length > 0 && (
            <div className="mb-6">
              {!isCollapsed && (
                <h3 className="px-4 mb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Data
                </h3>
              )}
              <ul className="flex flex-col gap-1">
                {masterDataLinks.map((link) => renderMenuItem(link))}
              </ul>
            </div>
          )}

          {/* Transaksi */}
          <div className="mb-6">
            {!isCollapsed && (
              <h3 className="px-4 mb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                Transaksi
              </h3>
            )}
            <ul className="flex flex-col gap-1">
              {transactionLinks.map((link) => renderMenuItem(link))}
            </ul>
          </div>

          {/* Account */}
          <div className="pt-4 border-t border-white/10">
            {!isCollapsed && (
              <h3 className="px-4 mb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                Account
              </h3>
            )}
            <div className="relative group">
              <button
                onClick={handleLogout}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm text-gray-300 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 ${
                  isCollapsed ? "justify-center" : ""
                }`}
                type="button"
              >
                <span className="text-gray-400 group-hover:text-red-400 flex-shrink-0">
                  <LogOut className="w-5 h-5" />
                </span>
                {!isCollapsed && <span>Sign Out</span>}
              </button>
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
                  Sign Out
                </div>
              )}
            </div>
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
