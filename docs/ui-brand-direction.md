# FACET UI direction

FACET uses an original visual system inspired by the contrast and editorial/technical rhythm of NUSX. Do not copy NUSX logos, text, imagery, proprietary assets or exact page compositions.

## Tokens

```css
:root {
  --facet-ink: #050505;
  --facet-surface: #0d0d0d;
  --facet-surface-raised: #151515;
  --facet-line: #343434;
  --facet-text: #f4f4ef;
  --facet-text-muted: #a8a8a1;
  --facet-lime: #dfff4f;
  --facet-lime-strong: #cfff21;
  --facet-danger: #ff5a5f;
  --facet-warning: #ffc857;
  --facet-success: #82f6b1;
}
```

- Display/body: Inter Tight with system sans fallback.
- Navigation, labels, IDs and status: IBM Plex Mono.
- Use lime for actions/selection, not every surface.
- Prefer hard rectangles, visible 1px dividers and editorial grids over rounded-card mosaics.

## Motion

- A sparse point/constellation field may represent capabilities and trust.
- Decorative motion must be optional, lazy loaded and absent under `prefers-reduced-motion`.
- Ordinary interactions use transforms/opacity around 120–180ms.
- Text, navigation and forms must remain complete without canvas/WebGL.

## Phase 1 patterns

- Facet Store: task-oriented search, mono filter labels and scan-friendly result rows.
- Provider Console: explicit source → parse → operations → auth mapping → review → publish sequence.
- Warnings include exact operation/path context.
- Publication actions are visually distinct and require explicit confirmation.

## Accessibility gate

- WCAG 2.2 AA contrast.
- Complete keyboard operation and visible focus.
- Semantic landmarks, headings, labels and error summaries.
- Never encode state by color alone.
- Usable at 200% zoom and narrow mobile widths.
- Automated checks plus keyboard and screen-reader smoke tests before Phase 1 exit.
