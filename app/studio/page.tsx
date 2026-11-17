import { StudioHubClient } from "@/components/studio-hub-client";
import { StudioShell } from "@/components/studio-shell";

export default function StudioHubPage() {
  return (
    <StudioShell activeType="hub">
      <StudioHubClient />
    </StudioShell>
  );
}
