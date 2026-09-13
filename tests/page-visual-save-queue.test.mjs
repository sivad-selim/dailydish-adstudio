import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
vm.runInNewContext(ts.transpileModule(
  readFileSync(new URL('../app/pageVisualSaveQueue.ts', import.meta.url), 'utf8'),
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}},
).outputText, {exports, structuredClone});
const {createPageVisualSaveQueue} = exports;
const page = (x = 0) => ({id: 'page-1', name: 'Page', format: 'portrait', theme: 'daily',
  background: 'cream', backgroundAssetId: '', properties: {images: [{id: 'image', x}]}});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
};

test('visiting an unchanged page does not call the server', async () => {
  let calls = 0;
  const queue = createPageVisualSaveQueue(async () => {calls++;});
  queue.loaded(page());
  await queue.save({...page(), translations: {fr: {title: 'Text has its own save'}}});
  assert.equal(calls, 0);
  assert.equal(queue.isSaved(page()), true);
});

test('navigation waits for an in-flight autosave instead of saving twice', async () => {
  const gate = deferred();
  let calls = 0, canLeave = false;
  const queue = createPageVisualSaveQueue(async () => {calls++; await gate.promise;});
  queue.loaded(page());
  const autosave = queue.save(page(10));
  const navigation = queue.save(page(10)).then(() => {canLeave = true;});
  await Promise.resolve();
  assert.equal(canLeave, false);
  assert.equal(queue.isSaved(page(10)), false);
  gate.resolve();
  await Promise.all([autosave, navigation]);
  assert.equal(canLeave, true);
  assert.equal(calls, 1);
});

test('a newer layout waits for the older write and is persisted last', async () => {
  const first = deferred(), second = deferred();
  const writes = [];
  let canLeave = false;
  const queue = createPageVisualSaveQueue(async value => {
    writes.push(value.properties.images[0].x);
    await (writes.length === 1 ? first.promise : second.promise);
  });
  queue.loaded(page());
  const autosave = queue.save(page(10));
  const navigation = queue.save(page(20)).then(() => {canLeave = true;});
  await Promise.resolve();
  assert.deepEqual(writes, [10]);
  first.resolve();
  await autosave;
  await Promise.resolve();
  assert.deepEqual(writes, [10, 20]);
  assert.equal(canLeave, false);
  second.resolve();
  await navigation;
  assert.equal(queue.isSaved(page(20)), true);
  assert.equal(queue.isSaved(page(10)), false);
});

test('returning to the original layout during a write still saves the reversal', async () => {
  const gate = deferred();
  const writes = [];
  const queue = createPageVisualSaveQueue(async value => {
    writes.push(value.properties.images[0].x);
    if (writes.length === 1) await gate.promise;
  });
  queue.loaded(page());
  const first = queue.save(page(10));
  const undo = queue.save(page());
  gate.resolve();
  await Promise.all([first, undo]);
  assert.deepEqual(writes, [10, 0]);
  assert.equal(queue.isSaved(page()), true);
});

test('a failed save rejects navigation, retains the dirty layout and allows retry', async () => {
  let fails = true, canLeave = false;
  const queue = createPageVisualSaveQueue(async () => {if (fails) throw new Error('Offline');});
  queue.loaded(page());
  await assert.rejects(queue.save(page(20)).then(() => {canLeave = true;}), /Offline/);
  assert.equal(canLeave, false);
  assert.equal(queue.isSaved(page(20)), false);
  fails = false;
  await queue.save(page(20));
  assert.equal(queue.isSaved(page(20)), true);
});

test('edits made while saving remain dirty until they are saved too', async () => {
  const gate = deferred();
  const writes = [];
  const queue = createPageVisualSaveQueue(async value => {
    writes.push(value.properties.images[0].x);
    if (writes.length === 1) await gate.promise;
  });
  queue.loaded(page());
  const draft = page(10);
  const saving = queue.save(draft);
  draft.properties.images[0].x = 30;
  await Promise.resolve();
  assert.deepEqual(writes, [10]);
  gate.resolve();
  await saving;
  assert.equal(queue.isSaved(draft), false);
  await queue.save(draft);
  assert.deepEqual(writes, [10, 30]);
  assert.equal(queue.isSaved(draft), true);
});
