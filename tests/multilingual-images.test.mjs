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

test("new and legacy images are shared across languages by default", () => {
  const api = loadPostPages();
  const image = api.createPageImage("image", { assetId: "shared.png" });
  assert.equal(image.multilingual, false);
  for (const language of ["fr", "en", "pt"]) {
    assert.equal(api.getImageAssetId(image, language), "shared.png");
    assert.equal(api.getImageAssetId({ id: "legacy", assetId: "old.png" }, language), "old.png");
  }
});

test("multilingual mode keeps the existing image in the active language and resolves each variant", () => {
  const api = loadPostPages();
  const original = api.createPageImage("image", { assetId: "original.png" });
  const enabled = api.setImageMultilingual(original, true, "pt");
  assert.equal(api.getImageAssetId(enabled, "pt"), "original.png");
  assert.equal(api.getImageAssetId(enabled, "fr"), "");
  assert.equal(original.multilingual, false);
  const translated = { ...enabled, localizedAssetIds: { ...enabled.localizedAssetIds, fr: "fr.png", en: "en.png" } };
  assert.equal(api.getImageAssetId(translated, "fr"), "fr.png");
  assert.equal(api.getImageAssetId(translated, "en"), "en.png");
  const shared = api.setImageMultilingual(translated, false, "en");
  assert.equal(api.getImageAssetId(shared, "fr"), "en.png");
  const restored = api.setImageMultilingual(shared, true, "fr");
  assert.equal(api.getImageAssetId(restored, "fr"), "fr.png");
  assert.equal(api.getImageAssetId(restored, "pt"), "original.png");
});

test("language assignments survive saving and reloading", async () => {
  let saved;
  const api = loadPostPages({
    runTransaction: async (_, operation) => operation({
      get: async () => ({id: "page", exists: () => true, data: () => saved ?? {}}),
      update: (_, data) => { saved = {...saved, ...data}; },
    }),
    onSnapshot: (_, callback) => callback({ docs: [{ id: "existing", data: () => saved }] }),
  });
  const postPage = {
    id: "existing", name: "Test", postId: "post", translations: messages.EMPTY_TRANSLATIONS,
    format: "portrait", theme: "dailydish", background: "cream", backgroundAssetId: "",
    properties: { ...api.createDefaultPageLayout(), images: [api.createPageImage("image", {
      multilingual: true, localizedAssetIds: { fr: "fr.png", en: "en.png", pt: "pt.png" },
    })] },
  };
  await api.savePostPage(postPage);
  api.subscribeToPostPages(([loaded]) => {
    for (const language of ["fr", "en", "pt"]) assert.equal(api.getImageAssetId(loaded.properties.images[0], language), `${language}.png`);
  }, assert.fail);
});
