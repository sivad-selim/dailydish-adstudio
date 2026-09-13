import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

let server, PostPreview, PageHeader;
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], server: { middlewareMode: true, ws: false }, appType: 'custom' });
  ({ PostPreview } = await server.ssrLoadModule('/app/components/PostPreview.tsx'));
  ({ PageHeader } = await server.ssrLoadModule('/app/components/PageHeader.tsx'));
});
after(async () => { await server?.close(); });
const base = { galleryAssets: [], gallery: true, publications: [], status: 'ready' };
const render = (props) => renderToStaticMarkup(createElement(PostPreview, { ...base, ...props }));

test('selector card can be wrapped by a button without nested controls', () => {
  const html = renderToStaticMarkup(createElement('button', { type: 'button' }, createElement(PostPreview, base)));
  assert.equal((html.match(/<button\b/g) || []).length, 1);
  assert.match(html, /collections\.svg/);
  assert.match(html, /Non publié/);
  assert.doesNotMatch(render({ gallery: false }), /collections\.svg/);
});
test('post card keeps independent accessible edit, gallery and duplicate controls', () => {
  const html = render({ onOpen() {}, onToggleGallery() {}, expanded: true, actions: createElement('button', { 'aria-label': 'Dupliquer' }) });
  assert.equal((html.match(/<button\b/g) || []).length, 3);
  assert.match(html, /aria-label="Modifier la galerie"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /aria-label="Dupliquer"/);
});
test('publication footer deduplicates languages in EN, FR, BR order and excludes failures', () => {
  const html = render({ publications: [
    { account: 'br', status: 'published' }, { account: 'en', status: 'published' },
    { account: 'en', status: 'published' }, { account: 'fr', status: 'failed' },
  ] });
  assert.match(html, /Publié/);
  assert.equal((html.match(/🇺🇸/gu) || []).length, 1);
  assert.ok(html.indexOf('🇺🇸') < html.indexOf('🇧🇷'));
  assert.doesNotMatch(html, /🇫🇷/u);
  const all = render({ publications: ['br', 'fr', 'en'].map(account => ({ account, status: 'published' })) });
  assert.ok(all.indexOf('🇺🇸') < all.indexOf('🇫🇷') && all.indexOf('🇫🇷') < all.indexOf('🇧🇷'));
});
test('shared headers retain the page heading, description and action controls', () => {
  const html = renderToStaticMarkup(createElement(PageHeader, { title: 'Posts', description: 'Description' }, createElement('button', {}, 'Nouveau dossier')));
  assert.match(html, /<h2>Posts<\/h2>/);
  assert.match(html, /<p>Description<\/p>/);
  assert.match(html, /<button>Nouveau dossier<\/button>/);
});
