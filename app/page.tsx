"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import toast, { Toaster } from "react-hot-toast";
import Image from "next/image";

export default function LoginPage() {
  const toastDuration = 3000;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTwoFA, setIsTwoFA] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const router = useRouter();

  function getRedirectPath(role?: string) {
    switch (role?.toLowerCase()) {
      case "admin":
        return "/dashboard/admin";
      case "kasir":
        return "/dashboard/kasir";
      case "kepala_gudang":
        return "/dashboard/kepala_gudang";
      default:
        return "/dashboard";
    }
  }

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        if (data?.twoFARequired) {
          toast.success("Masukkan kode OTP dari Authenticator", {
            duration: toastDuration,
          });
          setIsTwoFA(true);
          setCode("");
        } else {
          router.push(getRedirectPath(data?.user?.role));
          setUsername("");
          setPassword("");
        }
      } else {
        toast.error(data?.error || "Terjadi kesalahan login", {
          duration: toastDuration,
        });
      }
    } catch (err) {
      toast.error("Gagal menghubungi server", { duration: toastDuration });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setVerifying(true);

    try {
      const res = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        router.push(getRedirectPath(data?.user?.role));
      } else {
        toast.error(data?.error || "Kode OTP salah", {
          duration: toastDuration,
        });
      }
    } catch {
      toast.error("Gagal menghubungi server", { duration: toastDuration });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="lg:flex bg-white">
      <Toaster position="top-right" />
      <div className="lg:w-1/2 xl:max-w-screen-sm">
        <div className="py-12 bg-white lg:bg-white flex justify-center lg:justify-start lg:px-12">
          <div className="cursor-pointer flex items-center">
            <div>
              <Image
                src="/sembako.png"
                alt="logo"
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-3xl text-indigo-800 tracking-wide ml-2 font-semibold">
              AW SEMBAKO
            </div>
          </div>
        </div>

        <div className="mt-10 px-12 sm:px-24 md:px-48 lg:px-12 lg:mt-16 xl:px-24 xl:max-w-2xl">
          {!isTwoFA ? (
            <>
              <h2 className="text-center text-4xl text-indigo-900 font-display font-semibold lg:text-left xl:text-5xl xl:text-bold">
                Log in
              </h2>

              <div className="mt-12">
                <form onSubmit={handleLogin}>
                  <div className="mt-8">
                    <div className="text-sm font-bold text-gray-700 tracking-wide">
                      Username
                    </div>
                    <input
                      className="w-full text-lg py-2 border-b border-gray-300 focus:outline-none focus:border-indigo-500"
                      type="text"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mt-8">
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-bold text-gray-700 tracking-wide">
                        Password
                      </div>
                    </div>
                    <input
                      className="w-full text-lg py-2 border-b border-gray-300 focus:outline-none focus:border-indigo-500"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mt-10">
                    {loading ? (
                      <div className="bg-indigo-500 text-gray-100 p-4 w-full rounded-full tracking-wide font-semibold font-display focus:outline-none focus:shadow-outline hover:bg-indigo-600 shadow-lg flex justify-center items-center">
                        <svg
                          className="animate-spin h-7 w-7 text-purple-100"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          ></path>
                        </svg>
                      </div>
                    ) : (
                      <button
                        className="bg-indigo-500 text-gray-100 p-4 w-full rounded-full tracking-wide font-semibold font-display focus:outline-none focus:shadow-outline hover:bg-indigo-600 shadow-lg"
                        type="submit"
                      >
                        Log In
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-center text-4xl text-indigo-900 font-display font-semibold lg:text-left xl:text-5xl xl:text-bold">
                Verifikasi 2FA
              </h2>
              <p className="text-gray-600 mt-4">
                Masukkan kode 6 digit dari aplikasi Authenticator.
              </p>

              <form onSubmit={handleVerify} className="mt-6">
                <input
                  className="w-full text-lg py-2 border-b border-gray-300 focus:outline-none focus:border-indigo-500"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                />

                <div className="mt-10">
                  <button
                    type="submit"
                    disabled={verifying}
                    className="bg-indigo-500 text-gray-100 p-4 w-full rounded-full tracking-wide font-semibold font-display focus:outline-none focus:shadow-outline hover:bg-indigo-600 shadow-lg disabled:opacity-60"
                  >
                    {verifying ? "Memverifikasi..." : "Verifikasi"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Bagian kanan untuk gambar ilustrasi */}
      <div className="hidden lg:flex items-center justify-center bg-indigo-100 flex-1 h-screen">
        <div className="max-w-xs transform duration-200 hover:scale-150 cursor-pointer">
          <Image
            src="/sembako.png"
            className="w-full h-full object-cover"
            alt="logo"
            width={200}
            height={200}
          />
        </div>
      </div>
    </div>
  );
}
