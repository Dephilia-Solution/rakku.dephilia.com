"use client";

import { useState } from "react";
import type { OwnerDashboardOutlet } from "@rakku/shared-types";
import {
  useMerchantRequest,
  useMerchantRuntime,
  useMerchantToast,
} from "@/lib/merchant-runtime";
import { useOutletScope } from "@/components/outlet/OutletScopeProvider";
import { X, Check, Loader2 } from "lucide-react";

interface Props {
  outlet: OwnerDashboardOutlet;
}

/** Tab informasi outlet: ubah nama/alamat + status aktif. */
export default function OutletInfoSection({ outlet }: Props) {
  const request = useMerchantRequest();
  const showToast = useMerchantToast();
  const isActive = useMerchantRuntime()?.active;
  const { refreshOutlets } = useOutletScope();
  const [formName, setFormName] = useState(outlet.name);
  const [formAddress, setFormAddress] = useState(outlet.address ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isActive?.() === false) return;
    if (!formName.trim()) {
      showToast("error", "Nama outlet harus diisi");
      return;
    }
    setIsSaving(true);
    try {
      const res = await request(`/api/owner/outlets/${outlet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim(), address: formAddress.trim() }),
      });
      const data = await res.json();
      if (isActive?.() === false) return;
      if (!res.ok) {
        showToast("error", data.error || "Gagal menyimpan info outlet");
        return;
      }
      showToast("success", "Info outlet tersimpan");
      await refreshOutlets();
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Terjadi kesalahan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (isActive?.() === false) return;
    setIsToggling(true);
    try {
      const res = await request(`/api/owner/outlets/${outlet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggle_status: true }),
      });
      const data = await res.json();
      if (isActive?.() === false) return;
      if (!res.ok) {
        showToast("error", data.error || "Gagal mengubah status");
        return;
      }
      showToast(
        "success",
        `Outlet ${data.status === "active" ? "diaktifkan" : "dinonaktifkan"}`
      );
      await refreshOutlets();
    } catch {
      if (isActive?.() === false) return;
      showToast("error", "Terjadi kesalahan");
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h2 className="text-lg font-bold text-on-surface">Informasi Outlet</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Nama dan alamat outlet terlihat di kasir, menu QR, dan laporan.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Nama Outlet
          </label>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Outlet Utama"
            required
            className="w-full px-4 py-3 bg-surface-container-lowest border border-surface-container rounded-xl text-base text-on-surface placeholder-neutral-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Alamat{" "}
            <span className="text-on-surface-variant normal-case font-normal">(opsional)</span>
          </label>
          <textarea
            value={formAddress}
            onChange={(e) => setFormAddress(e.target.value)}
            placeholder="Jl. Contoh No. 1, Jakarta"
            rows={3}
            className="w-full px-4 py-3 bg-surface-container-lowest border border-surface-container rounded-xl text-base text-on-surface placeholder-neutral-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-on-primary text-sm font-semibold rounded-xl shadow-md shadow-primary/20 transition-all disabled:opacity-70 inline-flex items-center gap-2"
        >
          {isSaving && <Loader2 size={15} className="animate-spin" />}
          Simpan Perubahan
        </button>
      </form>

      <div className="bg-surface-container-lowest rounded-xl border border-surface-container p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-on-surface">Status Outlet</p>
          <p className="text-xs text-on-surface-variant">
            Outlet nonaktif tidak menerima transaksi kasir baru.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleStatus}
          disabled={isToggling}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all disabled:opacity-60 ${
            outlet.status === "active"
              ? "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              : "bg-primary text-on-primary shadow-md shadow-primary/20 hover:bg-primary/90"
          }`}
        >
          {isToggling ? (
            <Loader2 size={14} className="animate-spin" />
          ) : outlet.status === "active" ? (
            <X size={14} />
          ) : (
            <Check size={14} />
          )}
          {outlet.status === "active" ? "Nonaktifkan" : "Aktifkan"}
        </button>
      </div>

      <p className="text-xs text-on-surface-variant">
        Ingin menghapus outlet ini beserta seluruh datanya? Lakukan dari kartu
        outlet pada halaman <strong>Daftar Outlet</strong>.
      </p>
    </div>
  );
}
