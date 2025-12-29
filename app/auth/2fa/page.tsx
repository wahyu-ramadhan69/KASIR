"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function TwoFAPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        toast.success("Login berhasil");
        router.push("/dashboard/admin");
      } else {
        toast.error(data?.error || "Kode OTP salah");
      }
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-indigo-900">
          Verifikasi 2FA
        </h1>
        <p className="text-gray-600 mt-2">
          Masukkan kode 6 digit dari aplikasi Authenticator.
        </p>

        <form onSubmit={handleVerify} className="mt-6 space-y-4">
          <input
            className="w-full text-lg py-3 px-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-500 text-white py-3 rounded-xl font-semibold hover:bg-indigo-600 disabled:opacity-60"
          >
            {loading ? "Memverifikasi..." : "Verifikasi"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/auth/login")}
            className="w-full py-3 rounded-xl font-semibold border hover:bg-gray-50"
          >
            Kembali ke Login
          </button>
        </form>
      </div>
    </div>
  );
}
