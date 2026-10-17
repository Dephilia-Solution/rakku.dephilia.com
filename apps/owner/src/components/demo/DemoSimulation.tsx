"use client";

import { showToast } from "@rakku/ui";
import { useDemoSession, useDemoState } from "./DemoProvider";

export default function DemoSimulation({ kind, id }: { kind: "order-payment" | "subscription" | "withdrawal" | "email"; id: string | null }) {
  const { controller } = useDemoSession();
  const state = useDemoState();
  const run: typeof controller.sandbox.run = command => {
    try { return controller.sandbox.run(command, controller.sandbox.generation); }
    catch (error) { showToast("error", error instanceof Error ? error.message : "Simulasi gagal"); }
  };
  const button = "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-50";
  if (kind === "email") {
    const latest = state.outbox.filter(message => message.kind === "report").at(-1);
    return latest ? <pre className="whitespace-pre-wrap text-xs text-neutral-600">{latest.body}</pre> : null;
  }
  if (kind === "withdrawal") {
    const row = state.withdrawals.find(item => item.id === id);
    if (!row || !["requested", "processing"].includes(row.status)) return null;
    return <div className="mt-2 flex flex-wrap gap-2" data-demo-simulation={kind}>
      <button className={button} type="button" onClick={() => run({ type: "withdrawal.transition", id: row.id, status: row.status === "requested" ? "processing" : "completed" })}>{row.status === "requested" ? "Proses" : "Selesaikan"}</button>
      <button className={button} type="button" onClick={() => run({ type: "withdrawal.transition", id: row.id, status: "rejected", note: "Ditolak melalui simulator" })}>Tolak</button>
    </div>;
  }
  const row = kind === "subscription" ? state.invoices.find(item => item.id === id) : state.payments.find(item => item.id === id);
  if (!row || row.status !== "pending") return null;
  const transition = (status: "success" | "failed" | "expired" | "cancelled") => run(kind === "subscription"
    ? { type: "subscription.transition", id: row.id, status }
    : { type: "payment.transition", id: row.id, status });
  return <div className="mt-3 space-y-2" data-demo-simulation={kind}>
    <p className="text-xs text-neutral-500">{kind === "order-payment" ? "Simulasi QRIS — tidak menerima pembayaran nyata" : "Simulasi pembayaran"}</p>
    <div className="flex flex-wrap gap-2">
      <button className={button} type="button" onClick={() => transition("success")}>Berhasil</button>
      <button className={button} type="button" onClick={() => transition("failed")}>Gagal</button>
      <button className={button} type="button" onClick={() => transition("expired")}>Kedaluwarsa</button>
      <button className={button} type="button" onClick={() => transition("cancelled")}>Batal</button>
    </div>
  </div>;
}
