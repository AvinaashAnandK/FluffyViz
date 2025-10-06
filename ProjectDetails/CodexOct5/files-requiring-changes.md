# Files Requiring Updates

## High Priority
- `fluffy-viz/src/app/api/prompts/[templateId]/route.ts` – `params` is typed as a `Promise` and the API builds an invalid path when template definitions carry a leading slash, so prompt configs fail to load for the column templates.
- `fluffy-viz/src/config/ai-column-templates.ts` – Template `promptFile` entries start with `/`, which breaks `path.join` on the server route; also needs clearer typing around template IDs and stronger error feedback when fetch fails.
- `fluffy-viz/src/components/enhanced-upload.tsx` – Leave-behind `console.log` statements, aggressive optimistic UI, and lack of error surfacing keep format detection previews from showing after sidebar selections; needs refactor to align with the sidebar workflow and to re-run detection when cached files load.
- `fluffy-viz/src/components/spreadsheet/ModelSelector.tsx` – Calls Hugging Face APIs directly from the browser without auth or CORS fallback, leading to runtime failures; should proxy through Next or fall back to cached metadata with robust error UI.
- `fluffy-viz/src/lib/models.ts` – Relies on unrestricted Hugging Face requests and minimal error handling; should inject access tokens via environment config and guard against rate limits/offline states.

## Product Fit & Messaging
- `fluffy-viz/README.md` – Still the default create-next-app instructions; needs an accurate product overview, setup guidance, and workflow notes for FluffyViz.
- `fluffy-viz/src/app/layout.tsx` – Metadata still references “Create Next App”; update title/description and consider injecting open graph metadata that matches the FluffyViz story.
- `fluffy-viz/src/app/page.tsx` – Landing hero is solid but processing results are commented out and multiple `console.log` calls leak to production; restore the results module or replace it with a summary widget, and remove noisy logs.

## Data Handling & Resilience
- `fluffy-viz/src/hooks/use-file-storage.ts` – IndexedDB helpers need guards for unsupported browsers/private modes and should encapsulate custom events (dispatching `window` without existence checks can break server rendering or tests).
- `fluffy-viz/src/lib/ai-inference.ts` – Entirely mocked inference pipeline; must be wired to real provider calls with secrets management, retries, and rate-limit handling before shipping.

## Testing & Quality
- `fluffy-viz/src/lib/__tests__/format-parser.test.ts` – Only asserts config constants; replace with tests that exercise `parseFileContent` and the flattening logic on real fixtures.
- `fluffy-viz/src/hooks/__tests__/use-file-storage.test.ts` – Synthetic constant checks; add behavior-driven tests that cover IndexedDB flows, queueing, and conflict handling.

# Unused / Legacy Remnants
- `fluffy-viz/src/components/spreadsheet/types.ts` – Column interfaces live here but the editor redefines them; consolidate or delete this duplicate file.
- `fluffy-viz/src/components/ui/breadcrumb.tsx`, `ui/command.tsx`, `ui/hover-card.tsx`, `ui/popover.tsx`, `ui/scroll-area.tsx` – Generated shadcn primitives that are not referenced anywhere; remove or move behind a patterns library if they are intentionally parked.
- `fluffy-viz/public/file.svg`, `globe.svg`, `next.svg`, `window.svg`, `vercel.svg` – Default Next.js assets unused in the app.
- Root-level `sample-data/` duplicates the datasets already copied under `fluffy-viz/public/sample-data/`; keep one source of truth to avoid confusion.
- `src/app/` (at repository root) is empty scaffolding from an earlier structure and can be removed once confirmed unused.
