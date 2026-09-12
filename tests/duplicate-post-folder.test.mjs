import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(await readFile(new URL("../firebase/duplicatePostFolder.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const orderExports = {};
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../app/postOrder.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: orderExports });
function setup({ failPage = false, failCleanup = false } = {}) {
  const writes = [], deleted = [];
  let next = 0;
  const api = {
    createCreationFolder: async (name) => { writes.push({ name }); return "new-folder"; },
    saveFolderPostOrder: async (id, order) => writes.push({ folderOrder: Array.from(order) }),
    deleteCreationFolder: async (id) => deleted.push(id),
    createStudioPost: async (folderId, type) => ({ id: `post-${++next}`, folderId, type }),
    duplicateCreation: async (page, overrides) => {
      if (failPage && page.id === "b") throw new Error("Write failed");
      const id = `page-${++next}`;
      writes.push({ ...structuredClone(page), ...overrides, id });
      return id;
    },
    saveStudioPost: async (post) => writes.push(post),
    deleteCreation: async (id) => { if (failCleanup) throw new Error("offline"); deleted.push(id); },
    deleteStudioPost: async (id) => deleted.push(id),
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => name === "../app/postOrder" ? orderExports : api });
  return { run: exports.duplicatePostFolder, writes, deleted };
}
const folder = { id: "original", name: "Store" };
const posts = [
  { id: "single", folderId: folder.id, type: "single", pageIds: ["b"] },
  { id: "gallery", folderId: folder.id, type: "gallery", pageIds: ["a", "b"] },
  { id: "elsewhere", folderId: "other", type: "single", pageIds: ["missing"] },
];
const pages = ["a", "b"].map((id) => ({ id, campaignId: "shared-campaign", properties: { images: [{ assetId: "shared-photo" }] } }));

test("copies folder, posts and ordered pages with independent IDs and shared associations", async () => {
  const { run, writes } = setup();
  const original = JSON.stringify({ posts, pages });
  await run(folder, posts, pages);
  assert.equal(writes[0].name, "Store — Copie");
  const copiedPosts = writes.filter((item) => item.pageIds);
  assert.deepEqual(copiedPosts.map((post) => post.type), ["gallery", "single"]);
  const copiedPages = writes.filter((item) => item.campaignId);
  assert.equal(copiedPages.length, 3);
  assert.equal(new Set([...copiedPosts, ...copiedPages].map((item) => item.id)).size, 5);
  for (const post of copiedPosts) {
    assert.equal(post.folderId, "new-folder");
    for (const id of post.pageIds) assert.equal(copiedPages.find((page) => page.id === id).postId, post.id);
  }
  for (const page of copiedPages) {
    assert.equal(page.campaignId, "shared-campaign");
    assert.equal(page.properties.images[0].assetId, "shared-photo");
  }
  assert.equal(JSON.stringify({ posts, pages }), original);
});
test("validates missing pages before writing, and supports empty folders", async () => {
  const { run, writes } = setup();
  await assert.rejects(run(folder, posts, []), /introuvable/);
  assert.equal(writes.length, 0);
  await run(folder, [], []);
  assert.equal(writes.length, 2);
});
test("cleans up only newly created records when copying fails", async () => {
  const { run, deleted } = setup({ failPage: true });
  await assert.rejects(run(folder, posts, pages), /Write failed/);
  assert.deepEqual(deleted.sort(), ["new-folder", "page-2", "post-1"]);
});
test("reports incomplete cleanup and retains the copy folder for recovery", async () => {
  const { run, deleted } = setup({ failPage: true, failCleanup: true });
  await assert.rejects(run(folder, posts, pages), /nettoyage est incomplet/);
  assert.ok(!deleted.includes("new-folder"));
});

test("duplicated folder preserves its custom post order", async () => {
  const { run, writes } = setup();
  await run({ ...folder, postOrder: ["gallery", "single"] }, posts, pages);
  const copies = writes.filter((item) => item.pageIds);
  const saved = writes.find((item) => item.folderOrder).folderOrder;
  assert.deepEqual(saved.map((id) => copies.find((post) => post.id === id).type), ["gallery", "single"]);
});
