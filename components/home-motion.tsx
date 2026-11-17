"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

export function ScrollReveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion || typeof IntersectionObserver === "undefined") {
      element.classList.add("is-revealed");
      return;
    }

    const revealIfVisible = () => {
      const rect = element.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 0.94) {
        element.classList.remove("is-waiting");
        element.classList.add("is-revealed");
        return true;
      }
      return false;
    };

    if (revealIfVisible()) return;

    element.classList.add("is-waiting");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (
            entry.isIntersecting ||
            entry.boundingClientRect.top <= window.innerHeight
          ) {
            element.classList.remove("is-waiting");
            element.classList.add("is-revealed");
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -36px 0px" },
    );

    observer.observe(element);

    const onScroll = () => {
      if (revealIfVisible()) {
        observer.disconnect();
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const style = delayMs
    ? ({ "--reveal-delay": `${delayMs}ms` } as CSSProperties)
    : undefined;

  return (
    <div
      ref={ref}
      className={className ? `scroll-reveal ${className}` : "scroll-reveal"}
      style={style}
    >
      {children}
    </div>
  );
}

export function HomeScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const ratio =
        docHeight > 0 ? Math.min(Math.max(scrollTop / docHeight, 0), 1) : 0;
      bar.style.transform = `scaleX(${ratio.toFixed(4)})`;
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  return (
    <div ref={barRef} className="home-scroll-progress" aria-hidden="true" />
  );
}
