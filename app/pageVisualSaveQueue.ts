import type {PostPage} from "../firebase/postPageModel";

type PageVisual = Pick<PostPage, "id" | "name" | "format" | "theme" | "background" | "backgroundAssetId" | "properties">;
const signature = (page: PageVisual) => JSON.stringify([
  page.name, page.format, page.theme, page.background, page.backgroundAssetId, page.properties,
]);

/** One queue per page shared by autosave and navigation. Only successful writes
 * advance the saved baseline; unsaved local previews must never establish it. */
export function createPageVisualSaveQueue(write: (page: PageVisual) => Promise<void>) {
  const pages = new Map<string, {saved: string; tail: Promise<void>; pending: number}>();
  function entry(id: string) {
    let state = pages.get(id);
    if (!state) {
      state = {saved: "", tail: Promise.resolve(), pending: 0};
      pages.set(id, state);
    }
    return state;
  }
  return {
    loaded(page: PageVisual) {
      const state = entry(page.id);
      if (!state.pending) state.saved = signature(page);
    },
    isSaved(page: PageVisual) {
      const state = pages.get(page.id);
      return Boolean(state && !state.pending && state.saved === signature(page));
    },
    save(page: PageVisual): Promise<void> {
      const state = entry(page.id);
      const snapshot = structuredClone(page);
      const value = signature(snapshot);
      if (!state.pending && state.saved === value) return Promise.resolve();
      state.pending++;
      const task = state.tail.then(async () => {
        if (state.saved === value) return;
        await write(snapshot);
        state.saved = value;
      }).finally(() => { state.pending--; });
      // A failed write still rejects its caller, while allowing an explicit retry.
      state.tail = task.catch(() => undefined);
      return task;
    },
  };
}
