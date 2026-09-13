import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../firebase/gallery.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadGallery(overrides = {}) {
  const sdk = {
    getStorage: () => ({}),
    ref: (_, path) => ({ fullPath: path, name: path.split("/").at(-1) }),
    ...overrides,
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (name === "firebase/storage") return sdk;
      if (name === "./firebaseAuth") return { firebaseApp: {} };
      throw new Error(`Unexpected import: ${name}`);
    },
    crypto: globalThis.crypto,
  });
  return exports;
}

test("existing gallery and mascot images stay at the root with stable IDs and URLs", async () => {
  const gallery = loadGallery({
    listAll: async (folder) => ({ items: [{ fullPath: `${folder.fullPath}/old.png`, name: "old.png" }] }),
    getMetadata: async () => ({ size: 10, timeCreated: "2026-01-01", customMetadata: { originalName: "Original.png" } }),
    getDownloadURL: async (item) => `https://example.test/${item.fullPath}`,
  });
  const assets = await gallery.listGalleryAssets();
  assert.equal(assets.length, 2);
  for (const asset of assets) {
    assert.equal(asset.folderId, "");
    assert.equal(asset.id, asset.path);
    assert.equal(asset.name, "Original.png");
    assert.equal(asset.url, `https://example.test/${asset.path}`);
  }
});

test("uploads remember the destination folder and default to the root", async () => {
  const uploads = [];
  const gallery = loadGallery({
    uploadBytes: async (...args) => { uploads.push(args); return { metadata: { size: 100, timeCreated: "2026-09-09" } }; },
    getDownloadURL: async (item) => `https://example.test/${item.fullPath}`,
  });
  const file = { name: "Recette.png", type: "image/png", size: 100 };
  const [uploaded] = await gallery.uploadGalleryFiles([file], "recipes");
  await gallery.uploadGalleryFiles([file]);
  assert.equal(uploads[0][2].customMetadata.folderId, "recipes");
  assert.equal(uploads[1][2].customMetadata.folderId, "");
  assert.equal(uploads[0][2].customMetadata.originalName, "Recette.png");
  assert.match(uploads[0][0].fullPath, /^gallery\//);
  assert.equal(uploaded.id, uploads[0][0].fullPath);
  assert.equal(uploaded.url, `https://example.test/${uploaded.id}`);
  assert.equal(uploaded.folderId, "recipes");
});

test("posts arriving after the gallery listing resolve their new backgrounds without reloading known images", async () => {
  const reads = [];
  const gallery = loadGallery({
    getMetadata: async (item) => {
      reads.push(item.fullPath);
      return { size: 10, timeCreated: "2026-09-13", customMetadata: { originalName: "Carotte.png" } };
    },
    getDownloadURL: async (item) => `https://example.test/${item.fullPath}`,
  });
  const known = [{id: "gallery/existing.png"}];
  const result = await gallery.loadMissingGalleryAssets([
    "gallery/existing.png", "gallery/carrot.png", "gallery/carrot.png", "",
  ], known);
  assert.deepEqual(reads, ["gallery/carrot.png"]);
  assert.equal(result.assets.length, 1);
  assert.equal(result.assets[0].id, "gallery/carrot.png");
  assert.equal(result.assets[0].url, "https://example.test/gallery/carrot.png");
  assert.equal(result.failedIds.length, 0);
  await gallery.loadMissingGalleryAssets(["gallery/carrot.png"], [...known, ...result.assets]);
  assert.equal(reads.length, 1);
});

test("an unavailable image does not hide other imported images and can be retried", async () => {
  let unavailable = true;
  const gallery = loadGallery({
    getMetadata: async (item) => {
      if (item.name === "later.png" && unavailable) throw new Error("not found");
      return {size: 10, timeCreated: "2026-09-13"};
    },
    getDownloadURL: async (item) => `https://example.test/${item.fullPath}`,
  });
  const ids = ["gallery/ready.png", "gallery/later.png"];
  const first = await gallery.loadMissingGalleryAssets(ids, []);
  assert.equal(first.assets[0].id, "gallery/ready.png");
  assert.deepEqual(Array.from(first.failedIds), ["gallery/later.png"]);
  unavailable = false;
  const retry = await gallery.loadMissingGalleryAssets(ids, first.assets);
  assert.equal(retry.assets.length, 1);
  assert.equal(retry.assets[0].id, "gallery/later.png");
  assert.equal(retry.failedIds.length, 0);
});

test("moving to a folder and back only updates metadata at the original path", async () => {
  const updates = [];
  const gallery = loadGallery({ updateMetadata: async (...args) => updates.push(args) });
  const asset = { path: "mascots/original.png", url: "https://example.test/original.png" };
  await gallery.moveGalleryAsset(asset, "recipes");
  await gallery.moveGalleryAsset(asset, "");
  assert.equal(updates.length, 2);
  assert.equal(updates[0][0].fullPath, asset.path);
  assert.equal(updates[1][0].fullPath, asset.path);
  assert.equal(updates[0][1].customMetadata.folderId, "recipes");
  assert.equal(updates[1][1].customMetadata.folderId, "");
  assert.equal(Object.keys(updates[0][1]).join(), "customMetadata");
});
