import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const compiled = ts.transpileModule(await readFile(new URL('../app/exportCanvasPng.ts', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;

function fixture({missing = false, fail = false} = {}) {
  const images = ['ios', 'android'].map((id) => ({dataset: {galleryAssetId: id}, src: `https://gallery.test/${id}`}));
  const fetched = [];
  let encoded = false;
  const canvas = {
    querySelector: (selector) => selector === '[data-missing-store-buttons]' && missing ? {} : null,
    querySelectorAll: (selector) => selector === '.canvas-image[data-gallery-asset-id]' ? images : [],
  };
  const exports = {};
  vm.runInNewContext(compiled, {exports, document: {fonts: {ready: Promise.resolve()}},
    window: {setTimeout, clearTimeout, requestAnimationFrame: (fn) => fn(), Image: class {set src(_) {this.onload();}}},
    require: (name) => {
      if (name === './adFormats') return {FORMAT_CONFIG: {portrait: {width: 1080, height: 1350}}};
      if (name === './opaquePng') return {toOpaquePng: async (blob) => blob};
      if (name === '../firebase/gallery') return {getGalleryAssetDataUrl: async ({id}) => {fetched.push(id); return `data:image/png;base64,${id}`;}};
      if (name === 'html-to-image') return {toBlob: async () => {
        encoded = true;
        assert.ok(images.every((image) => image.src.startsWith('data:image/png;')));
        if (fail) throw new Error('Encoding failed');
        return new Blob(['png']);
      }};
      throw new Error(name);
    },
  });
  return {run: () => exports.exportCanvasPng(canvas, 'portrait', [{id: 'ios'}, {id: 'android'}]), images, fetched, encoded: () => encoded};
}

test('shared PNG export embeds both store images and restores preview sources, including on failure', async () => {
  for (const fail of [false, true]) {
    const f = fixture({fail});
    if (fail) await assert.rejects(f.run(), /Encoding failed/); else await f.run();
    assert.deepEqual(f.fetched, ['ios', 'android']);
    assert.equal(f.encoded(), true);
    assert.deepEqual(f.images.map((image) => image.src), ['https://gallery.test/ios', 'https://gallery.test/android']);
  }
});

test('export refuses an enabled but missing badge before encoding an incomplete publication', async () => {
  const f = fixture({missing: true});
  await assert.rejects(f.run(), /App Store et Google Play/);
  assert.equal(f.encoded(), false);
  assert.deepEqual(f.fetched, []);
});
