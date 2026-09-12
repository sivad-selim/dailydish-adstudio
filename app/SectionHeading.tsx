import type { ReactNode } from "react";

export function SectionHeading({ as: Tag = "div", className = "", children }: {
  as?: "div" | "summary";
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={`section-heading ${className}`.trim()}>{children}</Tag>;
}
