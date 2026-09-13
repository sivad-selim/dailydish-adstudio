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

test('store buttons use the supplied Components assets and retain their IDs after a folder move', async () => {
  const {resolveStoreButtonAssets} = await server.ssrLoadModule('/app/storeButtons.ts');
  const settings = {iosAssetId: '', androidAssetId: ''};
  const assets = [
    {id: 'wrong', name: 'store_apple.png', folderId: 'elsewhere'},
    {id: 'ios', name: 'store_apple.png', folderId: 'components'},
    {id: 'android', name: 'store_google.png', folderId: 'components'},
  ];
  const folders = [{id: 'components', name: ' Components '}];
  const resolved = resolveStoreButtonAssets(settings, assets, folders);
  assert.equal(resolved.ios.id, 'ios');
  assert.equal(resolved.android.id, 'android');
  assert.equal(resolveStoreButtonAssets(settings, assets, []).ios, undefined);
  assert.equal(resolveStoreButtonAssets({iosAssetId: 'ios', androidAssetId: 'android'}, assets, []).ios.id, 'ios');
});

test('page previews include both badges in either arrangement, hide them when disabled and identify missing assets', async () => {
  const {PageCanvasPreview} = await server.ssrLoadModule('/app/PageCanvasPreview.tsx');
  const {createDefaultPostPageContent} = await server.ssrLoadModule('/firebase/postPageModel.ts');
  const page = {...createDefaultPostPageContent('post'), id: 'page', updatedAt: 0};
  page.properties.images = [];
  const assets = [{id: 'ios', url: '/apple.png'}, {id: 'android', url: '/google.png'}];
  const preview = (galleryAssets = assets) => renderToStaticMarkup(createElement(PageCanvasPreview, {
    postPage: page, messageTitle: 'Test', messageDescription: '', galleryAssets,
  }));
  assert.doesNotMatch(preview(), /canvas-store-buttons/);
  for (const direction of ['row', 'column']) {
    page.properties.storeButtons = {enabled: true, direction, bottomMargin: 10, scale: 125, iosAssetId: 'ios', androidAssetId: 'android'};
    const html = preview();
    assert.match(html, new RegExp(`flex-direction:${direction};bottom:10%`));
    assert.match(html, /--store-button-width:48cqw/);
    assert.match(html, /class="canvas-image store-button-image" src="\/apple.png" data-gallery-asset-id="ios"/);
    assert.match(html, /src="\/google.png" data-gallery-asset-id="android"/);
    assert.doesNotMatch(html, /data-missing-store-buttons/);
  }
  assert.match(preview([]), /data-missing-store-buttons="true"/);
  page.properties.storeButtons.bottomMargin = 0;
  assert.match(preview(), /bottom:0%/);
});

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

test('Facebook history stays distinct from Instagram for the same country', () => {
  const html = render({publications: [
    {account: 'fr', status: 'published'},
    {account: 'fr', platform: 'facebook', status: 'published'},
    {account: 'br', platform: 'facebook', status: 'failed'},
  ]});
  assert.match(html, /Instagram · France/);
  assert.match(html, /Facebook · France/);
  assert.equal((html.match(/🇫🇷/gu) || []).length, 2);
  assert.doesNotMatch(html, /🇧🇷/u);
});

test('publication editor selects both networks by default', async () => {
  const {InstagramPublicationEditor} = await server.ssrLoadModule('/app/InstagramPublicationEditor.tsx');
  const html = renderToStaticMarkup(createElement(InstagramPublicationEditor, {
    entry: {id: 'entry', postId: 'post'}, postPages: [], assets: [], disabled: false, error: '', remove() {}, close() {},
  }));
  assert.match(html, /checked=""\/>Instagram/);
  assert.match(html, /checked=""\/>Facebook/);
});

test('report shows Facebook alongside legacy Instagram with its country, error and publication link', async () => {
  const {PublicationScheduleReport} = await server.ssrLoadModule('/app/PublicationSchedulePanels.tsx');
  const html = renderToStaticMarkup(createElement(PublicationScheduleReport, {
    timeZone: 'Europe/Paris', items: [
      {id: 'fb', at: 1000, platform: 'facebook', account: 'br', name: 'FB', message: 'Publié sur Facebook', kind: 'success', permalink: 'https://www.facebook.com/123_456'},
      {id: 'ig', at: 999, account: 'fr', name: 'IG', message: 'Instagram refusé', kind: 'error'},
    ],
  }));
  assert.match(html, /<th scope="col">Réseau<\/th>/);
  assert.match(html, /<td>Facebook<\/td>/);
  assert.match(html, /<td>Instagram<\/td>/);
  assert.match(html, /BR/);
  assert.match(html, /Instagram refusé/);
  assert.match(html, /href="https:\/\/www.facebook.com\/123_456"/);
  assert.match(html, /colSpan="5"/i);
});
