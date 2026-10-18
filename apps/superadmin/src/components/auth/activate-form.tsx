"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ActivateSuperadmin() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function activate(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
      const response = await fetch("/api/superadmin/auth/activate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, name, password }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Aktivasi gagal"); return; }
      window.history.replaceState(null, "", "/activate");
      router.replace("/companies"); router.refresh();
    } catch { setError("Tidak dapat menghubungi server"); }
    finally { setPending(false); }
  }
  return <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
    <form onSubmit={activate} className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Aktivasi Superadmin</h1>
      <p className="text-sm text-neutral-500">Buat password baru untuk akun Neon Anda.</p>
      <label className="block text-sm">Nama<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} autoComplete="name" className="mt-2 w-full rounded-lg border p-3" /></label>
      <label className="block text-sm">Password<input required minLength={12} maxLength={128} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className="mt-2 w-full rounded-lg border p-3" /></label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-forest p-3 font-semibold text-white disabled:opacity-50">{pending ? "Mengaktifkan…" : "Aktifkan akun"}</button>
    </form>
  </main>;
}
