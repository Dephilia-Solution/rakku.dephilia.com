import assert from "node:assert/strict";
import test from "node:test";
import { canStageImportPreview } from "./import-preview-policy";

test("unconfirmable linked previews are not staged or saved to import history", () => {
  assert.equal(canStageImportPreview({ domain: "products", linked: true, validMainRows: 0, recipeRows: 2, errorRows: 1 }), false);
  assert.equal(canStageImportPreview({ domain: "purchases", linked: true, validMainRows: 1, recipeRows: 0, errorRows: 1 }), false);
});

test("confirmable previews are staged, including valid partial legacy imports", () => {
  assert.equal(canStageImportPreview({ domain: "products", linked: true, validMainRows: 1, recipeRows: 2, errorRows: 0 }), true);
  assert.equal(canStageImportPreview({ domain: "products", linked: false, validMainRows: 1, recipeRows: 0, errorRows: 1 }), true);
  assert.equal(canStageImportPreview({ domain: "ingredients", linked: false, validMainRows: 0, recipeRows: 0, errorRows: 1 }), false);
});
