import type { BackendImportDomain } from "./import-spec";

export function canStageImportPreview(input: {
  domain: BackendImportDomain;
  linked: boolean;
  validMainRows: number;
  recipeRows: number;
  errorRows: number;
}): boolean {
  const hasImportableRows = input.validMainRows > 0 || input.domain === "products" && input.recipeRows > 0;
  return hasImportableRows && (!input.linked || input.errorRows === 0);
}
