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

test("new and legacy images are shared across languages by default", () => {
  const api = loadCreations();
  const image = api.createCreationImage("image", { assetId: "shared.png" });
  assert.equal(image.multilingual, false);
  for (const language of ["fr", "en", "pt"]) {
    assert.equal(api.getImageAssetId(image, language), "shared.png");
    assert.equal(api.getImageAssetId({ id: "legacy", assetId: "old.png" }, language), "old.png");
  }
});

test("multilingual mode keeps the existing image in the active language and resolves each variant", () => {
  const api = loadCreations();
  const original = api.createCreationImage("image", { assetId: "original.png" });
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

test("language assignments survive saving, reloading and duplication", async () => {
  let saved;
  let duplicated;
  const api = loadCreations({
    setDoc: async (_, value) => { saved = value; },
    addDoc: async (_, value) => { duplicated = value; return { id: "copy" }; },
    onSnapshot: (_, callback) => callback({ docs: [{ id: "existing", data: () => saved }] }),
  });
  const creation = {
    id: "existing", name: "Test", postId: "post", folderId: "", campaignId: "campaign",
    format: "portrait", theme: "dailydish", background: "cream", backgroundAssetId: "",
    properties: { ...api.createDefaultCreationProperties(), images: [api.createCreationImage("image", {
      multilingual: true, localizedAssetIds: { fr: "fr.png", en: "en.png", pt: "pt.png" },
    })] },
  };
  await api.saveCreation(creation);
  api.subscribeToCreations(([loaded]) => {
    for (const language of ["fr", "en", "pt"]) assert.equal(api.getImageAssetId(loaded.properties.images[0], language), `${language}.png`);
  }, assert.fail);
  await api.duplicateCreation(creation);
  assert.equal(duplicated.properties.images[0].localizedAssetIds.en, "en.png");
});
