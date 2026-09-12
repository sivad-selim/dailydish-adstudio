import type { ReactNode } from "react";

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <header className="studio-page-header">
    <div className="studio-page-heading"><h2>{title}</h2>{description && <p>{description}</p>}</div>
    {children && <div className="studio-page-actions">{children}</div>}
  </header>;
}
