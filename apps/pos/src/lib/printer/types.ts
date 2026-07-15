import type { AppliedTax, AppliedDiscount } from "@rakku/shared-types";

export interface PrinterDevice {
  name: string;
  address: string;
}

export type ConnectionStatus = "connected" | "disconnected" | "scanning";

export type Unsubscribe = () => void;

export class PrinterNotAvailableError extends Error {
  constructor(message = "Fitur printer hanya tersedia di aplikasi Android Rakku POS, bukan di browser.") {
    super(message);
    this.name = "PrinterNotAvailableError";
  }
}

export const PRINTER_DEVICE_STORAGE_KEY = "rakku_pos_printer_device";
export const PAPER_WIDTH_STORAGE_KEY = "rakku_pos_printer_paper_width";

export type PaperWidth = 58 | 80;

export interface ReceiptItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  modifier_label: string | null;
  note: string | null;
}

export interface ReceiptData {
  orderNumber: number;
  customerName: string;
  cashierName: string | null;
  items: ReceiptItem[];
  subtotal: number;
  appliedTaxes: AppliedTax[];
  appliedDiscounts: AppliedDiscount[];
  total: number;
  paymentMethod: string;
  orderType: string;
  createdAt: string;
  cashAmount?: number;
  change?: number;
}

