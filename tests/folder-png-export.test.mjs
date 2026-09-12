import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import JSZip from "jszip";

const source = ts.transpileModule(await readFile(new URL("../app/folderPngExport.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
vm.runInNewContext(source, { exports });
const { getFolderPngEntries } = exports;

test("folder ZIP includes every language and numbers posts from the bottom while preserving gallery page order", async () => {
  const creations = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const entries = getFolderPngEntries([
    { id: "single", type: "single", pageIds: ["b"] },
    { id: "gallery", type: "gallery", pageIds: ["c", "a"] },
  ], creations);
  assert.equal(entries.length, 9);
  const zip = new JSZip();
  for (const entry of entries) zip.file(entry.filename, `${entry.creation.id}:${entry.language}`);
  const archive = await JSZip.loadAsync(await zip.generateAsync({ type: "uint8array", compression: "STORE" }));
  for (const language of ["fr", "en", "pt"]) {
    const prefix = language;
    assert.equal(await archive.file(`${prefix}_post_2.png`).async("string"), `b:${language}`);
    assert.equal(await archive.file(`${prefix}_post_1_image_1.png`).async("string"), `c:${language}`);
    assert.equal(await archive.file(`${prefix}_post_1_image_2.png`).async("string"), `a:${language}`);
  }
});

test("missing pages fail explicitly instead of silently producing an incomplete ZIP", () => {
  assert.throws(() => getFolderPngEntries([{ pageIds: ["missing"] }], []), /image 1 du post 1 est introuvable/);
  assert.throws(() => getFolderPngEntries([{ pageIds: [] }], []), /post 1 ne contient aucune image/);
  assert.equal(getFolderPngEntries([], []).length, 0);
});

test("manual display order is numbered in reverse without mutating it", () => {
  const posts = [
    { id: "top", type: "single", pageIds: ["c"] },
    { id: "middle", type: "single", pageIds: ["a"] },
    { id: "bottom", type: "single", pageIds: ["b"] },
  ];
  const entries = getFolderPngEntries(posts, [{ id: "a" }, { id: "b" }, { id: "c" }]);
  assert.deepEqual(Array.from(entries.filter((entry) => entry.language === "fr"), (entry) => [entry.filename, entry.creation.id]), [
    ["fr_post_1.png", "b"], ["fr_post_2.png", "a"], ["fr_post_3.png", "c"],
  ]);
  assert.deepEqual(posts.map((post) => post.id), ["top", "middle", "bottom"]);
});
