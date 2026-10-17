"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, RotateCcw, LogOut, Monitor, Store, HelpCircle } from "lucide-react";
import { useDemoSession } from "./DemoProvider";

export default function DemoControls({ app, auth = false }: { app: "owner" | "pos"; auth?: boolean }) {
  const { reset, logout } = useDemoSession();
  const [open, setOpen] = useState(false), [help, setHelp] = useState(false), [offline, setOffline] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); setHelp(false); } };
    update(); window.addEventListener("online", update); window.addEventListener("offline", update);
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", key);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); };
  }, []);
  const item = "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-on-surface hover:bg-surface-container-low";
  return <div className={auth ? "fixed right-4 top-3 z-[60]" : "mb-3 flex items-center justify-end"}>
    <div ref={ref} className="relative flex items-center gap-2" aria-label="Kontrol demo">
      <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary" title="Mode Demo — semua perubahan hanya berlaku selama sesi ini.">Demo</span>
      {offline && <span role="status" className="text-xs text-warning">Offline · data di memori</span>}
      <button type="button" aria-label="Opsi demo" aria-expanded={open} className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container" onClick={() => setOpen(!open)}><MoreHorizontal size={18} /></button>
      {open && <div role="menu" className="absolute right-0 top-full z-[65] mt-2 w-60 rounded-xl border border-surface-container bg-white p-2 shadow-xl">
        <Link role="menuitem" href={app === "owner" ? "/demo/pos/login/select-outlet" : "/demo/owner/dashboard"} prefetch={false} className={item} onClick={() => setOpen(false)}>{app === "owner" ? <Store size={16} /> : <Monitor size={16} />}{app === "owner" ? "Buka kasir" : "Buka Owner"}</Link>
        {app === "pos" && <Link role="menuitem" href="/demo/pos/login/select-outlet" prefetch={false} className={item} onClick={() => setOpen(false)}><Store size={16} />Pilih outlet / kasir</Link>}
        <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); reset(); }}><RotateCcw size={16} />Reset Demo</button>
        <button role="menuitem" type="button" className={item} onClick={() => { setHelp(!help); }}><HelpCircle size={16} />Panduan singkat</button>
        {help && <p className="px-3 py-2 text-xs leading-relaxed text-on-surface-variant">Rani 111111 · Bima 222222 · Dita 333333 · Raka 444444. Coba transaksi, ubah produk, lalu buka laporan. Reset mengembalikan data awal.</p>}
        <button role="menuitem" type="button" className={`${item} text-error`} onClick={logout}><LogOut size={16} />Keluar Demo</button>
      </div>}
    </div>
  </div>;
}
