"use client";

export type StudioStepState = "current" | "done" | "available" | "locked";

export interface StudioStageItem {
  step: 1 | 2 | 3 | 4;
  code: string;
  label: string;
  state: StudioStepState;
}

const STEP_STATUS_LABELS: Record<StudioStepState, string> = {
  current: "Active",
  done: "Done",
  available: "Ready",
  locked: "Locked",
};

/**
 * Computes sequential 4-step studio progress from validation status and explicit completion.
 */
export function computeStudioProgress(params: {
  activeStep: number;
  completedUpTo: number;
  stepValidities: readonly [boolean, boolean, boolean];
  finished?: boolean;
}): {
  effectiveCompletedUpTo: number;
  maxReachableStep: 1 | 2 | 3 | 4;
  clampedActiveStep: 1 | 2 | 3 | 4;
  getState: (step: 1 | 2 | 3 | 4) => StudioStepState;
} {
  const {
    activeStep,
    completedUpTo,
    stepValidities,
    finished = false,
  } = params;

  let effectiveCompletedUpTo = 0;
  if (stepValidities[0] && completedUpTo >= 1) {
    effectiveCompletedUpTo = 1;
    if (stepValidities[1] && completedUpTo >= 2) {
      effectiveCompletedUpTo = 2;
      if (stepValidities[2] && completedUpTo >= 3) {
        effectiveCompletedUpTo = finished ? 4 : 3;
      }
    }
  }

  const maxReachableStep = Math.min(4, effectiveCompletedUpTo + 1) as
    1 | 2 | 3 | 4;
  const clampedActiveStep = Math.min(
    Math.max(1, activeStep),
    maxReachableStep,
  ) as 1 | 2 | 3 | 4;

  function getState(step: 1 | 2 | 3 | 4): StudioStepState {
    if (step === clampedActiveStep) {
      return finished && step === 4 ? "done" : "current";
    }
    if (step <= effectiveCompletedUpTo) {
      return "done";
    }
    if (step <= maxReachableStep) {
      return "available";
    }
    return "locked";
  }

  return {
    effectiveCompletedUpTo,
    maxReachableStep,
    clampedActiveStep,
    getState,
  };
}

export function StudioStageBar({
  ariaLabel,
  accent,
  steps,
  onSelectStep,
}: {
  ariaLabel: string;
  accent: "actor" | "agent";
  steps: StudioStageItem[];
  onSelectStep: (step: 1 | 2 | 3 | 4) => void;
}) {
  return (
    <ol
      className={`rapid-stage-bar studio-stage-bar studio-stage-bar-${accent}`}
      aria-label={ariaLabel}
    >
      {steps.map((item) => {
        const locked = item.state === "locked";
        const isCurrent = item.state === "current";
        const isActive = item.state === "current" || item.state === "done";

        return (
          <li
            key={item.step}
            data-active={isActive ? "true" : "false"}
            data-state={item.state}
          >
            <button
              type="button"
              className="studio-stage-button"
              disabled={locked}
              aria-current={isCurrent ? "step" : undefined}
              onClick={() => {
                if (!locked) {
                  onSelectStep(item.step);
                }
              }}
            >
              <span className="studio-stage-code">
                {item.state === "done" ? "✓" : item.code}
              </span>
              <span className="studio-stage-label">{item.label}</span>
              <span className="studio-stage-pill">
                {STEP_STATUS_LABELS[item.state]}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
