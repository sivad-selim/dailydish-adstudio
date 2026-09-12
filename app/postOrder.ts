import type { StudioPost } from "../firebase/posts";

export function orderFolderPosts(posts: StudioPost[], order: string[] = []): StudioPost[] {
  const ranks = new Map(order.map((id, index) => [id, index]));
  // Preserve the saved drag-and-drop order; new posts appear at the top.
  return [...posts].sort((a, b) => (ranks.get(a.id) ?? -1) - (ranks.get(b.id) ?? -1));
}

export function movePostInOrder(ids: string[], sourceId: string, targetId: string, after: boolean): string[] {
  if (sourceId === targetId || !ids.includes(sourceId) || !ids.includes(targetId)) return ids;
  const result = ids.filter((id) => id !== sourceId);
  result.splice(result.indexOf(targetId) + Number(after), 0, sourceId);
  return result;
}
