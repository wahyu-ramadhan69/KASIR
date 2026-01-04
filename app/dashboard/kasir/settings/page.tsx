"use client";
import React, { useState, useEffect } from "react";
import {
  Settings,
  Lock,
  Shield,
  Eye,
  EyeOff,
  Key,
  CheckCircle,
  AlertCircle,
  Smartphone,
  Save,
  RefreshCw,
} from "lucide-react";

interface UserSettings {
  username: string;
  email: string;
  twoFactorEnabled: boolean;
}

const SettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  // Password states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // 2FA states
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [twoFACode, setTwoFACode] = useState("");
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);
  const [isDisabling2FA, setIsDisabling2FA] = useState(false);

  useEffect(() => {
    fetchUserSettings();
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    setToastMessage(message);
    setToastType(type);
  };

  const fetchUserSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/settings");
      const data = await res.json();
      if (data.success) {
        setUserSettings(data.data);
      } else {
        showToast(data.error || "Gagal mengambil data pengaturan", "error");
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      showToast("Terjadi kesalahan saat mengambil data", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      showToast("Password baru minimal 6 karakter", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("Konfirmasi password tidak cocok", "error");
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();

      if (data.success) {
        showToast("Password berhasil diubah!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        showToast(data.error || "Gagal mengubah password", "error");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      showToast("Terjadi kesalahan saat mengubah password", "error");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleGenerateQR = async () => {
    setIsGeneratingQR(true);
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data?.error || "Gagal generate QR code", "error");
        return;
      }

      setQrCode(data.qrDataUrl);
      showToast("QR Code berhasil dibuat! Scan dengan Authenticator App");
    } catch (error) {
      console.error("Error generating QR:", error);
      showToast("Terjadi kesalahan saat membuat QR code", "error");
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const handleVerify2FA = async () => {
    if (twoFACode.length !== 6) {
      showToast("Kode harus 6 digit", "error");
      return;
    }

    setIsVerifying2FA(true);
    try {
      const res = await fetch("/api/auth/2fa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: twoFACode }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data?.error || "Kode salah atau tidak valid", "error");
        return;
      }

      showToast("2FA berhasil diaktifkan!");
      setQrCode(null);
      setTwoFACode("");
      fetchUserSettings();
    } catch (error) {
      console.error("Error verifying 2FA:", error);
      showToast("Terjadi kesalahan saat verifikasi", "error");
    } finally {
      setIsVerifying2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm("Apakah Anda yakin ingin menonaktifkan 2FA?")) {
      return;
    }

    setIsDisabling2FA(true);
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
      });

      const data = await res.json();

      if (data.success) {
        showToast("2FA berhasil dinonaktifkan");
        fetchUserSettings();
      } else {
        showToast(data.error || "Gagal menonaktifkan 2FA", "error");
      }
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      showToast("Terjadi kesalahan saat menonaktifkan 2FA", "error");
    } finally {
      setIsDisabling2FA(false);
    }
  };

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: 0, label: "", color: "" };
    if (password.length < 6)
      return { strength: 25, label: "Lemah", color: "bg-red-500" };
    if (password.length < 10)
      return { strength: 50, label: "Sedang", color: "bg-yellow-500" };
    if (password.length < 14)
      return { strength: 75, label: "Kuat", color: "bg-blue-500" };
    return { strength: 100, label: "Sangat Kuat", color: "bg-green-500" };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-24 h-24 border-8 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            <Settings className="w-10 h-10 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-gray-500 mt-6 text-lg font-medium">
            Memuat pengaturan...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="w-full max-w-5xl mx-auto px-6 py-8">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-4 right-4 z-50 animate-fade-in">
            <div
              className={`px-6 py-4 rounded-xl shadow-2xl border-2 ${
                toastType === "success"
                  ? "bg-green-600 border-green-700"
                  : "bg-red-600 border-red-700"
              }`}
            >
              <p className="text-white font-medium">{toastMessage}</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-8 mb-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
                <Settings className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                  Pengaturan Akun
                </h1>
                <p className="text-blue-100 text-lg">
                  Kelola keamanan dan preferensi akun Anda
                </p>
              </div>
            </div>
            <button
              onClick={fetchUserSettings}
              className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg"
            >
              <RefreshCw
                className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* User Info Card */}
        {userSettings && (
          <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-xl">
                <Settings className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {userSettings.username}
                </h3>
                <p className="text-gray-600">{userSettings.email}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Change Password Section */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                  <Lock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Ubah Password
                  </h2>
                  <p className="text-blue-100 text-sm mt-1">
                    Perbarui password untuk keamanan akun
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password Saat Ini <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                    placeholder="Masukkan password saat ini"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password Baru <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                    placeholder="Min. 6 karakter"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {newPassword && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600">
                        Kekuatan Password
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          passwordStrength.strength >= 75
                            ? "text-green-600"
                            : passwordStrength.strength >= 50
                            ? "text-yellow-600"
                            : "text-red-600"
                        }`}
                      >
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: `${passwordStrength.strength}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Konfirmasi Password Baru{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                    placeholder="Ulangi password baru"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Password tidak cocok
                  </p>
                )}
                {confirmPassword && newPassword === confirmPassword && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Password cocok
                  </p>
                )}
              </div>

              <button
                onClick={handleChangePassword}
                disabled={isChangingPassword || newPassword !== confirmPassword}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {isChangingPassword ? "Menyimpan..." : "Simpan Password Baru"}
              </button>
            </div>
          </div>

          {/* 2FA Section */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Autentikasi 2 Faktor
                  </h2>
                  <p className="text-indigo-100 text-sm mt-1">
                    Tingkatkan keamanan dengan 2FA
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Status 2FA */}
              <div
                className={`p-4 rounded-xl border-2 ${
                  userSettings?.twoFactorEnabled
                    ? "bg-green-50 border-green-200"
                    : "bg-yellow-50 border-yellow-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  {userSettings?.twoFactorEnabled ? (
                    <>
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <div>
                        <p className="font-semibold text-green-900">
                          2FA Aktif
                        </p>
                        <p className="text-sm text-green-700">
                          Akun Anda terlindungi dengan baik
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-6 h-6 text-yellow-600" />
                      <div>
                        <p className="font-semibold text-yellow-900">
                          2FA Tidak Aktif
                        </p>
                        <p className="text-sm text-yellow-700">
                          Aktifkan untuk keamanan ekstra
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {!userSettings?.twoFactorEnabled ? (
                <>
                  {!qrCode ? (
                    <button
                      onClick={handleGenerateQR}
                      disabled={isGeneratingQR}
                      className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50"
                    >
                      <Smartphone className="w-5 h-5" />
                      {isGeneratingQR ? "Membuat QR Code..." : "Aktifkan 2FA"}
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded-xl border-2 border-gray-200">
                        <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <Smartphone className="w-4 h-4" />
                          Scan QR Code dengan Authenticator App
                        </p>
                        <div className="flex justify-center">
                          <img
                            src={qrCode}
                            alt="QR Code 2FA"
                            className="w-56 h-56 rounded-lg shadow-md"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Kode Verifikasi{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={twoFACode}
                          onChange={(e) =>
                            setTwoFACode(
                              e.target.value.replace(/\D/g, "").slice(0, 6)
                            )
                          }
                          placeholder="Masukkan 6 digit kode"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none text-center text-2xl tracking-widest font-mono transition-all"
                        />
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setQrCode(null);
                            setTwoFACode("");
                          }}
                          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-3 rounded-xl transition-all font-medium"
                        >
                          Batal
                        </button>
                        <button
                          onClick={handleVerify2FA}
                          disabled={isVerifying2FA || twoFACode.length !== 6}
                          className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-4 py-3 rounded-xl transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                          {isVerifying2FA
                            ? "Memverifikasi..."
                            : "Verifikasi & Aktifkan"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                    <p className="text-sm text-green-800 mb-2">
                      ✓ 2FA telah aktif dan melindungi akun Anda
                    </p>
                    <p className="text-xs text-green-700">
                      Anda akan diminta kode dari Authenticator App setiap login
                    </p>
                  </div>

                  <button
                    onClick={handleDisable2FA}
                    disabled={isDisabling2FA}
                    className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50"
                  >
                    <Shield className="w-5 h-5" />
                    {isDisabling2FA ? "Menonaktifkan..." : "Nonaktifkan 2FA"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">
                Tips Keamanan
              </h3>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• Gunakan password yang kuat dan unik</li>
                <li>• Aktifkan 2FA untuk perlindungan ekstra</li>
                <li>• Jangan bagikan password kepada siapapun</li>
                <li>• Ubah password secara berkala</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
