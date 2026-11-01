export function successfulImportHistory<T extends { status: string }>(batches: T[]): T[] {
  return batches.filter(batch => batch.status === "confirmed");
}

export async function readImportHistoryResponse<T>(response: Pick<Response, "text" | "ok" | "status">): Promise<T> {
  const body = await response.text();
  try {
    const value: unknown = JSON.parse(body);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid response shape");
    return value as T;
  } catch {
    const reason = response.ok
      ? "Server mengirim respons riwayat kosong atau tidak valid."
      : `Server gagal memuat riwayat (HTTP ${response.status}).`;
    throw new Error(`${reason} Coba muat ulang.`);
  }
}
