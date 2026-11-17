import { ApiStudio } from "@/components/api-studio";
import { StudioShell } from "@/components/studio-shell";

export default function ApiStudioPage() {
  return (
    <StudioShell activeType="api">
      <ApiStudio
        publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
      />
    </StudioShell>
  );
}
