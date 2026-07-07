import { createClient } from "@rakku/supabase-clients/client";

const BUCKET = "product-images";

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

export async function deleteProductImage(imageUrl: string) {
  const supabase = createClient();
  const path = imageUrl.split(`/${BUCKET}/`)[1];
  if (!path) return;

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
