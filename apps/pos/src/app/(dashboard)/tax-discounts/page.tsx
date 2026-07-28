import {
  getAllTaxes,
  getAllProductDiscounts,
  getAllOrderDiscounts,
  getAllProducts,
} from "@/lib/supabase/queries.server";
import TaxDiscountsClient from "./TaxDiscountsClient";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function TaxDiscountsPage({ searchParams }: PageProps) {
  const { tab } = await searchParams;
  const [taxes, productDiscounts, orderDiscounts, products] =
    await Promise.all([
      getAllTaxes(),
      getAllProductDiscounts(),
      getAllOrderDiscounts(),
      getAllProducts(),
    ]);

  const productNames: Record<string, string> = {};
  for (const p of products) {
    productNames[p.id] = p.name;
  }

  const initialTab =
    tab === "produk" || tab === "order" || tab === "pajak" ? tab : "pajak";

  return (
    <TaxDiscountsClient
      initialTaxes={taxes}
      initialProductDiscounts={productDiscounts}
      initialOrderDiscounts={orderDiscounts}
      productNames={productNames}
      initialTab={initialTab}
    />
  );
}
