export type SilosFile = {
  id: string;
  provider?: string;
  bucket?: string;
  object_key?: string;
  filename: string;
  mime_type: string;
  size: number;
  project_id?: string;
  folder_id: string | null;
  status?: number;
  url: string;
  created_at: string;
  updated_at?: string;
};

export type SilosApiResponse<T> = {
  success: boolean;
  data: T;
};

export type SilosUploadParams = {
  file: Blob | Buffer;
  filename: string;
  contentType?: string;
  folderId?: string;
};

function requireConfig() {
  const url = process.env.SILOS_API_URL;
  const key = process.env.SILOS_API_KEY;

  if (!url || !key) {
    throw new Error(
      "SILOS_API_URL dan SILOS_API_KEY harus diisi di .env.local"
    );
  }

  return { url: url.replace(/\/+$/, ""), key };
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as Record<string, unknown>;
    if (typeof data?.error === "string") return data.error;
    if (typeof data?.message === "string") return data.message;
    return fallback;
  } catch {
    return fallback;
  }
}

export async function uploadFile(params: SilosUploadParams): Promise<SilosFile> {
  const { url, key } = requireConfig();

  const blob =
    params.file instanceof Blob
      ? params.file
      : new Blob([new Uint8Array(params.file)]);

  const file = new File(
    [blob],
    params.filename,
    params.contentType ? { type: params.contentType } : undefined
  );

  const formData = new FormData();
  formData.append("file", file);
  if (params.folderId) {
    formData.append("folder_id", params.folderId);
  }

  const res = await fetch(`${url}/api/v1/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await readError(res, "Upload ke Silos gagal"));
  }

  const json = (await res.json()) as SilosApiResponse<SilosFile>;
  return json.data;
}

export async function deleteFile(fileId: string): Promise<void> {
  const { url, key } = requireConfig();

  const res = await fetch(`${url}/api/v1/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!res.ok) {
    throw new Error(await readError(res, "Hapus file di Silos gagal"));
  }
}

export async function getFile(fileId: string): Promise<SilosFile> {
  const { url, key } = requireConfig();

  const res = await fetch(`${url}/api/v1/files/${encodeURIComponent(fileId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!res.ok) {
    throw new Error(await readError(res, "Ambil file dari Silos gagal"));
  }

  const json = (await res.json()) as SilosApiResponse<SilosFile>;
  return json.data;
}
