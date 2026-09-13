import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { crc32, inflateSync } from "node:zlib";
import ts from "typescript";

async function loadSource(path, require = () => { throw new Error("Unexpected import"); }) {
  const compiled = ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require, Blob, Response, CompressionStream, TextEncoder });
  return exports;
}
const { FORMAT_CONFIG } = await loadSource("../app/adFormats.ts");
const { encodeRgbPng } = await loadSource("../app/opaquePng.ts");

function decodeChunks(bytes) {
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const chunks = {};
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    assert.equal(bytes.readUInt32BE(offset + 8 + length), crc32(bytes.subarray(offset + 4, offset + 8 + length)));
    chunks[type] = data;
    offset += length + 12;
  }
  assert.ok(chunks.IEND);
  return chunks;
}

for (const format of ["portrait", "story", "app-store"]) {
  test(`${format} exports its full resolution as a 24-bit PNG without alpha`, async () => {
    const { width, height } = FORMAT_CONFIG[format];
    const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
    const png = await encodeRgbPng(width, height, pixels);
    const chunks = decodeChunks(Buffer.from(await png.arrayBuffer()));
    assert.equal(chunks.IHDR.readUInt32BE(0), width);
    assert.equal(chunks.IHDR.readUInt32BE(4), height);
    assert.equal(chunks.IHDR[8], 8);
    assert.equal(chunks.IHDR[9], 2);
    assert.equal(chunks.tRNS, undefined);
    assert.equal(inflateSync(chunks.IDAT).length, (width * 3 + 1) * height);
  });
}

test("PNG filtering preserves pixel colors", async () => {
  const png = await encodeRgbPng(2, 2, new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 123, 45, 67, 255,
  ]));
  const { IDAT } = decodeChunks(Buffer.from(await png.arrayBuffer()));
  const rows = inflateSync(IDAT);
  const rgb = [];
  for (let y = 0; y < 2; y++) {
    assert.equal(rows[y * 7], 1);
    for (let x = 0; x < 6; x++) {
      rgb.push((rows[y * 7 + 1 + x] + (x >= 3 ? rgb[rgb.length - 3] : 0)) & 255);
    }
  }
  assert.deepEqual(rgb, [255, 0, 0, 0, 255, 0, 0, 0, 255, 123, 45, 67]);
});

test("App Store format survives saving and reloading", async () => {
  let saved;
  const sdk = {
    getFirestore: () => ({}), collection: () => ({}), doc: () => ({}),
    query: () => ({}), orderBy: () => ({}), serverTimestamp: () => null,
    runTransaction: async (_, operation) => operation({
      get: async () => ({id: "page", exists: () => true, data: () => saved ?? {}}),
      update: (_, data) => { saved = {...saved, ...data}; },
    }),
    onSnapshot: (_, callback) => callback({ docs: [{ id: "creation", data: () => saved }] }),
  };
  const messages = await loadSource("../firebase/messages.ts");
  const model = await loadSource("../firebase/postPageModel.ts");
  const positioning = await loadSource("../app/imagePositioning.ts", () => ({FORMAT_CONFIG}));
  const api = await loadSource("../firebase/postPages.ts", (name) => {
    if (name === "../app/imagePositioning") return positioning;
    if (name === "./messages") return messages;
    if (name === "./postPageModel") return model;
    if (name === "firebase/firestore") return sdk;
    if (name === "./firebaseAuth") return { firebaseApp: {}, allowedEmail: "owner", firebaseAuth: { currentUser: { email: "owner" } } };
    throw new Error(name);
  });
  await api.savePostPage({...api.readPostPage("page", {}), name: "Test", format: "app-store"});
  api.subscribeToPostPages(([postPage]) => assert.equal(postPage.format, "app-store"), assert.fail);
  assert.equal(FORMAT_CONFIG.story.width, 1080);
  assert.equal(FORMAT_CONFIG.story.height, 1920);
});
