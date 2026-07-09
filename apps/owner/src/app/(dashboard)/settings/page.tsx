"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Building2,
  Lock,
  Save,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { showToast, ToastContainer } from "@rakku/ui";

export default function OwnerSettingsPage() {
  const [company, setCompany] = useState<{
    id: string;
    name: string;
    code: string;
    slug: string | null;
    logo_url: string | null;
    status: string;
    created_at: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Profile form
  const [formName, setFormName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password form
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const fetchCompany = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/owner/settings");
      const data = await res.json();
      if (res.ok) {
        setCompany(data.company);
        setFormName(data.company.name);
      }
    } catch {
      showToast("error", "Gagal memuat data perusahaan");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompany();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast("error", "Nama perusahaan harus diisi");
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await fetch("/api/owner/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error || "Gagal mengupdate profil");
        setIsSavingProfile(false);
        return;
      }
      showToast("success", "Profil berhasil diupdate");
      fetchCompany();
    } catch {
      showToast("error", "Terjadi kesalahan");
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast("error", "Password minimal 6 karakter");
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await fetch("/api/owner/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_company_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", data.error || "Gagal mengubah password");
        setIsSavingPassword(false);
        return;
      }
      showToast("success", "Password perusahaan berhasil diubah");
      setNewPassword("");
    } catch {
      showToast("error", "Terjadi kesalahan");
      setIsSavingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-neutral-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-white rounded-2xl border border-neutral-200 animate-pulse" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
        <AlertCircle size={32} className="text-danger mx-auto mb-2" />
        <p className="text-sm text-neutral-400">Data perusahaan tidak ditemukan</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[95vw] sm:max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Pengaturan</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Kelola profil dan keamanan perusahaan Anda.
        </p>
      </div>

      {/* Profile Section */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-forest/10 rounded-xl flex items-center justify-center text-forest">
            <Building2 size={20} />
          </div>
          <div>
            <h2 className="font-bold text-neutral-900">Profil Perusahaan</h2>
            <p className="text-xs text-neutral-400">
              Nama & informasi dasar perusahaan
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
              Nama Perusahaan
            </label>
            <div className="relative group">
              <Building2
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-forest transition-colors"
              />
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-transparent rounded-xl text-base text-neutral-900 outline-none focus:bg-white focus:border-forest focus:ring-1 focus:ring-forest transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                Kode Perusahaan
              </label>
              <div className="px-4 py-3 bg-neutral-100 rounded-xl text-sm font-mono text-neutral-600">
                {company.code}
              </div>
              <p className="text-xs text-neutral-400">
                Kode tidak bisa diubah
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                Status
              </label>
              <div className="px-4 py-3 bg-neutral-100 rounded-xl text-sm text-neutral-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-success rounded-full"></span>
                  {company.status === "active" ? "Aktif" : company.status}
                </span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSavingProfile}
            className="inline-flex items-center gap-2 px-5 py-3 bg-forest hover:bg-forest-dark text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-70"
          >
            {isSavingProfile ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save size={16} />
                Simpan
              </>
            )}
          </button>
        </form>
      </div>

      {/* Password Section */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-forest/10 rounded-xl flex items-center justify-center text-forest">
            <Lock size={20} />
          </div>
          <div>
            <h2 className="font-bold text-neutral-900">
              Password Perusahaan
            </h2>
            <p className="text-xs text-neutral-400">
              Dipakai kasir di langkah 1 login POS
            </p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
              Password Baru
            </label>
            <div className="relative group">
              <Lock
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-forest transition-colors"
              />
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-11 pr-11 py-3 bg-neutral-50 border border-transparent rounded-xl text-base text-neutral-900 placeholder-neutral-400 outline-none focus:bg-white focus:border-forest focus:ring-1 focus:ring-forest transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-forest transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <p className="text-xs text-neutral-400">
              Minimal 6 karakter. Beritahu karyawan setelah diubah.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSavingPassword}
            className="inline-flex items-center gap-2 px-5 py-3 bg-forest hover:bg-forest-dark text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-70"
          >
            {isSavingPassword ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Lock size={16} />
                Ubah Password
              </>
            )}
          </button>
        </form>
      </div>

      {/* Info Card */}
      <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-5">
        <div className="flex items-start gap-3">
          <Settings size={20} className="text-neutral-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-neutral-600 space-y-1">
            <p className="font-semibold text-neutral-900">Informasi</p>
            <p>
              Perusahaan terdaftar sejak{" "}
              {new Date(company.created_at).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              .
            </p>
            <p>
              Slug:{" "}
              <span className="font-mono text-neutral-500">
                {company.slug || "-"}
              </span>
            </p>
          </div>
        </div>
      </div>

      <ToastContainer />
    </div>
  );
}
