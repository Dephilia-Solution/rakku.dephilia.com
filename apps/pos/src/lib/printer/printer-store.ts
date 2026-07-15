import { create } from "zustand";
import {
  ConnectionStatus,
  PaperWidth,
  PrinterDevice,
  PAPER_WIDTH_STORAGE_KEY,
} from "./types";

export interface LogEntry {
  id: string;
  time: string;
  event: "connect" | "disconnect" | "error" | "scan" | "print";
  message: string;
}

interface PrinterStoreState {
  status: ConnectionStatus;
  savedDevice: PrinterDevice | null;
  devices: PrinterDevice[];
  paperWidth: PaperWidth;
  logs: LogEntry[];
  initialized: boolean;

  init: () => void;
  setStatus: (status: ConnectionStatus) => void;
  setSavedDevice: (device: PrinterDevice | null) => void;
  setDevices: (devices: PrinterDevice[]) => void;
  addDevice: (device: PrinterDevice) => void;
  clearDevices: () => void;
  setPaperWidth: (width: PaperWidth) => void;
  addLog: (event: LogEntry["event"], message: string) => void;
  clearLogs: () => void;
}

const MAX_LOGS = 10;

function nowString(): string {
  try {
    return new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return new Date().toISOString();
  }
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const usePrinterStore = create<PrinterStoreState>((set, get) => ({
  status: "disconnected",
  savedDevice: null,
  devices: [],
  paperWidth: 58,
  logs: [],
  initialized: false,

  init: () => {
    if (get().initialized) return;
    if (typeof window === "undefined") return;

    let savedDevice: PrinterDevice | null = null;
    let paperWidth: PaperWidth = 58;

    try {
      const raw = window.localStorage.getItem("rakku_pos_printer_device");
      if (raw) {
        const parsed = JSON.parse(raw) as PrinterDevice;
        if (parsed.address) savedDevice = parsed;
      }
    } catch {
      // ignore
    }

    try {
      const pw = window.localStorage.getItem(PAPER_WIDTH_STORAGE_KEY);
      if (pw === "80") paperWidth = 80;
    } catch {
      // ignore
    }

    set({ savedDevice, paperWidth, initialized: true });
  },

  setStatus: (status) => set({ status }),

  setSavedDevice: (device) => {
    set({ savedDevice: device });
  },

  setDevices: (devices) => set({ devices }),

  addDevice: (device) => {
    const existing = get().devices;
    if (existing.some((d) => d.address === device.address)) return;
    set({ devices: [...existing, device] });
  },

  clearDevices: () => set({ devices: [] }),

  setPaperWidth: (width) => {
    set({ paperWidth: width });
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(PAPER_WIDTH_STORAGE_KEY, String(width));
      } catch {
        // ignore
      }
    }
  },

  addLog: (event, message) => {
    const entry: LogEntry = {
      id: genId(),
      time: nowString(),
      event,
      message,
    };
    const logs = [entry, ...get().logs].slice(0, MAX_LOGS);
    set({ logs });
  },

  clearLogs: () => set({ logs: [] }),
}));
