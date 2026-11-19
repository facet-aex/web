import Link from "next/link";

import { StudioShell } from "@/components/studio-shell";

export default function AgentStudioPage() {
  return (
    <StudioShell activeType="agent">
      <section
        className="studio-coming-soon"
        aria-labelledby="agent-soon-title"
      >
        <div className="modality-pill-row">
          <span className="badge-type badge-modality-agent">
            ◈ FACET · AGENT
          </span>
          <span className="pricing-soon-badge">COMING SOON</span>
        </div>

        <h1 id="agent-soon-title">Agent Studio</h1>

        <p className="studio-coming-soon-copy">
          Agent Studio is temporarily paused while we redesign the Agent
          authoring workflow. Existing published Agents remain available in
          Store, and both <strong>Actor Studio</strong> and{" "}
          <strong>API Studio</strong> are ready to publish now.
        </p>

        <div className="studio-coming-soon-actions">
          <Link className="button button-primary" href="/studio/actor">
            Open Actor Studio <span aria-hidden="true">↗</span>
          </Link>
          <Link className="button button-secondary" href="/studio/api">
            Open API Studio <span aria-hidden="true">↗</span>
          </Link>
          <Link className="button button-ghost" href="/store?type=AGENT">
            Browse Agents in Store <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </StudioShell>
  );
}
