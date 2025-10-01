# AI Spreadsheet Integration Final Plan (Codex)

## Understanding `@spreadsheet-extract`
- `spreadsheet-extract/src/components/Spreadsheet.tsx` bootstraps spreadsheet state from static `SAMPLE_DATA`, generates column metadata on the fly, and wires the `AddColumnModal` + `SpreadsheetTable` pair. Columns carry optional AI metadata (`model`, `provider`, `prompt`, `taskType`) but no inference call is performed yet.
- `SpreadsheetTable` in `spreadsheet-extract/src/components/SpreadsheetTable.tsx` renders an Excel-like grid: editable textarea cells, click-to-select, drag-to-fill, template chooser, and temporary empty rows. Styling is bespoke Tailwind classes leaning on gray/blue palette.
- `AddColumnModal` in `spreadsheet-extract/src/components/AddColumnModal.tsx` collects prompt + provider/model selection. Provider and model registries (`spreadsheet-extract/src/lib/providers.ts`, `spreadsheet-extract/src/types/models.ts`) assume client-side config persisted via helper utilities, with optional "search web" flag but no integration logic.
- Auxiliary UI like `ConfigurationModal`, `ModelSelector`, and `ProviderSelector` expand the provider configuration experience but depend on the same local state assumptions (no backend, no persisted auth beyond local storage).
- Net result: a self-contained front-end spreadsheet experience suited for import; to embed inside FluffyViz we must externalize data initialization (replace `SAMPLE_DATA`), expose callbacks for persistence/backfill, and restyle to FluffyViz design tokens without regressing interaction affordances.

## Developer Plan Comparison

### Plan 1 – "AI Spreadsheet Integration Plan"
**Pros**
- Aligns naturally with existing `EnhancedUpload` lifecycle by capturing `UploadResult` from `onDataUploaded` and rendering the spreadsheet inline or via lightweight view toggles.
- Focuses on data adapters and state wiring before stylistic polish, reducing immediate scope risk while still identifying necessary Tailwind-to-token adjustments for consistency.
- Breaks work into incremental steps (packaging, transformer, wiring, UI integration, styling, QA) that map cleanly onto current code structure in `fluffy-viz/src/app/page.tsx` and `@spreadsheet-extract` components.
- Leaves room for future AI inference integration without blocking the initial embedding.

**Cons**
- Presents multiple rendering options (inline vs new route) without converging on one, which may prolong decision-making.
- Omits discussion of how stored files (`useFileStorage`, `savedFileId`) should keep spreadsheet state in sync, creating a potential UX gap when reloading past uploads.
- Understates the theming lift required to bridge from the spreadsheet's bespoke styles to FluffyViz's shadcn tokens and dark-mode requirements.

### Plan 2 – "AI Spreadsheet Integration Plan – Avinaash"
**Pros**
- Demonstrates deep awareness of spreadsheet capabilities (templates, drag fill, provider support) and sketches rich future enhancements (feedback loops, few-shot prompts, regeneration flows).
- Commits to a dedicated `/edit/[fileId]` route, clarifying navigation by positioning the spreadsheet as a distinct workflow stage after upload.
- Highlights data-mapping requirements (column letter mapping, type inference) and envisions UI affordances (hover actions, regenerate buttons) that could elevate the experience long-term.

**Cons**
- Introduces substantial scope creep (new route, workflow step redefinition, feedback capture, provider hooks) before the base embedding is proven; many referenced hooks (`useAIProviderConfig`) do not exist in FluffyViz today.
- Redirecting immediately after `processData()` assumes persistence success and may bypass the current preview/validation messaging users rely on in `EnhancedUpload`.
- Styling guidance is high-level ("wrap in shadcn Card") but lacks concrete mapping from existing spreadsheet classes to FluffyViz tokens, risking mismatched UI if implemented hastily.
- Advanced AI interactions (column regeneration, few-shot prompt crafting) depend on backend capabilities and telemetry not yet available, which could stall delivery.

## Recommended Approach
Adopt Plan 1's incremental, inline integration as the foundation, while borrowing Plan 2's clarity around data mapping and future navigation without committing to its full scope. Keep the spreadsheet within the existing upload page for the first iteration, gated by a dedicated "Edit in Spreadsheet" view toggle. Defer route-level refactors, feedback UIs, and provider sync until the component is stable inside the current flow. This balances rapid availability with a clear path to evolve toward Plan 2's richer roadmap.

## Implementation Phases
1. **Component Hardening**
   - Refactor `Spreadsheet` to accept `rows`, `columns`, and callbacks as props; extract the `SAMPLE_DATA` bootstrap into a helper so FluffyViz can supply `UploadResult` data.
   - Ensure column metadata supports externally provided IDs/names and expose hooks for persistence (e.g., `onColumnAdd`, `onCellChange`).

2. **Data Adapter & State Wiring**
   - In `fluffy-viz/src/app/page.tsx`, capture `UploadResult` rows and derive column definitions using a helper (e.g., `mapUploadResultToSpreadsheet(uploadResult)`), normalizing types and guarding against missing fields.
   - Track spreadsheet state locally (rows + metadata) so edits persist across rerenders and when reopening saved files through `useFileStorage`.

3. **UI Integration in Upload Flow**
   - Introduce a post-upload section beneath `EnhancedUpload` that renders a `SpreadsheetSection` once data is processed. Provide tabs or pills ("Preview", "Spreadsheet") so users can switch between the existing preview/stats and the editable grid.
   - Ensure the section resets when `EnhancedUpload` clears or a different file is selected.

4. **Theming & UX Polish**
   - Replace hardcoded grayscale/blue classes with FluffyViz tokens (`bg-card`, `border-border`, `text-foreground`, `bg-muted`, accent colors from the style guide). Convert buttons/modals to shadcn primitives (`Button`, `Dialog`, `Select`, `Badge`) while preserving interactions (drag handle, selection highlight).
   - Validate keyboard accessibility and dark-mode support after restyling.

5. **QA & Follow-Up Hooks**
   - Smoke test CSV/JSON/JSONL uploads from `sample-data` to confirm the adapter handles varied schemas, drag-to-fill updates state, and column creation flows without backend calls.
   - Document future enhancements (route separation, AI inference wiring, feedback loops) for a subsequent milestone once baseline integration ships.

## Risks & Mitigations
- **Styling regressions**: mitigate by snapshotting current spreadsheet styles and methodically mapping to tokens; leverage Storybook/isolated rendering for faster iteration.
- **Large dataset performance**: assess with representative files; prepare to add virtualization if scrolling becomes sluggish.
- **State desynchronization with saved files**: design the adapter to hydrate spreadsheet state when `EnhancedUpload` reloads a stored file via `useFileStorage`.

## Acceptance Criteria
- Spreadsheet renders automatically beneath `EnhancedUpload` after a successful `processData()` call, powered by the uploaded dataset.
- Users can edit cells, add AI-configured columns, and drag-fill within the embedded view without console errors.
- Visual styling aligns with FluffyViz tokens in both light and dark modes, and the spreadsheet feels native to the app.
- Clearing or switching uploads resets the spreadsheet state appropriately.
- Documentation captures deferred enhancements for the next iteration.
