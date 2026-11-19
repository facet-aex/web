import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { ClerkAuthBar } from "@/components/clerk-auth-bar";
import { SiteNav, type NavSection } from "@/components/site-nav";

export function SiteHeader({ activeSection }: { activeSection?: NavSection }) {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="FACET home">
        <Image src="/facet-logo.svg" alt="" width={32} height={32} />
        <span>FACET</span>
      </Link>
      <SiteNav {...(activeSection !== undefined ? { activeSection } : {})} />
      <Suspense fallback={<span className="environment">Avalanche</span>}>
        <ClerkAuthBar
          publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
        />
      </Suspense>
    </header>
  );
}
