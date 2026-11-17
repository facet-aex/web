import { AgentStudio } from "@/components/agent-studio";
import { StudioShell } from "@/components/studio-shell";

export default function AgentStudioPage() {
  return (
    <StudioShell activeType="agent">
      <AgentStudio
        publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
      />
    </StudioShell>
  );
}
