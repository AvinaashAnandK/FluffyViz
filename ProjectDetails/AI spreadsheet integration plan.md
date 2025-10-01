# AI Spreadsheet Integration Plan

## 1. Understand `@spreadsheet-extract`
- **Data pipeline**: `Spreadsheet.tsx` holds sheet state, bootstraps columns from the first row of `SAMPLE_DATA`, and wires modal/table interactions all client-side.
- **Table mechanics**: `SpreadsheetTable.tsx` renders the grid with editable cells, drag-to-fill, template dropdown (`COLUMN_TEMPLATES`), and selection state.
- **AI column creation**: `AddColumnModal.tsx` + selectors manage prompts/models/providers. Column metadata (model, provider, prompt, taskType) is stored alongside each column; currently no backend inference call is issued.
- **Supporting utilities**: type definitions in `src/types/models.ts`, provider registry in `src/lib/providers.ts`, task types in `src/types/tasks.ts`. All assumptions are local—no external state management or persistence.
- **Integration-ready elements**: components are already modular; we can either import them as a package or copy into `fluffy-viz/src/components/spreadsheet` with consistent TypeScript paths.

## 2. Incorporate After Upload Flow (`enhanced-upload.tsx`)
- **Data handoff**: leverage `onDataUploaded` to capture `UploadResult` (normalized rows + validation stats). Store this in React state within `src/app/page.tsx` and pass to the spreadsheet view.
- **Render strategy**:
  - Option A: render spreadsheet directly beneath the upload module once data exists. Show tabs/toggle to switch between “Preview Table” (existing) and “Spreadsheet” views.
  - Option B: push users into a new route/step (e.g., `/augment`) while preserving uploaded dataset via context or URL params.
- **Initialization**: convert `UploadResult.data` array to spreadsheet rows. Generate column definitions from object keys (plus metadata columns as needed) instead of `SAMPLE_DATA`.
- **Lifecycle**: reset spreadsheet state when a new file is uploaded or the sidebar loads a different stored file; respect `skipInitialSave` and `savedFileId` logic already in `EnhancedUpload`.
- **Validation feedback**: optionally surface `UploadResult.validation_errors` near the spreadsheet or within a sidebar to help contextualize problematic rows.

## 3. Respect Style Guide (`src/app/style-guide/page.tsx`)
- **Brand alignment**: adjust Tailwind classes to use project tokens—backgrounds `bg-muted`, accents `text-primary`, rounded corners (`rounded-xl/2xl`), and font family `Open Sans` from globals.
- **Component parity**: replace bespoke buttons/dropdowns with shadcn primitives where feasible (`Button`, `DropdownMenu`, `Dialog`, `Input`, etc.) while keeping key spreadsheet affordances (selection highlight, drag handle).
- **Color tweaks**: shift spreadsheet selection + hover states toward FluffyViz palette (e.g., softer purple/blue instead of default Tailwind blues) without sacrificing contrast, especially for drag selection cues.
- **Dark mode**: ensure backgrounds and borders play nicely with theme tokens (use `bg-card`, `border-border`, `text-foreground`).
- **Heuristic**: preserve functionality first—retain bespoke styling when Shadcn constraints would break table behavior; incrementally refactor styling only if effort is manageable.

## 4. Implementation Steps
1. **Component packaging**: choose import strategy (monorepo link or direct copy) and set up path aliases/types.
2. **Data adapter**: write a transformer to map `UploadResult.data` into spreadsheet rows + column metadata, handling optional fields and metadata nesting.
3. **State wiring**: in `src/app/page.tsx`, manage spreadsheet visibility and feed it the adapted data. Reset on file removal.
4. **UI integration**: compose the spreadsheet component within the upload section (or new step), include controls for returning to upload, and display stats/badges from `UploadResult`.
5. **Design polish**: audit class names, introduce Tailwind/shadcn tokens, and verify responsive behavior across breakpoints.
6. **Testing & QA**: run through sample datasets (CSV, JSON, JSONL), confirm drag-to-fill/editing, ensure no regressions in upload workflow, and capture follow-up tasks for AI automation integration.

## 5. Future Considerations
- Hook AI column creation into the augmentation pipeline once available (trigger transformations or background jobs).
- Provide export functionality (CSV/JSON) for edited spreadsheets.
- Add persistent storage or collaboration features if required.
- Explore virtualization for large datasets if performance becomes an issue.
