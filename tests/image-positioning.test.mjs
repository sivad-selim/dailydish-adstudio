import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

let stored = [];
const modules = new Map();
function load(path) {
  if (modules.has(path)) return modules.get(path);
  const exports = {};
  modules.set(path, exports);
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: (name) => {
    if (name.includes('imagePositioning')) return load('../app/imagePositioning.ts');
    if (name === './adFormats') return load('../app/adFormats.ts');
    if (name === './firebaseAuth') return { allowedEmail: 'owner', firebaseAuth: { currentUser: { email: 'owner' } } };
    if (name === 'firebase/firestore') return {
      getFirestore: () => ({}), collection: () => ({}), query: () => ({}), orderBy: () => ({}),
      onSnapshot: (_, callback) => callback({ docs: stored.map((data, id) => ({ id: `${id}`, data: () => data })) }),
    };
    throw new Error(name);
  } });
  return exports;
}
const { centerLegacyImages, changeImageFormat } = load('../app/imagePositioning.ts');
const { FORMAT_CONFIG } = load('../app/adFormats.ts');
const creationApi = load('../firebase/creations.ts');
const height = (format) => 100 * FORMAT_CONFIG[format].height / FORMAT_CONFIG[format].width;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('legacy creations preserve their image centers within half a unit, only once', () => {
  for (const format of Object.keys(FORMAT_CONFIG)) {
    stored = [{ format, properties: { images: [{ id: 'photo', x: 12, y: 38, scale: 125 }] } }];
    let page;
    creationApi.subscribeToCreations((pages) => { page = pages[0]; }, () => {});
    assert.ok(Math.abs(height(format) / 2 + page.properties.images[0].y - (height(format) - height('story') / 2 + 38)) <= 0.5);
    assert.ok(Number.isInteger(page.properties.images[0].y));
    assert.equal(page.properties.formatChangeAnchor, 'bottom');
    assert.equal(page.properties.images[0].x, 12);
    assert.equal(page.properties.images[0].scale, 125);
    assert.equal(centerLegacyImages(page.properties, format), page.properties);
    stored = [page];
    creationApi.subscribeToCreations((pages) => close(pages[0].properties.images[0].y, page.properties.images[0].y), () => {});
  }
});

test('every format conversion preserves the chosen edge and round trips without drift', () => {
  for (const from of Object.keys(FORMAT_CONFIG)) for (const to of Object.keys(FORMAT_CONFIG)) {
    for (const anchor of ['top', 'center', 'bottom']) {
      const properties = { imagePositionVersion: 1, formatChangeAnchor: anchor, images: [{ x: 13, y: 27, scale: 90, rotation: 12 }] };
      const result = changeImageFormat(properties, from, to, anchor);
      const offset = anchor === 'top' ? 0 : anchor === 'center' ? 0.5 : 1;
      assert.ok(Math.abs((height(from) / 2 + 27 - height(from) * offset) -
        (height(to) / 2 + result.images[0].y - height(to) * offset)) <= 0.5);
      assert.ok(Number.isInteger(result.images[0].y));
      close(changeImageFormat(result, to, from, anchor).images[0].y, 27);
      assert.equal(result.images[0].x, 13);
      assert.equal(result.images[0].scale, 90);
      assert.equal(properties.images[0].y, 27);
    }
  }
});

test('previously saved centered fractional positions are rounded without applying the legacy offset again', () => {
  stored = [{ format: 'app-store', properties: { imagePositionVersion: 1, images: [{ id: 'photo', y: 19.75 }] } }];
  creationApi.subscribeToCreations((pages) => assert.equal(pages[0].properties.images[0].y, 20), () => {});
  const properties = { imagePositionVersion: 1, images: [{ y: -19.75 }] };
  assert.equal(centerLegacyImages(properties, 'portrait').images[0].y, -20);
});

test('new creations use centered coordinates and center conversion by default', () => {
  const properties = creationApi.createDefaultCreationProperties();
  assert.equal(properties.imagePositionVersion, 1);
  assert.equal(properties.formatChangeAnchor, 'center');
  for (const format of Object.keys(FORMAT_CONFIG)) {
    const zero = { ...properties, images: [{ x: 0, y: 0 }] };
    assert.equal(changeImageFormat(zero, 'story', format).images[0].y, 0);
  }
});

test('a new conversion defaults to center even when an older creation stored bottom anchoring', () => {
  const properties = { imagePositionVersion: 1, formatChangeAnchor: 'bottom', images: [{ x: 0, y: 12 }] };
  assert.equal(changeImageFormat(properties, 'story', 'app-store').images[0].y, 12);
});
