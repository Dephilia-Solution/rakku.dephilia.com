export async function uploadProductImage(
  productId: string,
  file: File
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("productId", productId);

  const res = await fetch("/api/admin/products/upload", {
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

export async function deleteProductImage(productId: string) {
  const res = await fetch(
    `/api/admin/products/image?productId=${encodeURIComponent(productId)}`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? "Hapus gambar gagal");
  }
}
