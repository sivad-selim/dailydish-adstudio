import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const code = ts.transpileModule(await readFile(new URL('../firebase/posts.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function setup(records) {
  const db = structuredClone(records);
  const exports = {};
  const sdk = {
    getFirestore: () => 'db', collection: (_, path) => path,
    doc: (...args) => {
      const path = args[0] === 'db' ? args.slice(1).join('/') : `${args[0]}/${args[1] ?? 'new-post'}`;
      return { path, id: path.split('/').at(-1) };
    },
    serverTimestamp: () => 123,
    runTransaction: async (_, callback) => {
      const writes = [];
      await callback({
        get: async ref => ({ exists: () => Boolean(db[ref.path]), data: () => structuredClone(db[ref.path]) }),
        update: (ref, data) => writes.push(() => { db[ref.path] = { ...db[ref.path], ...JSON.parse(JSON.stringify(data)) }; }),
        set: (ref, data) => writes.push(() => { db[ref.path] = JSON.parse(JSON.stringify(data)); }),
        delete: ref => writes.push(() => { delete db[ref.path]; }),
      });
      writes.forEach(write => write());
    },
  };
  vm.runInNewContext(code, { exports, require: name => name === 'firebase/firestore' ? sdk : {
    allowedEmail: 'owner', firebaseApp: {}, firebaseAuth: { currentUser: { email: 'owner' } },
  } });
  return { db, move: exports.transferPostPage, insertCopy: exports.insertDuplicatedPostPage };
}
const page = { postId: 'source', folderId: 'a', campaignId: 'campaign', properties: { images: [{ id: 'image' }], textWidth: 70 } };
const records = {
  'posts/source': { folderId: 'a', type: 'single', pageIds: ['p'] },
  'posts/target': { folderId: 'b', type: 'gallery', pageIds: ['x', 'y'] },
  'creations/p': page,
};
test('inserts a duplicated page immediately after its source, preserving the other pages', async () => {
  const { db, insertCopy } = setup(records);
  await insertCopy('target', 'x', 'copy');
  assert.deepEqual(db['posts/target'].pageIds, ['x', 'copy', 'y']);
  assert.equal(db['posts/target'].folderId, 'b');
});
test('does not attach a duplicate if its source has since left the gallery', async () => {
  const { db, insertCopy } = setup(records);
  await assert.rejects(insertCopy('target', 'missing', 'copy'));
  assert.deepEqual(db, records);
});
test('moves a single into the requested gallery position without copying its content', async () => {
  const { db, move } = setup(records);
  await move('source', 'p', 'target', 'ignored', 'y');
  assert.equal(db['posts/source'], undefined);
  assert.deepEqual(db['posts/target'].pageIds, ['x', 'p', 'y']);
  assert.deepEqual(db['creations/p'], { ...page, postId: 'target', folderId: 'b' });
});
test('extracts a page, creates a new post ID and converts remaining gallery to single', async () => {
  const { db, move } = setup({ ...records, 'posts/source': { folderId: 'a', type: 'gallery', pageIds: ['p', 'q'] } });
  await move('source', 'p', null, 'a');
  assert.deepEqual(db['posts/source'].pageIds, ['q']);
  assert.equal(db['posts/source'].type, 'single');
  assert.equal(db['posts/new-post'].type, 'single');
  assert.deepEqual(db['posts/new-post'].pageIds, ['p']);
  assert.equal(db['creations/p'].postId, 'new-post');
});
test('extracting the final page removes only the empty post container', async () => {
  const { db, move } = setup(records);
  await move('source', 'p', null, 'b');
  assert.equal(db['posts/source'], undefined);
  assert.ok(db['creations/p']);
  assert.equal(db['posts/new-post'].folderId, 'b');
});
test('moving between galleries appends and retains a multi-page source', async () => {
  const { db, move } = setup({ ...records, 'posts/source': { type: 'gallery', pageIds: ['p', 'q', 'r'], folderId: 'a' } });
  await move('source', 'p', 'target', 'b');
  assert.deepEqual(db['posts/target'].pageIds, ['x', 'y', 'p']);
  assert.equal(db['posts/source'].type, 'gallery');
});
test('stale source, missing page and invalid destination fail without any writes', async () => {
  for (const changes of [
    { 'posts/source': { pageIds: ['q'] } },
    { 'creations/p': null },
    { 'posts/target': null },
    { 'posts/target': { type: 'single', pageIds: ['x'] } },
  ]) {
    const initial = { ...records, ...changes };
    const { db, move } = setup(initial);
    await assert.rejects(move('source', 'p', 'target', 'b'));
    assert.deepEqual(db, initial);
  }
});
test('stale insertion position and self transfers leave original data intact', async () => {
  const { db, move } = setup(records);
  await assert.rejects(move('source', 'p', 'target', 'b', 'missing'));
  await assert.rejects(move('source', 'p', 'source', 'a'));
  assert.deepEqual(db, records);
});
