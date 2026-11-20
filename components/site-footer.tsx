import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <strong>FACET</strong>
        <span>One Facet Standard · API · Actor · Agent on Avalanche</span>
      </div>
      <nav className="footer-links" aria-label="Footer navigation">
        <Link href="/store">Facet Store</Link>
        <Link href="/studio">Studio</Link>
        <Link href="/docs">Docs</Link>
        <Link href="/faucet">Faucet</Link>
      </nav>
    </footer>
  );
}
