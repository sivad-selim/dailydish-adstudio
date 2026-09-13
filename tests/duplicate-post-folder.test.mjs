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
    createPostFolder: async (name) => { writes.push({ name }); return "new-folder"; },
    saveFolderPostOrder: async (id, order) => writes.push({ folderOrder: Array.from(order) }),
    deletePostFolder: async (id) => deleted.push(id),
    duplicateStudioPost: async (sourceId, folderId) => {
      if (failPage && sourceId === "single") throw new Error("Write failed");
      const id = `post-${++next}`; writes.push({id,sourceId,folderId}); return id;
    },
    deleteStudioPost: async (id) => { if (failCleanup) throw new Error("offline"); deleted.push(id); },
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
test("copies only the selected folder through the shared atomic post operation", async () => {
  const {run,writes}=setup();
  await run(folder,posts);
  assert.deepEqual(writes.filter(x=>x.sourceId).map(x=>x.sourceId),["gallery","single"]);
  assert.ok(writes.filter(x=>x.sourceId).every(x=>x.folderId==="new-folder"));
});
test("cleanup removes only completed copies, and preserves a recoverable folder when cleanup fails",async()=>{
  const normal=setup({failPage:true});
  await assert.rejects(normal.run(folder,posts),/Write failed/);
  assert.deepEqual(normal.deleted,["post-1","new-folder"]);
  const failed=setup({failPage:true,failCleanup:true});
  await assert.rejects(failed.run(folder,posts),/partielle/);
  assert.ok(!failed.deleted.includes("new-folder"));
});
test("custom ordering and empty folders are preserved",async()=>{
  const {run,writes}=setup();
  await run({...folder,postOrder:["gallery","single"]},posts);
  const copies=writes.filter(x=>x.sourceId);
  const order=writes.find(x=>x.folderOrder).folderOrder;
  assert.deepEqual(order.map(id=>copies.find(x=>x.id===id).sourceId),["gallery","single"]);
  await run(folder,[]);
});
