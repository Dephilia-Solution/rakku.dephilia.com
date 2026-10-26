export const IMPORT_DOMAINS = ["products", "employees", "ingredients"] as const;
export type ImportDomain = (typeof IMPORT_DOMAINS)[number];
export const IMPORT_MAX_ROWS: Record<ImportDomain, number> = {
  products: 500,
  employees: 100,
  ingredients: 500,
};
export const IMPORT_MAX_RECIPE_ROWS = 2000;
export const IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024;
