import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../firebase/campaigns.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadCampaigns(overrides = {}) {
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

test("campaigns without folders remain at the root and filed campaigns retain their folder", () => {
  const api = loadCampaigns({ onSnapshot: (_, callback) => callback({ docs: [
    { id: "old", data: () => ({ translations: { fr: { title: "Ancienne campagne" } } }) },
    { id: "filed", data: () => ({ folderId: "recipes" }) },
  ] }) });
  api.subscribeToCampaigns((campaigns) => {
    assert.equal(campaigns[0].id, "old");
    assert.equal(campaigns[0].folderId, "");
    assert.equal(campaigns[0].translations.fr.title, "Ancienne campagne");
    assert.equal(campaigns[1].folderId, "recipes");
  }, assert.fail);
});

test("new campaigns are created in the selected folder or at the root", async () => {
  const writes = [];
  const api = loadCampaigns({ addDoc: async (_, data) => { writes.push(data); return { id: "new" }; } });
  assert.equal(await api.createCampaign("recipes"), "new");
  await api.createCampaign();
  assert.equal(writes[0].folderId, "recipes");
  assert.equal(writes[1].folderId, "");
});

test("moving a campaign changes only its folder and timestamp, retaining its ID and translations", async () => {
  const updates = [];
  const api = loadCampaigns({ updateDoc: async (...args) => updates.push(args) });
  await api.moveCampaign("existing", "recipes");
  await api.moveCampaign("existing", "");
  assert.equal(updates[0][0], "campaigns/existing");
  assert.equal(updates[1][0], "campaigns/existing");
  assert.deepEqual(Object.keys(updates[0][1]).sort(), ["folderId", "updatedAt"]);
  assert.equal(updates[0][1].folderId, "recipes");
  assert.equal(updates[1][1].folderId, "");
});

test("saving an older editor draft cannot move a campaign back to its previous folder", async () => {
  const writes = [];
  const api = loadCampaigns({ setDoc: async (...args) => writes.push(args) });
  await api.saveCampaign({ id: "existing", folderId: "old-folder", translations: api.EMPTY_TRANSLATIONS });
  assert.equal(writes[0][0], "campaigns/existing");
  assert.equal(writes[0][2].merge, true);
  assert.equal("folderId" in writes[0][1], false);
});
