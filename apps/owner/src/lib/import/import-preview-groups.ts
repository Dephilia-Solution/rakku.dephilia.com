import type { BackendImportDomain } from "./import-spec";

export interface PreviewGroupRow {
  row_number: number;
  kind?: string;
  code?: string;
  values?: Record<string, unknown>;
}

export interface ImportPreviewGroup<T extends PreviewGroupRow> {
  key: string;
  main?: T;
  children: T[];
}

export function groupImportPreviewRows<T extends PreviewGroupRow>(rows: T[], domain: BackendImportDomain): ImportPreviewGroup<T>[] {
  if (domain !== "products" && domain !== "purchases") return rows.map(row => ({ key: `${row.kind ?? "row"}:${row.row_number}`, main: row, children: [] }));

  const groups = new Map<string, ImportPreviewGroup<T>>();
  const getGroup = (key: string) => {
    let group = groups.get(key);
    if (!group) { group = { key, children: [] }; groups.set(key, group); }
    return group;
  };
  for (const row of rows) {
    const isChild = domain === "products" ? row.kind === "recipe" : row.kind === "purchase_line";
    const code = String(isChild
      ? row.values?.[domain === "products" ? "product_code" : "purchase_code"] ?? row.code ?? ""
      : row.code ?? row.values?.[domain === "products" ? "code" : "purchase_code"] ?? row.values?.code ?? `row-${row.row_number}`);
    const key = code.trim().normalize("NFKC").toLocaleUpperCase("id-ID") || `row-${row.row_number}`;
    let group = getGroup(key);
    if (!isChild && group.main) group = getGroup(`${key}:duplicate:${row.row_number}`);
    if (isChild) group.children.push(row);
    else group.main = row;
  }
  return [...groups.values()];
}
