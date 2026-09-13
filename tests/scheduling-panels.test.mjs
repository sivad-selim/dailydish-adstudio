import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
let server, panels;
before(async () => {
  server = await createServer({configFile: false, plugins: [react()], server: {middlewareMode: true, ws: false}, appType: 'custom'});
  panels = await server.ssrLoadModule('/app/PublicationSchedulePanels.tsx');
});
after(async () => {await server?.close();});
test('common settings show Rio and 20:00 and no per-account or per-post time', () => {
  const html = renderToStaticMarkup(createElement(panels.PublicationScheduleSettings, {settings: {time: '20:00', timeZone: 'America/Sao_Paulo', updatedAt: 0}, disabled: false, save: async () => {}}));
  assert.match(html, /value="America\/Sao_Paulo" selected=""/);
  assert.match(html, /value="20:00"/);
  assert.match(html, /EN, FR et BR/);
  assert.equal((html.match(/type="time"/g) || []).length, 1);
});
test('report dates and hours use selected timezone and messages remain escaped', () => {
  const props = {items: [{id: 'r', at: Date.parse('2026-09-13T01:00:00Z'), name: '<Test>', account: 'fr', kind: 'error', message: '<script>error</script>'}]};
  const rio = renderToStaticMarkup(createElement(panels.PublicationScheduleReport, {...props, timeZone: 'America/Sao_Paulo'}));
  const paris = renderToStaticMarkup(createElement(panels.PublicationScheduleReport, {...props, timeZone: 'Europe/Paris'}));
  assert.match(rio, /22:00:00/); assert.match(paris, /03:00:00/);
  assert.match(rio, /&lt;Test&gt;/); assert.doesNotMatch(rio, /<script>/);
});
test('report uses the account-specific title, keeps image-only posts untitled and orders its columns', () => {
  const items = ['en', 'fr', 'br'].map((account) => ({id: account, entryId: 'entry', postId: 'post', at: Date.parse('2026-09-13T01:00:00Z'), name: 'internal-file-name', account, kind: 'success', message: 'Publié avec succès.', titles: {en: 'English title', fr: 'Titre français', br: 'Título brasileiro'}}));
  items.push({...items[0], id: 'photo', titles: {en: '', fr: '', br: ''}});
  const html = renderToStaticMarkup(createElement(panels.PublicationScheduleReport, {items, timeZone: 'America/Sao_Paulo'}));
  for (const title of ['English title', 'Titre français', 'Título brasileiro']) assert.match(html, new RegExp(`<strong>${title}</strong>`));
  assert.doesNotMatch(html, /internal-file-name/);
  assert.match(html, /<th scope="col">Date<\/th><th scope="col">Aperçu<\/th><th scope="col">Réseau<\/th><th scope="col">Langue<\/th><th scope="col">Événement<\/th>/);
  assert.equal((html.match(/<strong>English title<\/strong>/g) || []).length, 1);
});
test('report separates local calendar days and renders numbered pagination', () => {
  const items = ['2026-09-13T03:01:00Z', '2026-09-13T03:00:00Z', '2026-09-13T02:59:00Z'].map((date, index) => ({id: String(index), at: Date.parse(date), account: '', name: 'Réglages', kind: 'info', message: 'Test'}));
  const html = renderToStaticMarkup(createElement(panels.PublicationScheduleReport, {items, timeZone: 'America/Sao_Paulo', page: 2, total: 125}));
  assert.equal((html.match(/class="planner-report-day"/g) || []).length, 2);
  assert.match(html, /51–100 sur 125 événements/);
  assert.match(html, /aria-label="Page 2" aria-current="page"/);
  assert.match(html, /aria-label="Page 3"/);
  assert.deepEqual(panels.reportPageNumbers(1, 1), [1]);
  assert.deepEqual(panels.reportPageNumbers(1, 3), [1, 2, 3]);
  assert.deepEqual(panels.reportPageNumbers(500, 1000), [1, 'gap-498', 498, 499, 500, 501, 502, 'gap-1000', 1000]);
});
