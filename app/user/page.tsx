"use client";
import React, { useState } from "react";
import { User, Lock } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    console.log("Login:", { username, password });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Section - Login Form */}
      <div className="w-full lg:w-1/2 bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-5xl font-bold text-gray-900 mb-3 tracking-tight">
              LOGIN
            </h1>
            <p className="text-gray-500 text-lg">
              Welcome back! Please enter your details
            </p>
          </div>

          {/* Login Form */}
          <div className="space-y-4">
            {/* Username Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border-0 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border-0 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
              />
            </div>

            {/* Login Button */}
            <div className="flex justify-center pt-6">
              <button
                onClick={handleLogin}
                className="px-16 py-4 bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 text-white rounded-2xl font-semibold hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 hover:-translate-y-1"
              >
                Login Now
              </button>
            </div>
          </div>

          {/* Additional Links */}
          <div className="mt-8 text-center space-y-4">
            <button className="text-purple-600 hover:text-purple-700 font-medium transition-colors">
              Forgot Password?
            </button>
            <p className="text-gray-600">
              Don't have an account?{" "}
              <button className="text-purple-600 hover:text-purple-700 font-semibold transition-colors">
                Sign Up
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Right Section - Purple Gradient */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-700 items-center justify-center relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-purple-400 rounded-full opacity-30 blur-3xl animate-pulse"></div>
          <div
            className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-600 rounded-full opacity-20 blur-3xl animate-pulse"
            style={{ animationDelay: "2s" }}
          ></div>
          <div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-pink-500 rounded-full opacity-10 blur-3xl animate-pulse"
            style={{ animationDelay: "1s" }}
          ></div>
        </div>

        {/* Decorative Grid Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
              backgroundSize: "50px 50px",
            }}
          ></div>
        </div>

        {/* Glass Card with Icon */}
        <div className="relative z-10 w-96 h-[500px] bg-white bg-opacity-10 backdrop-blur-sm rounded-3xl border border-white border-opacity-20 flex items-center justify-center shadow-2xl">
          <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-2xl animate-pulse">
            <svg
              className="w-16 h-16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z"
                fill="#9333EA"
                stroke="#9333EA"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 22V12H15V22"
                fill="white"
                stroke="#9333EA"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="8" r="1.5" fill="white" />
            </svg>
          </div>

          {/* Floating Elements */}
          <div
            className="absolute top-10 right-10 w-20 h-20 bg-white bg-opacity-20 rounded-2xl backdrop-blur-md animate-bounce"
            style={{ animationDuration: "3s" }}
          ></div>
          <div
            className="absolute bottom-10 left-10 w-16 h-16 bg-white bg-opacity-20 rounded-full backdrop-blur-md animate-bounce"
            style={{ animationDuration: "4s", animationDelay: "1s" }}
          ></div>
        </div>
      </div>
    </div>
  );
}
