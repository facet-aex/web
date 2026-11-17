import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export type StudioSection = "hub" | "api" | "actor" | "agent";

export function StudioShell({
  children,
}: {
  activeType?: StudioSection;
  publishableKey?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="page-shell">
      <SiteHeader activeSection="studio" />
      <main className="studio-page-main">{children}</main>
      <SiteFooter />
    </div>
  );
}
