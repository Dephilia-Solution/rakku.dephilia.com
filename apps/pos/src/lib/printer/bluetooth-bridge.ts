import { CapacitorThermalPrinter } from "capacitor-thermal-printer";
import { isNative } from "./capacitor-platform";
import {
  PrinterDevice,
  Unsubscribe,
  PrinterNotAvailableError,
  PRINTER_DEVICE_STORAGE_KEY,
} from "./types";

function requireNative(): void {
  if (!isNative()) {
    throw new PrinterNotAvailableError();
  }
}

export function getSavedDevice(): PrinterDevice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PRINTER_DEVICE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PrinterDevice;
    if (!parsed.address) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDevice(device: PrinterDevice): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRINTER_DEVICE_STORAGE_KEY, JSON.stringify(device));
  } catch {
    // ignore storage errors
  }
}

export function clearSavedDevice(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PRINTER_DEVICE_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export async function scanDevices(
  onDevices: (devices: PrinterDevice[]) => void,
): Promise<Unsubscribe> {
  requireNative();

  const listener = await CapacitorThermalPrinter.addListener("discoverDevices", (data) => {
    onDevices(data.devices ?? []);
  });

  await CapacitorThermalPrinter.startScan();

  return () => {
    CapacitorThermalPrinter.stopScan().catch(() => {});
    listener.remove().catch(() => {});
  };
}

export async function stopScan(): Promise<void> {
  requireNative();
  await CapacitorThermalPrinter.stopScan();
}

export async function connect(address: string): Promise<PrinterDevice | null> {
  requireNative();
  const device = await CapacitorThermalPrinter.connect({ address });
  if (!device) return null;
  const result: PrinterDevice = { name: device.name, address: device.address };
  saveDevice(result);
  return result;
}

export async function disconnect(): Promise<void> {
  requireNative();
  await CapacitorThermalPrinter.disconnect();
}

export async function isConnected(): Promise<boolean> {
  requireNative();
  return CapacitorThermalPrinter.isConnected();
}

export async function write(bytes: Uint8Array): Promise<void> {
  requireNative();
  const data = Array.from(bytes);
  await CapacitorThermalPrinter.raw(data).write();
}

export async function writeText(text: string): Promise<void> {
  requireNative();
  await CapacitorThermalPrinter.text(text).write();
}

export function onConnectionChange(
  onConnected: (device: PrinterDevice) => void,
  onDisconnected: () => void,
): Unsubscribe {
  if (!isNative()) {
    return () => {};
  }

  let connectedListener: { remove: () => Promise<void> } | null = null;
  let disconnectedListener: { remove: () => Promise<void> } | null = null;

  CapacitorThermalPrinter.addListener("connected", (device) => {
    onConnected({ name: device.name, address: device.address });
  }).then((handle) => {
    connectedListener = handle;
  });

  CapacitorThermalPrinter.addListener("disconnected", () => {
    onDisconnected();
  }).then((handle) => {
    disconnectedListener = handle;
  });

  return () => {
    connectedListener?.remove().catch(() => {});
    disconnectedListener?.remove().catch(() => {});
  };
}

export async function autoReconnect(): Promise<boolean> {
  requireNative();
  const saved = getSavedDevice();
  if (!saved) return false;
  try {
    const connected = await CapacitorThermalPrinter.isConnected();
    if (connected) return true;
    const device = await connect(saved.address);
    return device !== null;
  } catch {
    return false;
  }
}
