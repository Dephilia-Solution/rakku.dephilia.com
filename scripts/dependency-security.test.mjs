import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";

const appRequire = createRequire(resolve("apps/owner/package.json"));
const configRequire = createRequire(appRequire.resolve("eslint-config-next"));
const pluginRequire = createRequire(configRequire.resolve("@next/eslint-plugin-next"));
const globRequire = createRequire(pluginRequire.resolve("fast-glob"));
const matchRequire = createRequire(globRequire.resolve("micromatch"));
const braces = matchRequire("braces");

test("patched braces rejects deep balanced/unbalanced braces and parentheses before recursive walkers", () => {
  for (const method of ["parse", "compile", "expand", "stringify"]) {
    for (const [open, close] of [["{", "}"], ["(", ")"]]) {
      for (const suffix of [close.repeat(5000), ""]) {
        assert.throws(() => braces[method](open.repeat(5000) + "a,b" + suffix), SyntaxError);
      }
    }
  }
});
test("patched braces bounds caller-provided ASTs and rejects cycles without stack exhaustion", () => {
  let node = { type: "text", value: "a" };
  for (let i = 0; i < 5000; i++) node = { type: "root", nodes: [node] };
  const cycle = { type: "root", nodes: [] };
  cycle.nodes.push(cycle);
  for (const method of ["compile", "expand", "stringify"]) {
    assert.throws(() => braces[method](node), SyntaxError);
    assert.throws(() => braces[method](cycle), SyntaxError);
  }
});
test("patched braces preserves ordinary glob expansion, compilation and escaped literals", () => {
  assert.deepEqual(braces.expand("src/{a,b}/*.{js,ts}"), ["src/a/*.js", "src/a/*.ts", "src/b/*.js", "src/b/*.ts"]);
  assert.equal(braces.compile("src/{a,b}.ts"), "src/(a|b).ts");
  assert.equal(braces.stringify(braces.parse("src/{a,b}.ts")), "src/{a,b}.ts");
  assert.deepEqual(braces.expand("x{1..3}"), ["x1", "x2", "x3"]);
  assert.deepEqual(braces.expand("src/\\{literal\\}.ts"), ["src/{literal}.ts"]);
});
