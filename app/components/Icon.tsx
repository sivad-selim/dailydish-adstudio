import type { CSSProperties } from "react";

export type IconName = "content_copy" | "delete" | "edit" | "collections" | "folder" | "home" | "build" | "close" | "add" | "expand_more" | "expand_less" | "swap_horiz" | "chevron_left" | "chevron_right" | "arrow_upward" | "arrow_downward" | "image" | "drag_indicator" | "upload";

/** Locally hosted Google Material icons. Labels belong to their parent control. */
export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return <span className={`studio-icon ${className}`.trim()} aria-hidden="true" style={{ "--icon-url": `url("/icons/material/${name}.svg")` } as CSSProperties} />;
}
