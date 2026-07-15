"use client";

import { useEffect, useState, useCallback } from "react";
import { showToast } from "@rakku/ui";
import {
  Bluetooth,
  Printer as PrinterIcon,
  Search,
  Trash2,
  Wifi,
  WifiOff,
  Loader2,
  Info,
  CheckCircle2,
  XCircle,
  Smartphone,
} from "lucide-react";
import { isNative, getPlatform } from "@/lib/printer/capacitor-platform";
import {
  scanDevices,
  stopScan,
  connect,
  disconnect,
  isConnected,
  write,
  autoReconnect,
  getSavedDevice,
  clearSavedDevice,
  onConnectionChange,
} from "@/lib/printer/bluetooth-bridge";
import { buildTestReceipt } from "@/lib/printer/escpos-builder";
import { usePrinterStore } from "@/lib/printer/printer-store";
import { PrinterDevice, PaperWidth } from "@/lib/printer/types";

type TestPrintState = "idle" | "sending" | "success" | "error";

export default function PrinterSettingsClient() {
  const {
    status,
    savedDevice,
    devices,
    paperWidth,
    logs,
    init,
    setStatus,
    setSavedDevice,
    addDevice,
    clearDevices,
    setPaperWidth,
    addLog,
    clearLogs,
  } = usePrinterStore();

  const [native, setNative] = useState(false);
  const [platform, setPlatform] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testPrint, setTestPrint] = useState<TestPrintState>("idle");
  const [testPrintError, setTestPrintError] = useState<string>("");

  useEffect(() => {
    init();
    const nat = isNative();
    setNative(nat);
    setPlatform(getPlatform());

    if (!nat) return;

    const unsub = onConnectionChange(
      (device) => {
        setStatus("connected");
        setSavedDevice(device);
        addLog("connect", `Terhubung ke ${device.name} (${device.address})`);
      },
      () => {
        setStatus("disconnected");
        addLog("disconnect", "Printer terputus");
      },
    );

    isConnected()
      .then((connected) => {
        setStatus(connected ? "connected" : "disconnected");
        if (!connected) {
          const saved = getSavedDevice();
          if (saved) {
            autoReconnect()
              .then((ok) => {
                if (ok) {
                  setStatus("connected");
                  addLog("connect", `Auto-reconnect ke ${saved.name}`);
                }
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});

    return () => {
      unsub();
    };
  }, [init, setStatus, setSavedDevice, addLog]);

  const handleScan = useCallback(async () => {
    if (!isNative()) return;
    setScanning(true);
    setStatus("scanning");
    clearDevices();
    addLog("scan", "Memulai pencarian printer Bluetooth");
    try {
      const unsub = await scanDevices((found) => {
        found.forEach((d) => addDevice(d));
      });
      setTimeout(() => {
        stopScan().catch(() => {});
        unsub();
        setScanning(false);
        if (usePrinterStore.getState().status === "scanning") {
          setStatus("disconnected");
        }
        addLog("scan", "Pencarian selesai");
      }, 12000);
    } catch (err) {
      setScanning(false);
      setStatus("disconnected");
      const msg = err instanceof Error ? err.message : "Gagal mencari printer";
      addLog("error", `Scan gagal: ${msg}`);
      showToast("error", msg);
    }
  }, [setStatus, clearDevices, addDevice, addLog]);

  const handleConnect = useCallback(
    async (device: PrinterDevice) => {
      if (!isNative()) return;
      setConnecting(true);
      addLog("connect", `Menghubungkan ke ${device.name} (${device.address})`);
      try {
        const result = await connect(device.address);
        if (result) {
          setStatus("connected");
          setSavedDevice(result);
          addLog("connect", `Terhubung ke ${result.name}`);
          showToast("success", `Terhubung ke ${result.name}`);
        } else {
          addLog("error", `Gagal terhubung ke ${device.name}`);
          showToast("error", "Gagal terhubung ke printer");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gagal terhubung";
        addLog("error", `Connect gagal: ${msg}`);
        showToast("error", msg);
      } finally {
        setConnecting(false);
      }
    },
    [setStatus, setSavedDevice, addLog],
  );

  const handleDisconnect = useCallback(async () => {
    if (!isNative()) return;
    try {
      await disconnect();
      setStatus("disconnected");
      addLog("disconnect", "Sengaja diputus");
      showToast("success", "Printer diputus");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal memutus";
      addLog("error", `Disconnect gagal: ${msg}`);
      showToast("error", msg);
    }
  }, [setStatus, addLog]);

  const handleForgetDevice = useCallback(() => {
    clearSavedDevice();
    setSavedDevice(null);
    addLog("disconnect", "Printer default dihapus dari memori");
    showToast("success", "Printer default dihapus");
  }, [setSavedDevice, addLog]);

  const handleTestPrint = useCallback(async () => {
    if (!isNative()) return;
    setTestPrint("sending");
    setTestPrintError("");
    addLog("print", "Mengirim test print");
    try {
      const connected = await isConnected();
      if (!connected) {
        throw new Error("Printer belum terhubung. Sambungkan printer dulu.");
      }
      const bytes = buildTestReceipt();
      await write(bytes);
      setTestPrint("success");
      addLog("print", "Test print berhasil");
      showToast("success", "Test print berhasil dikirim");
      setTimeout(() => setTestPrint("idle"), 3000);
    } catch (err) {
      setTestPrint("error");
      const msg = err instanceof Error ? err.message : "Gagal test print";
      setTestPrintError(msg);
      addLog("error", `Test print gagal: ${msg}`);
      showToast("error", msg);
      setTimeout(() => setTestPrint("idle"), 5000);
    }
  }, [addLog]);

  const handlePaperWidth = useCallback(
    (width: PaperWidth) => {
      setPaperWidth(width);
      showToast("success", `Lebar kertas: ${width}mm`);
    },
    [setPaperWidth],
  );

  if (!native) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-display font-bold text-neutral-900">
            Pengaturan Printer
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Kelola koneksi printer thermal Bluetooth
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <Smartphone size={28} className="text-amber-600" />
          </div>
          <h2 className="font-display font-semibold text-neutral-900 mb-2">
            Fitur ini hanya tersedia di aplikasi Android
          </h2>
          <p className="text-sm text-neutral-600 max-w-md">
            Koneksi printer thermal Bluetooth (SPP) hanya bisa dilakukan dari
            aplikasi Rakku POS untuk Android, bukan dari browser. Install aplikasi
            Android Rakku POS untuk menggunakan fitur ini.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-neutral-400 bg-white px-3 py-1.5 rounded-lg border border-neutral-200">
            <Info size={14} />
            Platform terdeteksi: <span className="font-mono font-medium">{platform || "web"}</span>
          </div>
        </div>
      </div>
    );
  }

  const statusBadge = (() => {
    if (scanning || status === "scanning") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700">
          <Loader2 size={12} className="animate-spin" />
          Mencari...
        </span>
      );
    }
    if (status === "connected") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-success/10 text-success">
          <Wifi size={12} />
          Terhubung
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-neutral-100 text-neutral-500">
        <WifiOff size={12} />
        Terputus
      </span>
    );
  })();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-bold text-neutral-900">
            Pengaturan Printer
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Kelola koneksi printer thermal Bluetooth
          </p>
        </div>
        {statusBadge}
      </div>

      <div className="space-y-4">
        {savedDevice && (
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-forest/10 flex items-center justify-center">
                  <PrinterIcon size={20} className="text-forest" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-neutral-900">
                    {savedDevice.name}
                  </div>
                  <div className="text-xs text-neutral-400 font-mono">
                    {savedDevice.address}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {status === "connected" ? (
                  <button
                    onClick={handleDisconnect}
                    className="text-xs font-medium text-neutral-500 hover:text-danger px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Putus
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(savedDevice)}
                    disabled={connecting}
                    className="text-xs font-medium text-forest hover:bg-forest/5 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {connecting ? "Menghubungkan..." : "Sambungkan"}
                  </button>
                )}
                <button
                  onClick={handleForgetDevice}
                  title="Hapus dari memori"
                  className="p-1.5 text-neutral-300 hover:text-danger rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bluetooth size={18} className="text-neutral-700" />
              <h2 className="text-sm font-semibold text-neutral-900">
                Cari Printer Bluetooth
              </h2>
            </div>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-1.5 bg-forest text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-forest-dark transition-colors disabled:opacity-50"
            >
              {scanning ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Mencari...
                </>
              ) : (
                <>
                  <Search size={14} />
                  Cari Printer
                </>
              )}
            </button>
          </div>

          {devices.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 text-sm border border-dashed border-neutral-200 rounded-lg">
              <Bluetooth size={28} className="mx-auto mb-2 opacity-40" />
              {scanning
                ? "Mencari printer Bluetooth terdekat..."
                : "Belum ada printer ditemukan. Pastikan printer menyala dan sudah dipasangkan (paired) di Pengaturan Bluetooth Android."}
            </div>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => {
                const isSaved =
                  savedDevice?.address === device.address;
                const isCurrentConnected =
                  status === "connected" && isSaved;
                return (
                  <div
                    key={device.address}
                    className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PrinterIcon
                        size={18}
                        className={
                          isCurrentConnected ? "text-success" : "text-neutral-400"
                        }
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-neutral-900 truncate">
                          {device.name || "(tanpa nama)"}
                        </div>
                        <div className="text-xs text-neutral-400 font-mono truncate">
                          {device.address}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isCurrentConnected ? (
                        <span className="text-xs font-medium text-success flex items-center gap-1">
                          <CheckCircle2 size={14} />
                          Aktif
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConnect(device)}
                          disabled={connecting}
                          className="text-xs font-medium text-forest hover:bg-forest/5 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {connecting ? "..." : "Hubungkan"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-neutral-400 mt-3 flex items-start gap-1.5">
            <Info size={12} className="flex-shrink-0 mt-0.5" />
            Printer harus dipasangkan (paired) terlebih dahulu di Pengaturan
            Bluetooth Android. Jika tidak muncul, pastikan Bluetooth menyala dan
            printer dalam jangkauan.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PrinterIcon size={18} className="text-neutral-700" />
              <h2 className="text-sm font-semibold text-neutral-900">Test Print</h2>
            </div>
            <button
              onClick={handleTestPrint}
              disabled={testPrint === "sending" || status !== "connected"}
              className="flex items-center gap-1.5 bg-forest text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-forest-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testPrint === "sending" ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Mengirim...
                </>
              ) : testPrint === "success" ? (
                <>
                  <CheckCircle2 size={15} />
                  Berhasil
                </>
              ) : testPrint === "error" ? (
                <>
                  <XCircle size={15} />
                  Gagal
                </>
              ) : (
                <>
                  <PrinterIcon size={15} />
                  Test Print
                </>
              )}
            </button>
          </div>
          {testPrint === "error" && testPrintError && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-danger">
              <span className="font-semibold">Error: </span>
              {testPrintError}
            </div>
          )}
          {status !== "connected" && testPrint === "idle" && (
            <p className="text-xs text-neutral-400 mt-3">
              Sambungkan printer terlebih dahulu untuk test print.
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <PrinterIcon size={18} className="text-neutral-700" />
            <h2 className="text-sm font-semibold text-neutral-900">
              Lebar Kertas
            </h2>
          </div>
          <div className="flex gap-2">
            {([58, 80] as PaperWidth[]).map((w) => (
              <button
                key={w}
                onClick={() => handlePaperWidth(w)}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                  paperWidth === w
                    ? "bg-forest text-white"
                    : "bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {w}mm
              </button>
            ))}
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            Lebar kertas printer thermal. Default 58mm (paling umum untuk printer
            mobile). Pilih 80mm untuk printer desktop.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Info size={18} className="text-neutral-700" />
              <h2 className="text-sm font-semibold text-neutral-900">
                Diagnostik
              </h2>
            </div>
            {logs.length > 0 && (
              <button
                onClick={clearLogs}
                className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-1"
              >
                <Trash2 size={12} />
                Bersihkan log
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-neutral-50 rounded-lg p-3">
              <div className="text-xs text-neutral-400 mb-1">Platform</div>
              <div className="text-sm font-mono font-medium text-neutral-900">
                {platform || "unknown"}
              </div>
            </div>
            <div className="bg-neutral-50 rounded-lg p-3">
              <div className="text-xs text-neutral-400 mb-1">Status Koneksi</div>
              <div className="text-sm font-medium text-neutral-900 capitalize">
                {status}
              </div>
            </div>
          </div>

          <div className="text-xs text-neutral-400 mb-2">Log Koneksi Terakhir</div>
          {logs.length === 0 ? (
            <div className="text-xs text-neutral-300 py-4 text-center">
              Belum ada log.
            </div>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 text-xs font-mono py-1"
                >
                  <span className="text-neutral-400 flex-shrink-0">
                    {log.time}
                  </span>
                  <span
                    className={`flex-shrink-0 font-semibold ${
                      log.event === "error"
                        ? "text-danger"
                        : log.event === "connect"
                          ? "text-success"
                          : log.event === "disconnect"
                            ? "text-amber-600"
                            : "text-neutral-500"
                    }`}
                  >
                    [{log.event}]
                  </span>
                  <span className="text-neutral-600">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
