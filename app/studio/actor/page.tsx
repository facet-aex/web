import { ActorStudio } from "@/components/actor-studio";
import { StudioShell } from "@/components/studio-shell";

export default function ActorStudioPage() {
  return (
    <StudioShell activeType="actor">
      <ActorStudio
        publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
      />
    </StudioShell>
  );
}
