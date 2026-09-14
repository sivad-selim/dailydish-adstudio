import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/textTypography.ts', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText, {exports});
const {formatDisplayText: format} = exports;

test('French speech keeps opening quote and closing punctuation attached to words', () => {
  const source = '« Rapide, végé, au four… Donne-moi tes ingrédients et tes critères, on cherche avec tout ça ! »';
  assert.equal(format(source, 'fr'), '«\u00a0Rapide, végé, au four… Donne-moi tes ingrédients et tes critères, on cherche avec tout ça\u202f!\u00a0»');
  assert.equal(format('Prêt ? Oui ! Menu : rapide ; végé.', 'fr'), 'Prêt\u202f? Oui\u202f! Menu\u00a0: rapide\u202f; végé.');
});
test('English and Portuguese retain ordinary attached punctuation and quotes', () => {
  for (const lang of ['en', 'pt']) {
    assert.equal(format('“Ready?” (yes!) [ok].', lang), '“Ready?” (yes!) [ok].');
    assert.equal(format('« Olá ! »', lang), '«\u00a0Olá\u00a0!\u00a0»');
  }
});
test('formatting is idempotent and preserves empty text, URLs, times and explicit newlines', () => {
  for (const source of ['', ' ', 'https://example.com/a?b=c! 19:30 me@example.com', 'Bonjour\n!\n»', '« Déjà\u00a0: prêt\u202f! »', '[ test ] ( oui )']) {
    const result = format(source, 'fr');
    assert.equal(format(result, 'fr'), result);
    if (!source.includes('«') && !source.startsWith('[')) assert.equal(result, source);
  }
  assert.equal(format('[ test ] ( oui )', 'fr'), '[\u00a0test\u00a0] (\u00a0oui\u00a0)');
});
