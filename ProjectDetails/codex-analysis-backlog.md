# Codex Analysis Backlog

## Frontend & Product Experience
- **[P1] Reinstate in-app processing feedback**  
  **Context**: `fluffy-viz/src/app/page.tsx:160` keeps the post-upload stats card commented out, while `_uploadResult` is still tracked.  
  **Impact**: Users never see validation errors or row counts, so the workflow stops at upload with no proof of work.  
  **Next Step**: Re-enable the card (or build a leaner summary component) wired to `UploadResult`, and gate it behind an actionable success state.
- **[P1] Surface manual field-mapping UI**  
  **Context**: `fluffy-viz/src/components/enhanced-upload.tsx:60` maintains `fieldMappings`, but no controls ever populate it.  
  **Impact**: Any dataset with non-canonical column names silently drops critical fields during normalization.  
  **Next Step**: Introduce a mapping step (auto-suggestions + manual overrides) before `processData`, and persist user choices per format.

## Data Normalization & Detection
- **[P0] Fix turn-level CSV detection heuristics**  
  **Context**: `fluffy-viz/src/lib/format-detector.ts:248` expects an `assistant_message` column, whereas our sample (`public/sample-data/sample-turn-level.csv`) ships `assistant_text`.  
  **Impact**: Turn-level uploads fall back to "unknown" and skip preview/processing even for bundled fixtures.  
  **Next Step**: Expand required-field matching to handle known aliases (`assistant_text`, `assistant_response`, etc.) and bump confidence when both sides match.
- **[P1] Stop validating against the wrong format**  
  **Context**: `fluffy-viz/src/lib/format-detector.ts:34` always calls `validateFormat` with `bestMatch.format`, even when `detectedFormat` is `null`.  
  **Impact**: Users see misleading "invalid JSON" errors for perfectly fine CSV uploads because validation uses the wrong schema.  
  **Next Step**: Pass `detectedFormat` (or `null`) into `validateFormat` and tailor error messaging when confidence < threshold.
- **[P1] Support JSON array payloads**  
  **Context**: `fluffy-viz/src/lib/data-processor.ts:89` and `format-detector` both assume JSONL; bracketed arrays are treated as empty because each line fails `JSON.parse`.  
  **Impact**: LangSmith / Langfuse exports that default to array blobs fail silently.  
  **Next Step**: Detect leading `[` and parse once as an array before falling back to line-by-line parsing.
- **[P1] Tighten validation feedback loop**  
  **Context**: `fluffy-viz/src/components/enhanced-upload.tsx:205` collapses every processing failure into "Error processing file" and only logs the actual cause.  
  **Impact**: Data teams cannot self-serve fixes without digging into dev tools, slowing iteration.  
  **Next Step**: Bubble up structured `ValidationError` details from `DataProcessor` and expose them in the detection card.

## Performance & Architecture
- **[P2] Reduce redundant file reads**  
  **Context**: `fluffy-viz/src/components/enhanced-upload.tsx:146` runs `FileReader` 3+ times (detect, preview, save), each time loading entire strings into memory.  
  **Impact**: Large (>10 MB) uploads freeze the UI and double memory footprint.  
  **Next Step**: Cache the first `ArrayBuffer`/string per upload and reuse it; explore streaming previews for CSV.
- **[P2] Replace global CustomEvent bus with React context**  
  **Context**: `fluffy-viz/src/app/page.tsx:46` and `src/components/app-sidebar.tsx:44` sync via `window.dispatchEvent`.  
  **Impact**: Hard to unit test, breaks silently if multiple browser tabs are open, and complicates server-side rendering.  
  **Next Step**: Lift file-selection state into a provider (or reuse `SidebarProvider`) and expose hooks for both sidebar and uploader.

## Quality & DX
- **[P2] Add regression tests around ingestion**  
  **Context**: No automated coverage for `FormatDetector` or `DataProcessor`; regressions would go unnoticed.  
  **Impact**: Recent CSV detection bug shipped despite sample fixtures living in-repo.  
  **Next Step**: Add Vitest/Jest unit suites exercising each sample in `public/sample-data/`, and hook them into CI.
- **[P3] Update default metadata & docs**  
  **Context**: `fluffy-viz/src/app/layout.tsx:13` still advertises "Create Next App" and the root README is boilerplate.  
  **Impact**: Hurts credibility for demos and SEO once we go public.  
  **Next Step**: Refresh metadata/title/description and rewrite the README with install + workflow guidance.
