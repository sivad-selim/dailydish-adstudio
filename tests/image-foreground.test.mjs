import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../firebase/creations.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadCreations(overrides = {}) {
  const sdk = {
    getFirestore: () => ({}),
    collection: (_, path) => path,
    doc: (collection, id) => `${collection}/${id}`,
    serverTimestamp: () => "server-time",
    query: (collection) => collection,
    orderBy: () => ({}),
    ...overrides,
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (name === "firebase/firestore") return sdk;
      if (name === "./firebaseAuth") return {
        firebaseApp: {}, allowedEmail: "owner@example.test",
        firebaseAuth: { currentUser: { email: "owner@example.test" } },
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

test("the last image enabled wins, including after unchecking and rechecking", () => {
  const api = loadCreations();
  let images = ["a", "b", "c"].map((id) => api.createCreationImage(id));
  images = api.setImageForeground(images, "a", true);
  images = api.setImageForeground(images, "b", true);
  assert.ok(images[1].foregroundOrder > images[0].foregroundOrder);
  images = api.setImageForeground(images, "a", false);
  assert.equal(images[0].aboveText, false);
  assert.equal(images[0].foregroundOrder, 0);
  images = api.setImageForeground(images, "a", true);
  assert.ok(images[0].foregroundOrder > images[1].foregroundOrder);
  assert.equal(images[2].aboveText, false);
  assert.equal(images.map((image) => image.id).join(), "a,b,c");
});

test("legacy foreground images retain their relative order when another is brought forward", () => {
  const api = loadCreations();
  const images = ["a", "b", "c"].map((id) => ({ ...api.createCreationImage(id), aboveText: true, foregroundOrder: undefined }));
  const updated = api.setImageForeground(images, "a", true);
  assert.ok(updated[0].foregroundOrder > updated[2].foregroundOrder);
  assert.ok(updated[2].foregroundOrder > updated[1].foregroundOrder);
  assert.equal(images[0].foregroundOrder, undefined);
});

test("foreground priority survives saving and reloading", async () => {
  let saved;
  const api = loadCreations({
    setDoc: async (_, value) => { saved = value; },
    onSnapshot: (_, callback) => callback({ docs: [{ id: "existing", data: () => saved }] }),
  });
  const images = api.setImageForeground(api.setImageForeground(
    ["a", "b"].map((id) => api.createCreationImage(id)), "b", true,
  ), "a", true);
  await api.saveCreation({
    id: "existing", name: "Test", postId: "post", folderId: "", campaignId: "",
    format: "portrait", theme: "dailydish", background: "cream", backgroundAssetId: "",
    properties: { ...api.createDefaultCreationProperties(), images },
  });
  api.subscribeToCreations(([loaded]) => {
    assert.ok(loaded.properties.images[0].foregroundOrder > loaded.properties.images[1].foregroundOrder);
    assert.equal(loaded.properties.images[0].aboveText, true);
  }, assert.fail);
});
