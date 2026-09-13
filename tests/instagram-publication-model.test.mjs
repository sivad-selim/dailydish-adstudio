import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/instagramPublicationModel.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
const {PUBLICATION_ACCOUNTS, publicationTranslation} = exports;
test('BR uses Portuguese and English targets the international account', () => {
  assert.equal(PUBLICATION_ACCOUNTS.find(item => item.id === 'br').language, 'pt');
  assert.equal(PUBLICATION_ACCOUNTS.find(item => item.id === 'en').username, 'mydailydishapp');
});
test('missing translations stay empty, never fall back to another language', () => {
  const message = {translations: {fr: {title: 'Bonjour', description: ''}, en: {title: '', description: 'English only'}}};
  assert.equal(publicationTranslation(message, 'pt').caption, '');
  assert.equal(publicationTranslation(message, 'en').title, '');
  assert.equal(publicationTranslation(message, 'en').caption, 'English only');
  assert.equal(publicationTranslation(message, 'fr').caption, 'Bonjour');
  assert.equal(publicationTranslation(undefined, 'fr').caption, '');
});
