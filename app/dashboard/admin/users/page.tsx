"use client";
import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  UserPlus,
  Edit,
  Trash2,
  X,
  RefreshCw,
  Shield,
  ShoppingCart,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  PlusIcon,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface User {
  id: number;
  username: string;
  email: string;
  role: "ADMIN" | "KASIR" | "KEPALA_GUDANG" | "SALES";
  isActive: boolean;
  karyawanId?: number | null;
  createdAt: string;
  updatedAt: string;
}

interface UserFormData {
  username: string;
  email: string;
  role: "ADMIN" | "KASIR" | "KEPALA_GUDANG" | "SALES";
  isActive: boolean;
  password?: string;
  karyawanId?: number | null;
}

interface SalesKaryawan {
  id: number;
  nama: string;
  nik: string;
}

const DataUserPage = () => {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<{
    id: number;
    data: UserFormData;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showEditPassword, setShowEditPassword] = useState<boolean>(false);
  const [salesKaryawan, setSalesKaryawan] = useState<SalesKaryawan[]>([]);
  const [addRole, setAddRole] = useState<UserFormData["role"]>("KASIR");

  useEffect(() => {
    fetchUsers();
    fetchSalesKaryawan();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();

      if (data.success) {
        setUsersList(data.data);
      } else {
        toast.error(data.error || "Gagal mengambil data user");
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Terjadi kesalahan saat mengambil data user");
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesKaryawan = async () => {
    try {
      const res = await fetch(
        "/api/karyawan?limit=1000&excludeJenis=KASIR,KEPALA_GUDANG,KARYAWAN,OWNER",
      );
      const data = await res.json();
      if (Array.isArray(data.data)) {
        setSalesKaryawan(data.data);
      }
    } catch (error) {
      console.error("Error fetching karyawan sales:", error);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser({
      id: user.id,
      data: {
        username: user.username,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        password: "",
        karyawanId: user.karyawanId ?? null,
      },
    });
    setShowEditModal(true);
  };

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus user "${username}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        toast.success("User berhasil dihapus!");
        fetchUsers();
      } else {
        toast.error(data.error || "Gagal menghapus user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Terjadi kesalahan saat menghapus user");
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: !currentStatus,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(
          `User berhasil ${!currentStatus ? "diaktifkan" : "dinonaktifkan"}!`,
        );
        fetchUsers();
      } else {
        toast.error(data.error || "Gagal mengubah status user");
      }
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast.error("Terjadi kesalahan saat mengubah status user");
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    if (editingUser) {
      const nextValue =
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : name === "karyawanId"
            ? value === ""
              ? null
              : Number(value)
            : value;

      const nextData: UserFormData = {
        ...editingUser.data,
        [name]: nextValue as any,
      };

      if (name === "role" && value !== "SALES") {
        nextData.karyawanId = null;
      }

      setEditingUser({
        ...editingUser,
        data: nextData,
      });
    }
  };

  const handleSubmitAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const role = (formData.get("role") as string) || "KASIR";
    const karyawanIdRaw = formData.get("karyawanId") as string | null;
    const karyawanId =
      karyawanIdRaw && karyawanIdRaw !== "" ? Number(karyawanIdRaw) : null;

    if (password.length < 4) {
      toast.error("Password minimal 4 karakter");
      setIsSubmitting(false);
      return;
    }

    if (role === "SALES" && !karyawanId) {
      toast.error("Karyawan wajib dipilih untuk role Sales");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: formData.get("username"),
          email: formData.get("email"),
          password: password,
          role,
          ...(role === "SALES" ? { karyawanId } : {}),
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("User berhasil ditambahkan!");
        setShowAddModal(false);
        fetchUsers();
        (e.target as HTMLFormElement).reset();
      } else {
        toast.error(data.error || "Gagal menambahkan user");
      }
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error("Terjadi kesalahan saat menambahkan user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmitting(true);

    const updateData: any = {
      username: editingUser.data.username,
      email: editingUser.data.email,
      role: editingUser.data.role,
      isActive: editingUser.data.isActive,
    };

    // Hanya kirim password jika diisi
    if (editingUser.data.password && editingUser.data.password.length > 0) {
      if (editingUser.data.password.length < 6) {
        toast.error("Password minimal 6 karakter");
        setIsSubmitting(false);
        return;
      }
      updateData.password = editingUser.data.password;
    }

    if (editingUser.data.role === "SALES" && !editingUser.data.karyawanId) {
      toast.error("Karyawan wajib dipilih untuk role Sales");
      setIsSubmitting(false);
      return;
    }

    if (editingUser.data.role === "SALES") {
      updateData.karyawanId = editingUser.data.karyawanId;
    } else {
      updateData.karyawanId = null;
    }

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("User berhasil diupdate!");
        setShowEditModal(false);
        setEditingUser(null);
        fetchUsers();
      } else {
        toast.error(data.error || "Gagal mengupdate user");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Terjadi kesalahan saat mengupdate user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRoleColor = (role: string) => {
    if (role === "ADMIN") return "bg-purple-100 text-purple-800";
    if (role === "KASIR") return "bg-blue-100 text-blue-800";
    if (role === "KEPALA_GUDANG") return "bg-amber-100 text-amber-800";
    return "bg-emerald-100 text-emerald-800";
  };

  const getRoleIcon = (role: string) => {
    if (role === "ADMIN") return <Shield className="w-4 h-4" />;
    if (role === "KASIR") return <ShoppingCart className="w-4 h-4" />;
    if (role === "KEPALA_GUDANG") return <CheckCircle className="w-4 h-4" />;
    return <UserPlus className="w-4 h-4" />;
  };

  const filteredUsers = usersList.filter((user) => {
    const matchSearch =
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = filterRole === "all" || user.role === filterRole;
    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && user.isActive) ||
      (filterStatus === "inactive" && !user.isActive);
    return matchSearch && matchRole && matchStatus;
  });

  const activeUsersCount = usersList.filter((u) => u.isActive).length;
  const adminCount = usersList.filter((u) => u.role === "ADMIN").length;
  const kasirCount = usersList.filter((u) => u.role === "KASIR").length;
  const salesCount = usersList.filter((u) => u.role === "SALES").length;
  const kepalaGudangCount = usersList.filter(
    (u) => u.role === "KEPALA_GUDANG",
  ).length;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="w-full max-w-7xl mx-auto px-6 pb-8">
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
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-8 mb-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
                <Users className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                  Kelola User
                </h1>
                <p className="text-blue-100 text-lg">
                  Manajemen user dan hak akses sistem
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setAddRole("KASIR");
                  setShowAddModal(true);
                }}
                className="group bg-white hover:bg-blue-50 text-blue-600 px-6 py-3 rounded-xl flex items-center gap-2 transition-all font-semibold shadow-lg hover:shadow-xl hover:scale-105 transform"
              >
                <PlusIcon className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                Tambah User
              </button>
              <button
                onClick={fetchUsers}
                className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg"
              >
                <RefreshCw
                  className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Total User
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {usersList.length}
                </p>
                <p className="text-xs text-gray-400 mt-2">Pengguna terdaftar</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  User Aktif
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {activeUsersCount}
                </p>
                <p className="text-xs text-gray-400 mt-2">Sedang aktif</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Admin
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {adminCount}
                </p>
                <p className="text-xs text-gray-400 mt-2">Role administrator</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <Shield className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Kasir
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {kasirCount}
                </p>
                <p className="text-xs text-gray-400 mt-2">Role kasir</p>
              </div>
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <ShoppingCart className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Sales
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {salesCount}
                </p>
                <p className="text-xs text-gray-400 mt-2">Role sales</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <UserPlus className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-1">
                  Kepala Gudang
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {kepalaGudangCount}
                </p>
                <p className="text-xs text-gray-400 mt-2">Role gudang</p>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-4 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Cari username atau email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all bg-white"
              >
                <option value="all">Semua Role</option>
                <option value="ADMIN">Admin</option>
                <option value="KASIR">Kasir</option>
                <option value="SALES">Sales</option>
                <option value="KEPALA_GUDANG">Kepala Gudang</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all bg-white"
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </div>

          {searchTerm && (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-4 py-2 rounded-lg">
              <Search className="w-4 h-4 text-blue-600" />
              <span>
                Menampilkan hasil untuk: {""}
                <span className="font-semibold text-blue-700">
                  "{searchTerm}"
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-24">
              <div className="text-center">
                <div className="relative">
                  <div className="w-24 h-24 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                  <Users className="w-10 h-10 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <p className="text-gray-500 mt-6 text-lg font-medium">
                  Memuat data user...
                </p>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-16 text-center">
              <div className="bg-gray-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-12 h-12 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg font-medium">
                Tidak ada data user ditemukan
              </p>
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
                      Username
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Dibuat
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user, index) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {user.username}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${getRoleColor(
                            user.role,
                          )}`}
                        >
                          {getRoleIcon(user.role)}
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() =>
                            handleToggleStatus(user.id, user.isActive)
                          }
                          className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 transition-all ${
                            user.isActive
                              ? "bg-green-100 text-green-800 hover:bg-green-200"
                              : "bg-red-100 text-red-800 hover:bg-red-200"
                          }`}
                        >
                          {user.isActive ? (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              Aktif
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" />
                              Nonaktif
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white rounded-lg transition-all shadow-sm"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id, user.username)}
                            className="p-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg transition-all shadow-sm"
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
          )}
        </div>

        <div className="mt-4 text-center text-sm text-gray-500">
          Menampilkan {filteredUsers.length} dari {usersList.length} user
        </div>

        {/* Modal Tambah User dengan warna biru */}
        {showAddModal && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-xl w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  Tambah User Baru
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmitAdd} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="username"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                      placeholder="johndoe"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                      placeholder="johndoe@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none pr-10"
                        placeholder="Min. 6 karakter"
                        required
                        minLength={4}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Role <span className="text-red-500">*</span>
                    </label>
                      <select
                        name="role"
                        onChange={(e) =>
                          setAddRole(e.target.value as UserFormData["role"])
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                        required
                      >
                        <option value="KASIR">Kasir</option>
                        <option value="ADMIN">Admin</option>
                        <option value="SALES">Sales</option>
                        <option value="KEPALA_GUDANG">Kepala Gudang</option>
                      </select>
                  </div>

                  {addRole === "SALES" && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Karyawan Sales <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="karyawanId"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
                        required
                        defaultValue=""
                      >
                        <option value="" disabled>
                          Pilih karyawan sales
                        </option>
                        {salesKaryawan.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.nama} ({k.nik})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg transition-all font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-3 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Menyimpan..." : "Simpan User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Edit User tetap kuning */}
        {showEditModal && editingUser && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowEditModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-xl w-full max-h-[90vh] overflow-y-auto overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Edit User</h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmitEdit} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={editingUser.data.username}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={editingUser.data.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Password Baru
                    </label>
                    <div className="relative">
                      <input
                        type={showEditPassword ? "text" : "password"}
                        name="password"
                        value={editingUser.data.password || ""}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none pr-10"
                        placeholder="Kosongkan jika tidak ingin mengubah"
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showEditPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Minimal 6 karakter jika ingin mengubah password
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="role"
                      value={editingUser.data.role}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                      required
                    >
                      <option value="KASIR">Kasir</option>
                      <option value="ADMIN">Admin</option>
                      <option value="SALES">Sales</option>
                      <option value="KEPALA_GUDANG">Kepala Gudang</option>
                    </select>
                  </div>

                  {editingUser.data.role === "SALES" && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Karyawan Sales <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="karyawanId"
                        value={editingUser.data.karyawanId ?? ""}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-transparent outline-none"
                        required
                      >
                        <option value="" disabled>
                          Pilih karyawan sales
                        </option>
                        {salesKaryawan.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.nama} ({k.nik})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="isActive"
                        checked={editingUser.data.isActive}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                      />
                      <span className="text-sm font-semibold text-gray-700">
                        User Aktif
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-lg transition-all font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-4 py-3 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Menyimpan..." : "Update User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataUserPage;
