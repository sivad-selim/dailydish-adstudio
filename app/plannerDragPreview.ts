/** Keep the visual under the pointer independently of native drag-image offsets. */
export function startPlannerDragPreview(
  source: HTMLElement,
  transfer: DataTransfer,
  pointer: { clientX: number; clientY: number },
  ordered: boolean,
): () => void {
  const bounds = source.getBoundingClientRect();
  const offsetX = pointer.clientX - bounds.left;
  const offsetY = pointer.clientY - bounds.top;
  const overlay = document.createElement("div");
  overlay.className = "publication-calendar planner-drag-preview";
  overlay.setAttribute("aria-hidden", "true");
  Object.assign(overlay.style, {
    position: "fixed", left: "0", top: "0", zIndex: "2147483647",
    width: `${bounds.width}px`, height: `${bounds.height}px`,
    maxWidth: "none", padding: "0", margin: "0", pointerEvents: "none",
    overflow: "hidden", opacity: ".85",
  });
  const context = document.createElement("div");
  context.className = ordered ? "planner-order-list" : "planner-unscheduled-grid";
  Object.assign(context.style, { display: "block", minWidth: "0", width: "100%", padding: "0" });
  const card = source.cloneNode(true) as HTMLElement;
  card.removeAttribute("draggable");
  card.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
  Object.assign(card.style, { width: `${bounds.width}px`, height: `${bounds.height}px`, margin: "0" });
  context.appendChild(card);
  overlay.appendChild(context);

  // Native drag/drop still handles destinations; only its browser snapshot is hidden.
  const transparentImage = document.createElement("canvas");
  transparentImage.width = transparentImage.height = 2;
  // macOS may substitute a globe for an entirely empty drag bitmap.
  // Keep a nearly invisible painted pixel so the native bitmap is not empty.
  const bitmap = transparentImage.getContext("2d");
  if (bitmap) {
    bitmap.fillStyle = "rgba(255, 255, 255, 0.01)";
    bitmap.fillRect(0, 0, 2, 2);
  }
  transfer.setDragImage(transparentImage, 1, 1);

  const move = (event: { clientX: number; clientY: number }) => {
    overlay.style.transform = `translate3d(${event.clientX - offsetX}px, ${event.clientY - offsetY}px, 0)`;
  };
  move(pointer);
  document.body.appendChild(overlay);
  document.addEventListener("dragover", move, true);
  const cleanup = () => {
    overlay.remove();
    document.removeEventListener("dragover", move, true);
    document.removeEventListener("drop", cleanup, true);
    document.removeEventListener("dragend", cleanup, true);
  };
  document.addEventListener("drop", cleanup, true);
  document.addEventListener("dragend", cleanup, true);
  return cleanup;
}
