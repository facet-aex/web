# FACET UI direction

FACET uses an original visual system inspired by the contrast and editorial/technical rhythm of NUSX. Do not copy NUSX logos, text, imagery, proprietary assets or exact page compositions.

## Logo

The selected mark is Open Gateway. `public/facet-logo.svg` is the transparent square asset for the interface, and `app/icon.svg` uses the same mark for the browser icon. Pair the symbol with FACET in the header. The canonical source is documented in the FACET design baseline.

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

- Display/body: self-hosted Inter Tight with system sans fallback.
- Navigation, labels, IDs and status: self-hosted IBM Plex Mono.
- Both font packages use the SIL Open Font License 1.1.
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

### Implemented Slice 2 workspace

The OpenAPI import workspace uses a persistent step rail, a three-way source switcher, a bounded form column and a separate live-job/operation column. Electric lime marks the selected source and active steps; job state always includes text. On narrow screens the step rail becomes a horizontal four-cell strip and form/status columns stack without changing DOM order.

URL copy must identify the isolated HTTPS fetcher. Upload copy must identify the current JSON-content fallback and state that multipart upload is not implemented. Operation selection is labeled as a local preview until Slice 3 persists Facet drafts.

## Accessibility gate

- WCAG 2.2 AA contrast.
- Complete keyboard operation and visible focus.
- Semantic landmarks, headings, labels and error summaries.
- Never encode state by color alone.
- Usable at 200% zoom and narrow mobile widths.
- Automated checks plus keyboard and screen-reader smoke tests before Phase 1 exit.
