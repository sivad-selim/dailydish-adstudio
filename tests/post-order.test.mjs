import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const exports = {};
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../app/postOrder.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { orderFolderPosts, movePostInOrder } = exports;
const ids = (items) => Array.from(items, (item) => item.id);
test("keeps display order without chronological sorting and honors drag-and-drop", () => {
  const posts = [
    { id: "new", createdAt: 30, updatedAt: 30 },
    { id: "a", createdAt: 10, updatedAt: 99 },
    { id: "b", createdAt: 20, updatedAt: 21 },
  ];
  assert.deepEqual(ids(orderFolderPosts(posts)), ["new", "a", "b"]);
  assert.deepEqual(ids(orderFolderPosts(posts, ["b", "deleted", "a"])), ["new", "b", "a"]);
});
test("dragging inserts before or after a target in both directions", () => {
  const order = ["a", "b", "c", "d"];
  assert.deepEqual(Array.from(movePostInOrder(order, "a", "c", true)), ["b", "c", "a", "d"]);
  assert.deepEqual(Array.from(movePostInOrder(order, "d", "b", false)), ["a", "d", "b", "c"]);
  assert.deepEqual(Array.from(movePostInOrder(order, "a", "a", true)), order);
  assert.deepEqual(Array.from(movePostInOrder(order, "missing", "b", false)), order);
  assert.deepEqual(order, ["a", "b", "c", "d"]);
});
