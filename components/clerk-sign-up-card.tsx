"use client";

import { SignUp } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

import { isValidUsername } from "@/lib/identifiers";

export const USERNAME_RULE_HINT =
  "8–16 characters: lowercase letters (a–z), numbers (0–9), and hyphens (-) only.";

export function getUsernameValidationError(rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) return null;
  if (/[^a-z0-9-]/u.test(value)) {
    return "Only lowercase letters (a–z), numbers (0–9), and hyphens (-) are allowed.";
  }
  if (value.startsWith("-") || value.endsWith("-")) {
    return "Username cannot start or end with a hyphen (-).";
  }
  if (value.length < 8 || value.length > 16) {
    return "Username must be between 8 and 16 characters.";
  }
  return isValidUsername(value) ? null : USERNAME_RULE_HINT;
}

const HINT_ATTR = "data-facet-username-hint";

export function ClerkSignUpCard() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const findUsernameInput = (): HTMLInputElement | null =>
      container.querySelector<HTMLInputElement>(
        'input[name="username"], input#username-field',
      );

    const ensureHintElement = (
      input: HTMLInputElement,
    ): HTMLParagraphElement => {
      const parent =
        input.closest(".cl-formField") ?? input.parentElement ?? container;
      let hint = parent.querySelector<HTMLParagraphElement>(`[${HINT_ATTR}]`);
      if (!hint) {
        hint = document.createElement("p");
        hint.setAttribute(HINT_ATTR, "true");
        hint.setAttribute("role", "status");
        hint.setAttribute("aria-live", "polite");
        hint.style.margin = "6px 0 0";
        hint.style.fontSize = "12px";
        hint.style.lineHeight = "1.4";
        hint.style.color = "#52525b";
        hint.textContent = USERNAME_RULE_HINT;
        parent.appendChild(hint);
      }
      return hint;
    };

    const syncValidation = (forceRequired = false): boolean => {
      const input = findUsernameInput();
      if (!input) return true;
      const hint = ensureHintElement(input);
      const trimmed = input.value.trim();
      const error =
        forceRequired && !trimmed
          ? USERNAME_RULE_HINT
          : getUsernameValidationError(trimmed);

      const nextText = error ?? USERNAME_RULE_HINT;
      const nextColor = error ? "#dc2626" : "#52525b";
      if (hint.textContent !== nextText) {
        hint.textContent = nextText;
      }
      if (hint.style.color !== nextColor) {
        hint.style.color = nextColor;
      }

      if (error) {
        input.style.borderColor = "#dc2626";
        input.style.boxShadow = "0 0 0 1px #dc2626";
        if (input.getAttribute("aria-invalid") !== "true") {
          input.setAttribute("aria-invalid", "true");
        }
        return false;
      }

      if (input.style.borderColor) input.style.borderColor = "";
      if (input.style.boxShadow) input.style.boxShadow = "";
      if (input.hasAttribute("aria-invalid")) {
        input.removeAttribute("aria-invalid");
      }
      return true;
    };

    const handleInput = (event: Event) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement &&
        (target.name === "username" || target.id === "username-field")
      ) {
        syncValidation(false);
      }
    };

    const handleSubmitOrClick = (event: Event) => {
      const input = findUsernameInput();
      if (!input) return;
      if (event.type === "click") {
        const target = event.target;
        const button =
          target instanceof Element ? target.closest("button") : null;
        if (!button) return;
        const isSubmitButton =
          button.type === "submit" ||
          button.classList.contains("cl-formButtonPrimary");
        if (!isSubmitButton) return;
      }
      if (!syncValidation(true)) {
        event.preventDefault();
        event.stopPropagation();
        input.focus();
      }
    };

    const observer = new MutationObserver(() => {
      const input = findUsernameInput();
      if (!input) return;
      const parent =
        input.closest(".cl-formField") ?? input.parentElement ?? container;
      if (!parent.querySelector(`[${HINT_ATTR}]`)) {
        ensureHintElement(input);
      }
    });

    observer.observe(container, { childList: true, subtree: true });
    container.addEventListener("input", handleInput, true);
    container.addEventListener("blur", handleInput, true);
    container.addEventListener("submit", handleSubmitOrClick, true);
    container.addEventListener("click", handleSubmitOrClick, true);

    const initialInput = findUsernameInput();
    if (initialInput) ensureHintElement(initialInput);

    return () => {
      observer.disconnect();
      container.removeEventListener("input", handleInput, true);
      container.removeEventListener("blur", handleInput, true);
      container.removeEventListener("submit", handleSubmitOrClick, true);
      container.removeEventListener("click", handleSubmitOrClick, true);
    };
  }, []);

  return (
    <div ref={containerRef}>
      <SignUp />
    </div>
  );
}
