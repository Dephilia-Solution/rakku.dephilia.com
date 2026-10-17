"use client";

import { useMemo } from "react";
import { useMerchantRequest } from "@pos/lib/merchant-runtime";

export function createStorage(request: typeof fetch = globalThis.fetch) {
async function uploadProductImage(
  productId: string,
  file: File
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("productId", productId);

  const res = await request("/api/admin/products/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? "Upload gagal");
  }

  const { url } = await res.json();
  return url;
}

async function deleteProductImage(productId: string) {
  const res = await request(
    `/api/admin/products/image?productId=${encodeURIComponent(productId)}`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? "Hapus gambar gagal");
  }
}

return { uploadProductImage, deleteProductImage };
}

export const { uploadProductImage, deleteProductImage } = createStorage();

export function useProductStorage() {
  const request = useMerchantRequest();
  return useMemo(() => createStorage(request), [request]);
}
