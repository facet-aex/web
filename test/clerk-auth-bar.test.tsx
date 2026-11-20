import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const clerkMockState = vi.hoisted(() => ({
  signedIn: true,
  username: "taihungg01",
  fullName: "Brian Nguyen Very Long Name",
}));

vi.mock("@clerk/nextjs", () => {
  const UserButtonBase = ({
    appearance,
    children,
  }: {
    appearance?: {
      variables?: { colorBackground?: string };
      elements?: {
        userButtonTrigger?: string;
        userButtonPopoverCard?: { width?: string };
      };
    };
    children?: ReactNode;
  }) => (
    <div data-testid="clerk-user-wrapper">
      <button
        type="button"
        data-testid="clerk-user-avatar"
        className={appearance?.elements?.userButtonTrigger}
        data-bg={appearance?.variables?.colorBackground ?? "light-default"}
        data-popover-width={appearance?.elements?.userButtonPopoverCard?.width}
      >
        avatar
      </button>
      {children ? <div data-testid="clerk-user-menu">{children}</div> : null}
    </div>
  );

  const MenuItems = ({ children }: { children?: ReactNode }) => (
    <div data-testid="clerk-menu-items">{children}</div>
  );
  const Action = ({ label }: { label: string }) => (
    <div data-clerk-action={label}>{label}</div>
  );
  const Link = ({
    label,
    labelIcon,
    href,
  }: {
    label: string;
    labelIcon?: ReactNode;
    href: string;
  }) => (
    <a href={href} data-clerk-link={label}>
      {labelIcon}
      {label}
    </a>
  );

  const UserButton = Object.assign(UserButtonBase, {
    MenuItems,
    Action,
    Link,
  });

  return {
    Show: ({ when, children }: { when: string; children: ReactNode }) => {
      if (when === "signed-in" && clerkMockState.signedIn) {
        return <>{children}</>;
      }
      if (when === "signed-out" && !clerkMockState.signedIn) {
        return <>{children}</>;
      }
      return null;
    },
    SignInButton: ({ children }: { children: ReactNode }) => <>{children}</>,
    SignUpButton: ({ children }: { children: ReactNode }) => <>{children}</>,
    SignUp: () => <div data-testid="clerk-sign-up" />,
    UserButton,
    useUser: () => ({
      isLoaded: true,
      isSignedIn: clerkMockState.signedIn,
      user: clerkMockState.signedIn
        ? {
            username: clerkMockState.username,
            fullName: clerkMockState.fullName,
            primaryEmailAddress: { emailAddress: "tai@example.com" },
          }
        : null,
    }),
  };
});

import { ClerkAuthBar } from "@/components/clerk-auth-bar";
import { getUsernameValidationError } from "@/components/clerk-sign-up-card";
import SignUpPage from "@/app/sign-up/[[...sign-up]]/page";

describe("ClerkAuthBar", () => {
  it("falls back to Avalanche environment badge when no publishable key is configured", () => {
    const markup = renderToStaticMarkup(<ClerkAuthBar />);
    expect(markup).toContain("Avalanche");
    expect(markup).not.toMatch(/\bfuji\b/iu);
  });

  it("renders a full-pill toggleable account chip showing only @username + avatar with compact light popover", () => {
    clerkMockState.signedIn = true;
    const markup = renderToStaticMarkup(
      <ClerkAuthBar publishableKey="pk_test_example" />,
    );

    expect(markup).toContain("account-pill");
    expect(markup).toContain("@taihungg01");
    expect(markup).toContain("facet-clerk-trigger");
    expect(markup).toContain('data-bg="#ffffff"');
    expect(markup).toContain('data-popover-width="240px"');
    expect(markup).toContain('href="/my-facets"');
    expect(markup).toContain("My Facets");
    const manageIdx = markup.indexOf('data-clerk-action="manageAccount"');
    const myFacetsIdx = markup.indexOf('href="/my-facets"');
    const signOutIdx = markup.indexOf('data-clerk-action="signOut"');
    expect(manageIdx).toBeGreaterThan(-1);
    expect(myFacetsIdx).toBeGreaterThan(manageIdx);
    expect(signOutIdx).toBeGreaterThan(myFacetsIdx);
    expect(markup).not.toContain("account-brand-chip");
    expect(markup).not.toContain(">FACET<");
    expect(markup).not.toContain("Facet Store");
    expect(markup).not.toContain("Studio");
    expect(markup).not.toContain("Brian Nguyen Very Long Name");
  });

  it("renders crisp Sign in and Sign up pills when signed out", () => {
    clerkMockState.signedIn = false;
    const markup = renderToStaticMarkup(
      <ClerkAuthBar publishableKey="pk_test_example" />,
    );

    expect(markup).toContain("Sign in");
    expect(markup).toContain("Sign up");
  });

  it("renders a single centered sign-up card without the regex banner and validates usernames live", () => {
    const markup = renderToStaticMarkup(<SignUpPage />);
    expect(markup).toContain('data-testid="clerk-sign-up"');
    expect(markup).not.toContain("Provider Handle Format");
    expect(markup).not.toContain("^[a-z0-9]");

    expect(getUsernameValidationError("pg30_cs3244")).toContain(
      "Only lowercase letters (a–z), numbers (0–9), and hyphens (-) are allowed.",
    );
    expect(getUsernameValidationError("short")).toContain(
      "between 8 and 16 characters",
    );
    expect(getUsernameValidationError("-alice-labs")).toContain(
      "cannot start or end with a hyphen",
    );
    expect(getUsernameValidationError("alice-labs")).toBeNull();
    expect(getUsernameValidationError("taihungg")).toBeNull();
  });
});
