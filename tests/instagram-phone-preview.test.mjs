import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
let server, preview;
before(async () => {
  server = await createServer({ configFile: false, plugins: [react()], server: { middlewareMode: true, ws: false }, appType: 'custom' });
  preview = await server.ssrLoadModule('/app/components/InstagramPhonePreview.tsx');
});
after(async () => { await server?.close(); });
test('phone dimensions stay independent of artwork, while artwork fits without cropping', () => {
  for (const phone of Object.keys(preview.PREVIEW_PHONES)) {
    const portrait = preview.phonePreviewSize(phone, 620, 1080, 1350);
    const story = preview.phonePreviewSize(phone, 620, 1080, 1920);
    const store = preview.phonePreviewSize(phone, 620, 1320, 2868);
    assert.equal(portrait.height, story.height);
    assert.equal(portrait.height, store.height);
    for (const [size, w, h] of [[portrait,1080,1350],[story,1080,1920],[store,1320,2868]]) {
      assert.ok(size.imageWidth <= size.width);
      assert.ok(size.imageWidth * h / w <= size.height + 0.001);
    }
  }
});
test('disabled phone returns artwork only; enabled phone keeps guides outside export root', () => {
  const props = { phone: 'pixel-10-pro-xl', previewWidth: 620, imageWidth: 1080, imageHeight: 1350, showAdButton: true,
    children: width => createElement('div', { id: 'export-root', 'data-width': width }, 'artwork') };
  const off = renderToStaticMarkup(createElement(preview.InstagramPhonePreview, { ...props, enabled: false }));
  assert.equal(off, '<div id="export-root" data-width="620">artwork</div>');
  const on = renderToStaticMarkup(createElement(preview.InstagramPhonePreview, { ...props, enabled: true }));
  assert.match(on, /artwork<\/div><\/div><div aria-hidden="true" class="instagram-guides-overlay"/);
  assert.match(on, /Voir le profil Instagram/);
  const hiddenButton = renderToStaticMarkup(createElement(preview.InstagramPhonePreview, { ...props, enabled: true, showAdButton: false }));
  assert.doesNotMatch(hiddenButton, /Voir le profil Instagram/);
});

test('devices retain their relative physical screen sizes at the same zoom', () => {
  const iphone = preview.phonePreviewSize('iphone-12', 620, 1080, 1920);
  const pixel = preview.phonePreviewSize('pixel-10-pro-xl', 620, 1080, 1920);
  // Physical bounds from manufacturer resolution / ppi: about 64.60 × 139.81 mm
  // versus 70.24 × 156.37 mm, not identical widths.
  assert.ok(Math.abs(iphone.width / pixel.width - 64.60 / 70.24) < 0.001);
  assert.ok(Math.abs(iphone.height / pixel.height - 139.81 / 156.37) < 0.001);
  const se = preview.phonePreviewSize('iphone-se', 620, 1080, 1920);
  assert.ok(se.width < iphone.width && se.height < iphone.height);
  for (const phone of Object.keys(preview.PREVIEW_PHONES)) {
    const size = preview.phonePreviewSize(phone, 620, 1080, 1920);
    const zoomed = preview.phonePreviewSize(phone, 1240, 1080, 1920);
    assert.ok(size.width <= 620);
    assert.equal(zoomed.width, size.width * 2);
    assert.equal(zoomed.height, size.height * 2);
  }
});
