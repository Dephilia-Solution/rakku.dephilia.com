"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setPending(true);
    try {
      const token = new URLSearchParams(window.location.search).get("token");
      if (token) {
        const result = await authClient.resetPassword({ token, newPassword: password });
        if (!result.error) window.history.replaceState(null, "", "/reset-password");
        setMessage(result.error ? "Link tidak valid atau kedaluwarsa." : "Password diperbarui. Silakan login kembali.");
      } else {
        await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/reset-password` });
        setMessage("Jika akun tersedia, link reset akan dikirim ke email Anda.");
      }
    } catch { setMessage("Layanan tidak dapat dihubungi. Coba lagi."); }
    finally { setPending(false); }
  }
  return <main className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Reset password Superadmin</h1>
      <label className="block text-sm">Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className="mt-2 w-full rounded-lg border p-3" /></label>
      <label className="block text-sm">Password baru (setelah membuka link reset)<input type="password" minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className="mt-2 w-full rounded-lg border p-3" /></label>
      {message && <p role="status" className="text-sm">{message}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-forest p-3 text-white disabled:opacity-50">{pending ? "Memproses…" : "Lanjutkan"}</button>
      <Link href="/login" className="block text-center text-sm text-forest">Kembali ke login</Link>
    </form>
  </main>;
}
