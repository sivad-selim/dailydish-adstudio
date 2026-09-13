import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../firebase/postPages.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const formats = {};
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../app/adFormats.ts", import.meta.url), "utf8"), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText, {exports: formats});
const positioning = {};
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../app/imagePositioning.ts", import.meta.url), "utf8"), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText, {exports: positioning, require: () => formats});

const pageModel = {};
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../firebase/postPageModel.ts", import.meta.url), "utf8"), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText, {exports: pageModel});
const messages = {};
vm.runInNewContext(ts.transpileModule(await readFile(new URL("../firebase/messages.ts", import.meta.url), "utf8"), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText, {exports: messages});

function loadPostPages(overrides = {}) {
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
      if (name === "./postPageModel") return pageModel;
      if (name === "./messages") return messages;
      if (name === "firebase/firestore") return sdk;
      if (name === "../app/imagePositioning") return positioning;
      if (name === "./firebaseAuth") return {
        firebaseApp: {}, allowedEmail: "owner@example.test",
        firebaseAuth: { currentUser: { email: "owner@example.test" } },
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

test("store buttons default to disabled and each page owns its settings", () => {
  const api = loadPostPages();
  const first = api.createDefaultPageLayout();
  first.storeButtons.enabled = true;
  assert.equal(api.createDefaultPageLayout().storeButtons.enabled, false);
  assert.equal(api.readPostPage("existing", {properties: {}}).properties.storeButtons.enabled, false);
  assert.equal(api.createDefaultPageLayout().storeButtons.bottomMargin, 6);
  assert.equal(api.readPostPage("existing", {properties: {storeButtons: {bottomMargin: 0}}}).properties.storeButtons.bottomMargin, 0);
  assert.equal(api.readPostPage("existing", {properties: {}}).properties.storeButtons.scale, 100);
  const parsed = api.readPostPage("invalid", {properties: {storeButtons: {enabled: "true", direction: "diagonal", bottomMargin: 200}}});
  assert.equal(parsed.properties.storeButtons.enabled, false);
  assert.equal(parsed.properties.storeButtons.direction, "row");
  assert.equal(parsed.properties.storeButtons.bottomMargin, 80);
});

test("both store badges, arrangement and bottom margin survive saving and reloading", async () => {
  let saved;
  const api = loadPostPages({
    runTransaction: async (_, operation) => operation({
      get: async () => ({id: "page", exists: () => true, data: () => saved ?? {}}),
      update: (_, data) => { saved = {...saved, ...data}; },
    }),
    onSnapshot: (_, callback) => callback({docs: [{id: "page", data: () => saved}]}),
  });
  const page = api.readPostPage("page", {});
  const buttons = {enabled: true, direction: "column", bottomMargin: 10, scale: 125, iosAssetId: "gallery/apple.png", androidAssetId: "gallery/google.png"};
  await api.savePostPage({...page, properties: {...page.properties, storeButtons: buttons}});
  api.subscribeToPostPages(([loaded]) => assert.deepEqual(JSON.parse(JSON.stringify(loaded.properties.storeButtons)), buttons), assert.fail);
  await api.savePostPage({...page, properties: {...page.properties, storeButtons: {...buttons, enabled: false}}});
  api.subscribeToPostPages(([loaded]) => {
    assert.equal(loaded.properties.storeButtons.enabled, false);
    assert.equal(loaded.properties.storeButtons.iosAssetId, buttons.iosAssetId);
    assert.equal(loaded.properties.storeButtons.bottomMargin, 10);
  }, assert.fail);
});

test("the last image enabled wins, including after unchecking and rechecking", () => {
  const api = loadPostPages();
  let images = ["a", "b", "c"].map((id) => api.createPageImage(id));
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
  const api = loadPostPages();
  const images = ["a", "b", "c"].map((id) => ({ ...api.createPageImage(id), aboveText: true, foregroundOrder: undefined }));
  const updated = api.setImageForeground(images, "a", true);
  assert.ok(updated[0].foregroundOrder > updated[2].foregroundOrder);
  assert.ok(updated[2].foregroundOrder > updated[1].foregroundOrder);
  assert.equal(images[0].foregroundOrder, undefined);
});

test("foreground priority survives saving and reloading", async () => {
  let saved;
  const api = loadPostPages({
    runTransaction: async (_, operation) => operation({
      get: async () => ({id: "page", exists: () => true, data: () => saved ?? {}}),
      update: (_, data) => { saved = {...saved, ...data}; },
    }),
    onSnapshot: (_, callback) => callback({ docs: [{ id: "existing", data: () => saved }] }),
  });
  const images = api.setImageForeground(api.setImageForeground(
    ["a", "b"].map((id) => api.createPageImage(id)), "b", true,
  ), "a", true);
  await api.savePostPage({
    id: "existing", name: "Test", postId: "post", translations: messages.EMPTY_TRANSLATIONS,
    format: "portrait", theme: "dailydish", background: "cream", backgroundAssetId: "",
    properties: { ...api.createDefaultPageLayout(), images },
  });
  api.subscribeToPostPages(([loaded]) => {
    assert.ok(loaded.properties.images[0].foregroundOrder > loaded.properties.images[1].foregroundOrder);
    assert.equal(loaded.properties.images[0].aboveText, true);
  }, assert.fail);
});
