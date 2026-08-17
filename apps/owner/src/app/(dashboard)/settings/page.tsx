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
  QrCode,
  Copy,
  Check,
} from "lucide-react";
import { showToast } from "@rakku/ui";
import { QRCodeSVG } from "qrcode.react";

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

  // Menu QR
  const [qrOutlets, setQrOutlets] = useState<
    { id: string; name: string; qr_menu_slug: string; menu_url: string }[]
  >([]);
  const [isQrLoading, setIsQrLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const fetchMenuQr = async () => {
    setIsQrLoading(true);
    try {
      const res = await fetch("/api/owner/menu-qr");
      const data = await res.json();
      if (res.ok) {
        setQrOutlets(data.outlets ?? []);
      }
    } catch {
      showToast("error", "Gagal memuat QR menu");
    } finally {
      setIsQrLoading(false);
    }
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      showToast("success", "URL menu disalin");
      setTimeout(() => setCopiedUrl(null), 1500);
    } catch {
      showToast("error", "Gagal menyalin URL");
    }
  };

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
    fetchMenuQr();
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
        <div className="h-8 w-48 bg-surface-container rounded-lg animate-pulse" />
        <div className="h-64 bg-surface-container-lowest rounded-2xl border border-surface-container animate-pulse" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-12 text-center">
        <AlertCircle size={32} className="text-error mx-auto mb-2" />
        <p className="text-sm text-on-surface-variant">Data perusahaan tidak ditemukan</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[95vw] sm:max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Pengaturan</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Kelola profil dan keamanan perusahaan Anda.
        </p>
      </div>

      {/* Profile Section */}
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            <Building2 size={20} />
          </div>
          <div>
            <h2 className="font-bold text-on-surface">Profil Perusahaan</h2>
            <p className="text-xs text-on-surface-variant">
              Nama & informasi dasar perusahaan
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Nama Perusahaan
            </label>
            <div className="relative group">
              <Building2
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors"
              />
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 bg-surface-container-low border border-transparent rounded-xl text-base text-on-surface outline-none focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Kode Perusahaan
              </label>
              <div className="px-4 py-3 bg-surface-container rounded-xl text-sm font-mono text-on-surface-variant">
                {company.code}
              </div>
              <p className="text-xs text-on-surface-variant">
                Kode tidak bisa diubah
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Status
              </label>
              <div className="px-4 py-3 bg-surface-container rounded-xl text-sm text-on-surface-variant">
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
            className="inline-flex items-center gap-2 px-5 py-3 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-70"
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

      {/* Menu QR Section */}
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            <QrCode size={20} />
          </div>
          <div>
            <h2 className="font-bold text-on-surface">Menu QR</h2>
            <p className="text-xs text-on-surface-variant">
              Scan untuk buka menu digital tanpa login. Cetak & tempel di meja.
            </p>
          </div>
        </div>

        {isQrLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 bg-surface-container rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : qrOutlets.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            Belum ada outlet aktif untuk menu QR.
          </p>
        ) : (
          <div className="space-y-4">
            {qrOutlets.map((outlet) => (
              <div
                key={outlet.id}
                className="flex items-center gap-4 bg-surface-container rounded-xl p-4"
              >
                <div className="bg-white rounded-lg p-2 flex-shrink-0">
                  <QRCodeSVG value={outlet.menu_url} size={96} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-on-surface truncate">
                    {outlet.name}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-0.5 break-all font-mono">
                    {outlet.menu_url}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopy(outlet.menu_url)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                  >
                    {copiedUrl === outlet.menu_url ? (
                      <Check size={14} />
                    ) : (
                      <Copy size={14} />
                    )}
                    {copiedUrl === outlet.menu_url ? "Tersalin" : "Salin URL"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Password Section */}
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            <Lock size={20} />
          </div>
          <div>
            <h2 className="font-bold text-on-surface">
              Password Perusahaan
            </h2>
            <p className="text-xs text-on-surface-variant">
              Dipakai kasir di langkah 1 login POS
            </p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Password Baru
            </label>
            <div className="relative group">
              <Lock
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors"
              />
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-11 pr-11 py-3 bg-surface-container-low border border-transparent rounded-xl text-base text-on-surface placeholder-neutral-400 outline-none focus:bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <p className="text-xs text-on-surface-variant">
              Minimal 6 karakter. Beritahu karyawan setelah diubah.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSavingPassword}
            className="inline-flex items-center gap-2 px-5 py-3 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-70"
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
      <div className="bg-surface-container-low rounded-2xl border border-surface-container p-5">
        <div className="flex items-start gap-3">
          <Settings size={20} className="text-on-surface-variant flex-shrink-0 mt-0.5" />
          <div className="text-sm text-on-surface-variant space-y-1">
            <p className="font-semibold text-on-surface">Informasi</p>
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
              <span className="font-mono text-on-surface-variant">
                {company.slug || "-"}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
