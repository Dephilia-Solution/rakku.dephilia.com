"use client";

import { useState } from "react";
import type { OwnerDashboardOutlet } from "@rakku/shared-types";
import {
  useMerchantRequest,
  useMerchantRuntime,
  useMerchantToast,
} from "@/lib/merchant-runtime";
import { useOutletScope } from "@/components/outlet/OutletScopeProvider";
import { OwnerSection } from "@/components/ui/OwnerPrimitives";
import { MerchantLink as Link } from "@/lib/merchant-runtime";
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
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <OwnerSection title="Informasi Outlet" description="Nama dan alamat outlet terlihat di kasir, menu QR, dan laporan.">
      <form onSubmit={handleSave} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="outlet-info-name" className="text-sm font-medium text-on-surface">
            Nama Outlet
          </label>
          <input
            id="outlet-info-name"
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Outlet Utama"
            required
            className="w-full px-4 py-3 bg-surface-container-lowest border border-surface-container rounded-xl text-base text-on-surface placeholder-neutral-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="outlet-info-address" className="text-sm font-medium text-on-surface">
            Alamat{" "}
            <span className="text-on-surface-variant normal-case font-normal">(opsional)</span>
          </label>
          <textarea
            id="outlet-info-address"
            value={formAddress}
            onChange={(e) => setFormAddress(e.target.value)}
            placeholder="Jl. Contoh No. 1, Jakarta"
            rows={3}
            className="w-full px-4 py-3 bg-surface-container-lowest border border-surface-container rounded-xl text-base text-on-surface placeholder-neutral-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
          />
        </div>
        <div className="flex justify-end border-t border-surface-container pt-4"><button
          type="submit"
          disabled={isSaving}
          className="owner-button owner-button--primary w-full sm:w-auto"
        >
          {isSaving && <Loader2 size={15} className="animate-spin" />}
          Simpan Perubahan
        </button></div>
      </form>
      </OwnerSection>

      <div className="min-w-0 space-y-4">
      <OwnerSection title="Status Outlet" description="Outlet nonaktif tidak menerima transaksi kasir baru.">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${outlet.status === "active" ? "bg-primary/10 text-primary" : "bg-surface-container text-on-surface-variant"}`}>{outlet.status === "active" ? "Aktif" : "Nonaktif"}</span>
        <button
          type="button"
          onClick={handleToggleStatus}
          disabled={isToggling}
          className={`owner-button ${outlet.status === "active" ? "owner-button--secondary" : "owner-button--primary"}`}
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
      </OwnerSection>

      <p className="px-1 text-xs leading-relaxed text-on-surface-variant">
        Ingin menghapus outlet ini beserta seluruh datanya? Lakukan dari kartu
        outlet pada halaman <Link href="/outlets" className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2">Daftar Outlet</Link>.
      </p>
      </div>
    </div>
  );
}
