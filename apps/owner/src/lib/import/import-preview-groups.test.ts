import assert from "node:assert/strict";
import test from "node:test";
import { groupImportPreviewRows } from "./import-preview-groups";

test("groups product compositions beneath their product, retaining unpaired rows", () => {
  const rows = [
    { row_number: 2, kind: "product", code: "PRD-A", values: { name: "Kopi A" } },
    { row_number: 3, kind: "recipe", code: "PRD-A", values: { product_code: "PRD-A", ingredient_code: "BHN-1" } },
    { row_number: 4, kind: "recipe", code: "PRD-A", values: { product_code: "PRD-A", ingredient_code: "BHN-2" } },
    { row_number: 5, kind: "product", code: "PRD-B", values: { name: "Kopi B" } },
  ];
  const groups = groupImportPreviewRows(rows, "products");
  assert.deepEqual(groups.map(group => [group.main?.code, group.children.length]), [["PRD-A", 2], ["PRD-B", 0]]);
});

test("groups purchase details beneath their purchase header", () => {
  const groups = groupImportPreviewRows([
    { row_number: 2, kind: "purchase", code: "PO-1", values: { code: "PO-1" } },
    { row_number: 3, kind: "purchase_line", code: "PO-1", values: { purchase_code: "PO-1" } },
  ], "purchases");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].main?.kind, "purchase");
  assert.equal(groups[0].children[0].kind, "purchase_line");
});
