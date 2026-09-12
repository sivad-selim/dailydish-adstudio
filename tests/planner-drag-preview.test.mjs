import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('preview preserves the grab offset and removes its listeners on drop or cancellation', () => {
  for (const ending of ['drop', 'dragend', 'unmount']) {
    const listeners = new Map();
    const element = () => ({ getContext: () => ({ fillRect() {} }), style: {}, children: [], setAttribute() {}, removeAttribute() {}, querySelectorAll: () => [], appendChild(child) { this.children.push(child); }, remove() { this.removed = true; } });
    const document = { body: element(), createElement: element, addEventListener(name, callback) { listeners.set(name, callback); }, removeEventListener(name) { listeners.delete(name); } };
    const exports = {};
    vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/plannerDragPreview.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, document });
    const source = { getBoundingClientRect: () => ({ left: 420, top: 200, width: 210, height: 320 }), cloneNode: element };
    let nativeImage;
    const cleanup = exports.startPlannerDragPreview(source, { setDragImage(image) { nativeImage = image; } }, { clientX: 460, clientY: 260 }, false);
    const overlay = document.body.children[0];
    assert.equal(nativeImage.width, 2);
    assert.equal(overlay.style.transform, 'translate3d(420px, 200px, 0)');
    listeners.get('dragover')({ clientX: 800, clientY: 600 });
    assert.equal(overlay.style.transform, 'translate3d(760px, 540px, 0)');
    assert.equal(overlay.children[0].children.length, 1);
    if (ending === 'unmount') cleanup(); else listeners.get(ending)();
    assert.equal(overlay.removed, true);
    assert.equal(listeners.size, 0);
    cleanup();
  }
});
