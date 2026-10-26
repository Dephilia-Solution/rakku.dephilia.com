"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Ingredient, StockMovementType } from "@rakku/shared-types";
import { Badge, EmptyState, Tabs } from "@rakku/ui";
import { ClipboardCheck, Eye, EyeOff, History, LockKeyhole, Package, Pencil, Plus, Search, ShoppingCart, Trash2, Upload } from "lucide-react";
import { useMerchantRuntime } from "@/lib/merchant-runtime";
import { usePlan } from "@/components/billing/PlanProvider";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import IngredientFormSlideOver from "@/components/inventory/IngredientFormSlideOver";
import { IngredientOpnameSlideOver, IngredientPurchaseSlideOver } from "@/components/inventory/InventoryStockForms";
import {
  InventoryError, inventoryInputClass, inventoryNumber,
  inventoryPrimaryClass, inventoryRupiah, inventorySecondaryClass,
  inventorySelectClass, useInventorySession,
} from "@/components/inventory/InventoryFormUI";
import ImportExcelPanel from "./ImportExcelPanel";
import { useOutletScope } from "./OutletScopeProvider";

interface Props { outletId: string; outletName: string }
type View = "ingredients" | "purchases" | "history";
type IngredientFilter = "all" | "active" | "inactive" | "low";

interface PurchaseRecord {
  id: string;
  supplier_name: string | null;
  total_amount: number;
  purchase_date: string;
  note: string | null;
  actor_name: string | null;
  items: { ingredient_id: string; ingredient_name: string; unit: string; quantity: number; unit_cost: number; subtotal: number }[];
}
interface MovementRecord {
  id: string;
  type: StockMovementType;
  quantity_change: number;
  ingredient_name: string;
  unit: string;
  created_at: string;
  note: string | null;
  actor_name: string | null;
}
interface Paginated { total: number; page: number; pageSize: number }

const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  purchase: "Pembelian", sale_deduction: "Penjualan", adjustment: "Penyesuaian", waste: "Bahan Terbuang",
};
const ADVANCED_MESSAGE = "Pembelian dan stock opname tersedia di paket dengan fitur inventori lanjutan.";
const iconButtonClass = "min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Tanggal tidak tersedia" : date.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function isLow(ingredient: Ingredient) { return ingredient.is_active && Number(ingredient.stock_quantity) <= Number(ingredient.min_stock_alert); }

/** GETs are cancelled independently when filters/pages change, as well as when the workspace closes. */
function useInventoryLoad<T>(outletId: string, url: string, revision = 0) {
  const { request, begin } = useInventorySession(outletId);
  const [attempt, setAttempt] = useState(0);
  const identity = useMemo(() => ({ url, revision, attempt, request, begin }), [url, revision, attempt, request, begin]);
  const [result, setResult] = useState<{ identity: typeof identity; data: T | null; error: string | null; planLimited: boolean } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const session = begin();
    if (!session) return () => controller.abort();
    const current = () => !controller.signal.aborted && session.active();
    void (async () => {
      try {
        const response = await request(url, { signal: controller.signal });
        const result = await response.json();
        if (!current()) return;
        if (!response.ok) {
          setResult({ identity, data: null, error: result.error ?? "Gagal memuat data inventori.", planLimited: result.code === "PLAN_LIMIT" });
          return;
        }
        setResult({ identity, data: result as T, error: null, planLimited: false });
      } catch {
        if (current()) setResult({ identity, data: null, error: "Gagal memuat data. Periksa koneksi lalu coba lagi.", planLimited: false });
      }
    })();
    return () => controller.abort();
  }, [url, request, begin, identity]);
  const completed = result?.identity === identity ? result : null;
  return { data: completed?.data ?? null, loading: !completed, error: completed?.error ?? null, planLimited: completed?.planLimited ?? false, retry: () => setAttempt((value) => value + 1) };
}

function LoadFeedback({ loading, error, planLimited, retry }: { loading: boolean; error: string | null; planLimited: boolean; retry: () => void }) {
  const { openUpgrade } = usePlan();
  if (loading) return <div role="status" aria-label="Memuat inventori" className="space-y-3">
    {[0, 1, 2].map((key) => <div key={key} className="h-24 rounded-xl bg-surface-container motion-safe:animate-pulse" />)}
    <span className="sr-only">Memuat data...</span>
  </div>;
  if (!error) return null;
  return <div className="space-y-3"><InventoryError message={error} />
    <button type="button" className={inventorySecondaryClass} onClick={planLimited ? () => openUpgrade(error) : retry}>{planLimited ? "Lihat Paket" : "Coba Lagi"}</button>
  </div>;
}

function Pagination({ total, page, pageSize, onChange, busy }: Paginated & { onChange: (page: number) => void; busy: boolean }) {
  if (!total) return null;
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  return <nav aria-label="Halaman riwayat" className="mt-4 flex flex-wrap items-center justify-between gap-3">
    <p className="text-xs text-on-surface-variant">{inventoryNumber(total)} catatan · Halaman {page} dari {pages}</p>
    <div className="flex gap-2">
      <button type="button" disabled={busy || page <= 1} onClick={() => onChange(page - 1)} className={inventorySecondaryClass}>Sebelumnya</button>
      <button type="button" disabled={busy || page >= pages} onClick={() => onChange(page + 1)} className={inventorySecondaryClass}>Berikutnya</button>
    </div>
  </nav>;
}

/** A key isolates drafts, responses, and pagination from another outlet or merchant runtime. */
export default function OutletIngredientsSection(props: Props) {
  const runtime = useMerchantRuntime();
  return <IngredientsWorkspace key={`${runtime?.scope ?? "owner"}:${props.outletId}`} {...props} />;
}

function IngredientsWorkspace({ outletId, outletName }: Props) {
  const { request, showToast, begin } = useInventorySession(outletId);
  const { refreshOutlets } = useOutletScope();
  const { hasFeature, openUpgrade } = usePlan();
  const advanced = hasFeature("inventory_advanced");
  const [view, setView] = useState<View>("ingredients");
  const [revision, setRevision] = useState(0);
  const list = useInventoryLoad<Ingredient[]>(outletId, `/api/owner/ingredients?outlet_id=${encodeURIComponent(outletId)}`, revision);
  const ingredients = list.data ?? [];
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<IngredientFilter>("all");
  const [historyIngredient, setHistoryIngredient] = useState("");
  const [form, setForm] = useState<{ ingredient: Ingredient | null } | null>(null);
  const [opname, setOpname] = useState<Ingredient | null>(null);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [deleting, setDeleting] = useState<Ingredient | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const pending = useRef(false);

  const refresh = () => { setRevision((value) => value + 1); void refreshOutlets(); };
  const guardAdvanced = (action: () => void) => { if (advanced) action(); else openUpgrade(ADVANCED_MESSAGE); };
  const startPurchase = () => guardAdvanced(() => {
    if (!ingredients.some((ingredient) => ingredient.is_active)) {
      showToast("error", "Tambahkan atau aktifkan bahan baku sebelum mencatat pembelian."); return;
    }
    setShowPurchase(true);
  });

  const mutate = async (ingredient: Ingredient, remove = false) => {
    const session = begin();
    if (!session || pending.current) return;
    pending.current = true;
    setBusyId(ingredient.id);
    setMutationError(null);
    try {
      const response = await request(remove ? `/api/owner/ingredients?id=${encodeURIComponent(ingredient.id)}&outlet_id=${encodeURIComponent(outletId)}` : "/api/owner/ingredients", {
        method: remove ? "DELETE" : "PATCH", signal: session.signal,
        ...(remove ? {} : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: ingredient.id, outlet_id: outletId, name: ingredient.name, unit: ingredient.unit, min_stock_alert: ingredient.min_stock_alert, cost_per_unit: ingredient.cost_per_unit, is_active: !ingredient.is_active }),
        }),
      });
      const data = await response.json();
      if (!session.active()) return;
      if (remove) setDeleting(null);
      if (!response.ok) {
        const message = data.error ?? "Gagal mengubah bahan baku.";
        setMutationError(message);
        showToast("error", message);
        if (data.code === "PLAN_LIMIT") openUpgrade(message);
        return;
      }
      if (remove && historyIngredient === ingredient.id) setHistoryIngredient("");
      showToast("success", remove ? "Bahan baku dihapus" : `${ingredient.name} ${ingredient.is_active ? "dinonaktifkan" : "diaktifkan"}`);
      refresh();
    } catch {
      if (!session.active()) return;
      if (remove) setDeleting(null);
      setMutationError("Gagal mengubah bahan baku. Periksa koneksi lalu coba lagi.");
    } finally {
      pending.current = false;
      if (session.active()) setBusyId(null);
    }
  };

  const filtered = ingredients.filter((ingredient) => {
    if (!ingredient.name.toLocaleLowerCase("id-ID").includes(search.trim().toLocaleLowerCase("id-ID"))) return false;
    if (filter === "active") return ingredient.is_active;
    if (filter === "inactive") return !ingredient.is_active;
    if (filter === "low") return isLow(ingredient);
    return true;
  });
  const lowCount = ingredients.filter(isLow).length;
  const actions = (ingredient: Ingredient) => <div className="flex flex-wrap items-center justify-end gap-1">
    <button type="button" disabled={!!busyId || list.loading} onClick={() => setForm({ ingredient })} aria-label={`Edit ${ingredient.name}`} title="Edit bahan" className={iconButtonClass}><Pencil size={17} /></button>
    <button type="button" disabled={!!busyId || list.loading} onClick={() => guardAdvanced(() => setOpname(ingredient))} aria-label={`Stock opname ${ingredient.name}`} title={advanced ? "Stock opname" : "Stock opname · Upgrade paket"} className={iconButtonClass}><ClipboardCheck size={18} /></button>
    <button type="button" disabled={!!busyId || list.loading} onClick={() => void mutate(ingredient)} aria-label={`${ingredient.is_active ? "Nonaktifkan" : "Aktifkan"} ${ingredient.name}`} title={ingredient.is_active ? "Nonaktifkan" : "Aktifkan"} className={iconButtonClass}>{ingredient.is_active ? <EyeOff size={18} /> : <Eye size={18} />}</button>
    <button type="button" disabled={!!busyId || list.loading} onClick={() => setDeleting(ingredient)} aria-label={`Hapus ${ingredient.name}`} title="Hapus bahan" className={`${iconButtonClass} text-error`}><Trash2 size={18} /></button>
  </div>;
  const stockBadge = (ingredient: Ingredient) => isLow(ingredient) ? <span className="text-xs font-semibold text-error">{Number(ingredient.stock_quantity) <= 0 ? "Stok habis" : "Stok menipis"}</span> : null;

  return <section className="min-w-0 space-y-5" aria-label={`Bahan baku ${outletName}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-bold text-on-surface">Bahan Baku</h2><p className="mt-1 text-sm text-on-surface-variant">Kelola bahan dan pergerakan stok untuk {outletName}.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setView("ingredients"); setShowImport((value) => !value); }} className={inventorySecondaryClass}><Upload size={16} />Import Excel</button>
        {view === "purchases" ? <button type="button" disabled={list.loading || !!list.error} onClick={startPurchase} className={inventoryPrimaryClass}>{advanced ? <Plus size={16} /> : <LockKeyhole size={16} />}Catat Pembelian</button>
          : <button type="button" onClick={() => setForm({ ingredient: null })} className={inventoryPrimaryClass}><Plus size={16} />Tambah Bahan</button>}
      </div>
    </div>
    <div className="overflow-x-auto pb-1">
      <Tabs active={view} onChange={(key) => setView(key as View)} className="[&_button]:min-h-11" tabs={[
        { key: "ingredients", label: "Daftar Bahan" }, { key: "purchases", label: "Pembelian" }, { key: "history", label: "Riwayat Stok" },
      ]} />
    </div>
    {showImport && <ImportExcelPanel key={outletId} domain="ingredients" outletId={outletId} outletName={outletName} onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); refresh(); }} />}
    <InventoryError message={mutationError} />

    {view === "ingredients" && <>
      {!list.loading && !list.error && <div className="grid grid-cols-3 gap-2 sm:gap-4 rounded-xl bg-surface-container-lowest p-4">
        <div><p className="text-xs text-on-surface-variant">Total Bahan</p><p className="mt-1 text-xl font-bold text-on-surface tabular-nums">{inventoryNumber(ingredients.length)}</p></div>
        <div><p className="text-xs text-on-surface-variant">Bahan Aktif</p><p className="mt-1 text-xl font-bold text-primary tabular-nums">{inventoryNumber(ingredients.filter((ingredient) => ingredient.is_active).length)}</p></div>
        <button type="button" onClick={() => setFilter("low")} className="min-h-11 text-left rounded-lg hover:bg-surface-container-low active:scale-[0.98]" aria-label={`Tampilkan ${lowCount} bahan dengan stok menipis`}><span className="text-xs text-on-surface-variant">Stok Menipis</span><span className={`mt-1 block text-xl font-bold tabular-nums ${lowCount ? "text-error" : "text-on-surface"}`}>{inventoryNumber(lowCount)}</span></button>
      </div>}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search size={17} aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input type="search" aria-label="Cari bahan baku" placeholder="Cari nama bahan..." value={search} onChange={(event) => setSearch(event.target.value)} className={`${inventoryInputClass} pl-11`} />
        </div>
        <select aria-label="Filter status bahan" value={filter} onChange={(event) => setFilter(event.target.value as IngredientFilter)} className={`${inventorySelectClass} sm:max-w-[210px]`}>
          <option value="all">Semua Bahan</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option><option value="low">Stok Menipis</option>
        </select>
      </div>
      <LoadFeedback {...list} />
      {!list.loading && !list.error && (filtered.length ? <>
        <div className="hidden lg:block rounded-xl bg-surface-container-lowest overflow-x-auto">
          <table className="w-full text-sm"><caption className="sr-only">Daftar bahan baku {outletName}</caption>
            <thead className="bg-surface-container-low text-on-surface-variant"><tr>{["Bahan", "Stok / Minimum", "Harga per Satuan", "Aksi"].map((label) => <th scope="col" key={label} className={`px-4 py-3 text-xs font-semibold ${label === "Aksi" ? "text-right" : "text-left"}`}>{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-surface-container">{filtered.map((ingredient) => <tr key={ingredient.id} aria-busy={busyId === ingredient.id}>
              <td className="px-4 py-4"><p className="font-semibold text-on-surface break-words">{ingredient.name}</p><div className="mt-1"><Badge variant={ingredient.is_active ? "active" : "inactive"}>{ingredient.is_active ? "Aktif" : "Nonaktif"}</Badge></div></td>
              <td className="px-4 py-4"><p className="font-semibold tabular-nums text-on-surface">{inventoryNumber(ingredient.stock_quantity)} {ingredient.unit}</p><p className="text-xs text-on-surface-variant">Min. {inventoryNumber(ingredient.min_stock_alert)} {ingredient.unit}</p>{stockBadge(ingredient)}</td>
              <td className="px-4 py-4 text-on-surface tabular-nums">{inventoryRupiah(ingredient.cost_per_unit)}<span className="block text-xs text-on-surface-variant">per {ingredient.unit}</span></td>
              <td className="px-3 py-3">{actions(ingredient)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="grid gap-3 lg:hidden">{filtered.map((ingredient) => <article key={ingredient.id} className="rounded-xl bg-surface-container-lowest p-4" aria-busy={busyId === ingredient.id}>
          <div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-on-surface break-words min-w-0">{ingredient.name}</h3><Badge variant={ingredient.is_active ? "active" : "inactive"}>{ingredient.is_active ? "Aktif" : "Nonaktif"}</Badge></div>
          <dl className="my-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-on-surface-variant">Stok / Minimum</dt><dd className="mt-1 text-on-surface tabular-nums">{inventoryNumber(ingredient.stock_quantity)} / {inventoryNumber(ingredient.min_stock_alert)} {ingredient.unit}</dd>{stockBadge(ingredient)}</div><div><dt className="text-xs text-on-surface-variant">Harga per {ingredient.unit}</dt><dd className="mt-1 text-on-surface tabular-nums break-words">{inventoryRupiah(ingredient.cost_per_unit)}</dd></div></dl>
          <div className="border-t border-surface-container pt-2">{actions(ingredient)}</div>
        </article>)}</div>
      </> : <div className="rounded-xl bg-surface-container-lowest"><EmptyState icon={Package} title={ingredients.length ? "Bahan tidak ditemukan" : "Belum ada bahan baku"} description={ingredients.length ? "Coba nama atau filter lain." : "Tambahkan bahan secara manual atau gunakan Import Excel."} /></div>)}
      {!advanced && <p className="text-sm text-on-surface-variant">Pengelolaan bahan tersedia di paket Anda. <button type="button" onClick={() => openUpgrade(ADVANCED_MESSAGE)} className="min-h-11 inline-flex items-center font-semibold text-primary underline underline-offset-2">Buka pembelian & stock opname</button></p>}
    </>}

    {view === "purchases" && (advanced ? <PurchaseHistory key={revision} outletId={outletId} /> : <div className="rounded-xl bg-surface-container-lowest p-6 space-y-3">
      <LockKeyhole size={24} className="text-primary" /><h3 className="font-semibold text-on-surface">Pembelian & Stock Opname</h3><p className="text-sm text-on-surface-variant">{ADVANCED_MESSAGE}</p><button type="button" onClick={() => openUpgrade(ADVANCED_MESSAGE)} className={inventoryPrimaryClass}>Lihat Paket</button>
    </div>)}
    {view === "history" && <StockHistory key={revision} outletId={outletId} ingredients={ingredients} ingredientId={historyIngredient} onIngredientChange={setHistoryIngredient} />}

    <IngredientFormSlideOver open={!!form} onClose={() => setForm(null)} outletId={outletId} ingredient={form?.ingredient} onSaved={() => refresh()} />
    {opname && <IngredientOpnameSlideOver key={opname.id} outletId={outletId} ingredient={opname} onClose={() => setOpname(null)} onSaved={refresh} />}
    {showPurchase && <IngredientPurchaseSlideOver outletId={outletId} ingredients={ingredients} onClose={() => setShowPurchase(false)} onSaved={refresh} />}
    <div className="[&_button]:min-h-11 [&_button]:min-w-11">
      <ConfirmDialog isOpen={!!deleting} loading={!!busyId} onClose={() => { if (!pending.current) setDeleting(null); }} onConfirm={() => { if (deleting) void mutate(deleting, true); }} title="Hapus Bahan Baku"
        message={`Hapus ${deleting?.name ?? "bahan ini"}? Bahan yang dipakai dalam resep atau memiliki riwayat tidak dapat dihapus. Gunakan Nonaktifkan untuk menyimpan riwayatnya.`} />
    </div>
  </section>;
}

function PurchaseHistory({ outletId }: { outletId: string }) {
  const [page, setPage] = useState(1);
  const result = useInventoryLoad<Paginated & { purchases: PurchaseRecord[] }>(outletId, `/api/owner/purchases?outlet_id=${encodeURIComponent(outletId)}&page=${page}`);
  return <div>
    <LoadFeedback {...result} />
    {!result.loading && !result.error && (result.data?.purchases.length ? <div className="space-y-3">{result.data.purchases.map((purchase) => <article key={purchase.id} className="rounded-xl bg-surface-container-lowest p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-on-surface break-words">{purchase.supplier_name || "Tanpa supplier"}</h3><p className="mt-1 text-xs text-on-surface-variant">{formatDate(purchase.purchase_date)} · {purchase.actor_name || "Pengguna tidak tersedia"}</p></div><strong className="text-primary tabular-nums break-all">{inventoryRupiah(purchase.total_amount)}</strong></div>
      {purchase.note && <p className="mt-3 text-sm text-on-surface-variant whitespace-pre-wrap break-words">{purchase.note}</p>}
      <details className="mt-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-primary">Lihat {purchase.items.length} bahan</summary>
        <ul className="divide-y divide-surface-container">{purchase.items.map((item) => <li key={item.ingredient_id} className="py-3 flex flex-wrap justify-between gap-2 text-sm"><div className="min-w-0"><p className="font-medium text-on-surface break-words">{item.ingredient_name}</p><p className="text-xs text-on-surface-variant">{inventoryNumber(item.quantity)} {item.unit} × {inventoryRupiah(item.unit_cost)}</p></div><span className="text-on-surface tabular-nums">{inventoryRupiah(item.subtotal)}</span></li>)}</ul>
      </details>
    </article>)}</div> : <div className="rounded-xl bg-surface-container-lowest"><EmptyState icon={ShoppingCart} title="Belum ada pembelian" description="Catat pembelian pertama untuk menambah stok bahan secara otomatis." /></div>)}
    {result.data && <Pagination {...result.data} page={page} onChange={setPage} busy={result.loading} />}
  </div>;
}

function StockHistory({ outletId, ingredients, ingredientId, onIngredientChange }: { outletId: string; ingredients: Ingredient[]; ingredientId: string; onIngredientChange: (id: string) => void }) {
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ outlet_id: outletId, page: String(page) });
  if (ingredientId) query.set("ingredient_id", ingredientId);
  const result = useInventoryLoad<Paginated & { movements: MovementRecord[] }>(outletId, `/api/owner/stock-movements?${query}`);
  return <div className="space-y-4">
    <select aria-label="Filter riwayat berdasarkan bahan" value={ingredientId} onChange={(event) => { setPage(1); onIngredientChange(event.target.value); }} className={`${inventorySelectClass} sm:max-w-sm`}>
      <option value="">Semua Bahan</option>{ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}{ingredient.is_active ? "" : " (Nonaktif)"}</option>)}
    </select>
    <LoadFeedback {...result} />
    {!result.loading && !result.error && (result.data?.movements.length ? <div className="rounded-xl bg-surface-container-lowest divide-y divide-surface-container">{result.data.movements.map((movement) => <article key={movement.id} className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold text-on-surface break-words">{movement.ingredient_name}</h3><p className="mt-1 text-xs text-on-surface-variant">{MOVEMENT_LABELS[movement.type] ?? movement.type} · {formatDate(movement.created_at)}</p></div><strong className={`tabular-nums ${Number(movement.quantity_change) < 0 ? "text-error" : "text-primary"}`}>{Number(movement.quantity_change) > 0 ? "+" : ""}{inventoryNumber(movement.quantity_change)} {movement.unit}</strong></div>
      {movement.note && <p className="mt-2 text-sm text-on-surface-variant whitespace-pre-wrap break-words">{movement.note}</p>}
      <p className="mt-2 text-xs text-on-surface-variant">Oleh {movement.actor_name || "Sistem / pengguna tidak tersedia"}</p>
    </article>)}</div> : <div className="rounded-xl bg-surface-container-lowest"><EmptyState icon={History} title="Belum ada riwayat stok" description="Stok awal, pembelian, penjualan, dan penyesuaian akan tercatat di sini." /></div>)}
    {result.data && <Pagination {...result.data} page={page} onChange={setPage} busy={result.loading} />}
  </div>;
}
