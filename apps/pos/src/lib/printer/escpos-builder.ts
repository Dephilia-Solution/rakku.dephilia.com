import { formatCurrency } from "@/lib/dummy-data";
import {
  PaperWidth,
  PAPER_WIDTH_STORAGE_KEY,
  ReceiptData,
  ReceiptItem,
} from "./types";

export function getPaperWidth(): PaperWidth {
  if (typeof window === "undefined") return 58;
  try {
    const raw = window.localStorage.getItem(PAPER_WIDTH_STORAGE_KEY);
    if (raw === "80") return 80;
    return 58;
  } catch {
    return 58;
  }
}

export function getCharWidth(): number {
  return getPaperWidth() === 80 ? 48 : 32;
}

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

class EscPosBuffer {
  private bytes: number[] = [];

  init(): this {
    this.bytes.push(ESC, 0x40);
    return this;
  }

  align(alignment: "left" | "center" | "right"): this {
    const n = alignment === "center" ? 1 : alignment === "right" ? 2 : 0;
    this.bytes.push(ESC, 0x61, n);
    return this;
  }

  bold(on: boolean = true): this {
    this.bytes.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  doubleHeight(on: boolean = true): this {
    this.bytes.push(ESC, 0x21, on ? 0x10 : 0x00);
    return this;
  }

  text(str: string): this {
    const encoded = new TextEncoder().encode(str);
    for (let i = 0; i < encoded.length; i++) {
      this.bytes.push(encoded[i]);
    }
    return this;
  }

  lineFeed(n: number = 1): this {
    for (let i = 0; i < n; i++) {
      this.bytes.push(LF);
    }
    return this;
  }

  divider(): this {
    const width = getCharWidth();
    this.align("left");
    this.text("-".repeat(width));
    this.lineFeed();
    return this;
  }

  cutPaper(half: boolean = false): this {
    this.bytes.push(GS, 0x56, half ? 1 : 0);
    return this;
  }

  feedAndCut(half: boolean = false): this {
    this.lineFeed(3);
    this.cutPaper(half);
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

function twoColumns(left: string, right: string): string {
  const width = getCharWidth();
  const rightStr = right;
  const maxLeft = width - rightStr.length;
  if (left.length > maxLeft) {
    left = left.slice(0, maxLeft);
  }
  const gap = width - left.length - rightStr.length;
  return left + " ".repeat(Math.max(1, gap)) + rightStr;
}

function renderItem(buf: EscPosBuffer, item: ReceiptItem): void {
  buf.align("left");
  buf.bold(true);
  buf.text(item.product_name);
  buf.lineFeed();
  buf.bold(false);

  const qtyPrice = `${item.quantity}x ${formatCurrency(item.unit_price)}${item.modifier_label ? ` - ${item.modifier_label}` : ""}`;
  buf.text(twoColumns(qtyPrice, formatCurrency(item.subtotal)));
  buf.lineFeed();

  if (item.note) {
    buf.text(`  Catatan: ${item.note}`);
    buf.lineFeed();
  }
}

export function buildTestReceipt(): Uint8Array {
  const buf = new EscPosBuffer();

  buf.init();
  buf.align("center");
  buf.bold(true);
  buf.text("RAKKU POS");
  buf.lineFeed();
  buf.bold(false);
  buf.text("Test Print");
  buf.lineFeed();
  buf.text(new Date().toLocaleString("id-ID"));
  buf.lineFeed();
  buf.divider();

  buf.align("left");
  buf.text(twoColumns("Espresso", "Rp 25.000"));
  buf.lineFeed();
  buf.text(twoColumns("1x Rp 25.000", "Rp 25.000"));
  buf.lineFeed();
  buf.text(twoColumns("Cappuccino - Oat Milk", "Rp 35.000"));
  buf.lineFeed();
  buf.text(twoColumns("1x Rp 30.000", "Rp 35.000"));
  buf.lineFeed();
  buf.divider();

  buf.text(twoColumns("Subtotal", "Rp 60.000"));
  buf.lineFeed();
  buf.text(twoColumns("PB1 (11%)", "Rp 6.600"));
  buf.lineFeed();
  buf.bold(true);
  buf.text(twoColumns("Total", "Rp 66.600"));
  buf.lineFeed();
  buf.bold(false);
  buf.divider();

  buf.align("center");
  buf.text("Terima kasih atas kunjungan Anda");
  buf.lineFeed();
  buf.feedAndCut();

  return buf.build();
}

export function buildOrderReceipt(data: ReceiptData): Uint8Array {
  const buf = new EscPosBuffer();

  const paymentLabel =
    data.paymentMethod === "cash" ? "Tunai" :
    data.paymentMethod === "qris" ? "QRIS" :
    data.paymentMethod === "card" ? "Kartu" : data.paymentMethod;

  const orderTypeLabel = data.orderType.replace(/_/g, " ");

  buf.init();

  buf.align("center");
  buf.bold(true);
  buf.text("RAKKU");
  buf.lineFeed();
  buf.bold(false);
  buf.text(`Invoice #${data.orderNumber}`);
  buf.lineFeed();
  buf.divider();

  buf.align("left");
  buf.text(twoColumns("Tanggal", data.createdAt));
  buf.lineFeed();
  buf.text(twoColumns("Customer", data.customerName));
  buf.lineFeed();
  if (data.cashierName) {
    buf.text(twoColumns("Kasir", data.cashierName));
    buf.lineFeed();
  }
  buf.text(twoColumns("Tipe", orderTypeLabel));
  buf.lineFeed();
  buf.text(twoColumns("Pembayaran", paymentLabel));
  buf.lineFeed();
  buf.divider();

  for (const item of data.items) {
    renderItem(buf, item);
  }
  buf.divider();

  buf.text(twoColumns("Subtotal", formatCurrency(data.subtotal)));
  buf.lineFeed();

  for (const d of data.appliedDiscounts) {
    buf.text(twoColumns(d.name, `-${formatCurrency(d.amount)}`));
    buf.lineFeed();
  }

  for (const t of data.appliedTaxes) {
    const label = t.type === "percentage" ? `${t.name} (${t.value}%)` : t.name;
    buf.text(twoColumns(label, formatCurrency(t.amount)));
    buf.lineFeed();
  }

  if (data.cashAmount != null) {
    buf.text(twoColumns("Uang Tunai", formatCurrency(data.cashAmount)));
    buf.lineFeed();
  }
  if (data.change != null) {
    buf.text(twoColumns("Kembalian", formatCurrency(data.change)));
    buf.lineFeed();
  }

  buf.divider();
  buf.bold(true);
  buf.doubleHeight(true);
  buf.text(twoColumns("Total", formatCurrency(data.total)));
  buf.lineFeed();
  buf.doubleHeight(false);
  buf.bold(false);
  buf.divider();

  buf.align("center");
  buf.text("Terima kasih atas kunjungan Anda");
  buf.lineFeed();
  buf.feedAndCut();

  return buf.build();
}
