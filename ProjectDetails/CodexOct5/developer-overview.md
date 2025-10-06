# FluffyViz – Developer Overview

## Product Snapshot
- FluffyViz converts raw conversational agent logs into structured datasets that can be enriched with AI-driven augmentations and exported to downstream visualization tools like Embedding Atlas.
- The workflow centers on detecting the input format, normalizing data into a common schema, letting analysts generate extra columns with LLM prompts, and persisting uploaded files in browser storage for iterative work.

## Key Directories
- `src/app/` – Next.js app router pages, API routes, global styles, and layout metadata.
- `src/components/` – React components for uploads, sidebar navigation, spreadsheet tooling, and shadcn-ui primitives.
- `src/lib/` – Data detection, parsing, AI inference helpers, model/provider catalogs, and other utilities.
- `src/hooks/` – Client hooks for IndexedDB-backed file storage and responsive layout checks.
- `src/config/` – Prompt templates, parser guardrails, and metadata describing available AI augmentations.
- `src/types/` – Shared TypeScript types for normalized data, model catalogs, and file storage events.

## Core Pages & Layout
- `src/app/layout.tsx` – Defines global fonts, theme injection, and the default page metadata applied across the app.
- `src/app/page.tsx` – Landing workflow with hero messaging, EnhancedUpload entrypoint, workflow overview, and OSS credits.
- `src/app/edit/[fileId]/page.tsx` – Spreadsheet editing view that reuses the sidebar layout and loads a stored dataset by ID.
- `src/app/style-guide/page.tsx` – Internal style playground demonstrating brand colors, components, and workflow affordances for reference.
- `src/app/api/prompts/[templateId]/route.ts` – Server route that returns YAML prompt configs as JSON for the augmentation picker.

## High-Level Components
- `src/components/app-sidebar.tsx` – Sidebar shell listing stored datasets with drag-and-drop import, rename/delete actions, and prompt config entrypoint.
- `src/components/enhanced-upload.tsx` – Upload surface that validates files, auto-detects schema, previews sample rows, and triggers normalization/export.
- `src/components/workflow-breadcrumb.tsx` – Reusable breadcrumb variants to visualize the Upload → Augment → Process → Visualize journey.
- `src/components/ai-provider-config-demo.tsx` – Mock provider capability dashboard for configuring API keys and feature toggles.
- `src/components/theme-toggle.tsx` – Light/dark theme controller that persists the selection in localStorage.

## Spreadsheet Tooling
- `src/components/spreadsheet/SpreadsheetEditor.tsx` – Page-level editor that parses stored content, manages column definitions, and coordinates AI column generation.
- `src/components/spreadsheet/SpreadsheetTable.tsx` – Presentational grid with inline editing, template-driven column insertion, and drag-to-fill gestures.
- `src/components/spreadsheet/AddColumnModal.tsx` – Drawer that lets users pick a column template, edit prompt text, and wire models/providers before adding.
- `src/components/spreadsheet/ModelSelector.tsx` – Client search UI that calls `lib/models.ts` to fetch curated and HuggingFace catalog models.
- `src/components/spreadsheet/ProviderSelector.tsx` – Provider chooser that filters compatible inference hosts and defaults sensible fallbacks per model.
- `src/components/spreadsheet/types.ts` – Local TypeScript helpers describing spreadsheet column metadata and editor state.

## Hooks
- `src/hooks/use-file-storage.ts` – IndexedDB-backed persistence with versioning, optimistic concurrency, and cross-tab synchronization events.
- `src/hooks/use-mobile.ts` – Media-query hook that reports breakpoint state for sidebar responsiveness.

## Libraries & Utilities
- `src/lib/format-detector.ts` – Scores candidate file formats (message-centric JSONL, Langfuse, LangSmith, Arize, turn-level CSV) and surfaces confidence/suggestions.
- `src/lib/data-processor.ts` – Normalizes each supported format into the core schema, validates records, builds stats, and surfaces schema metadata.
- `src/lib/format-parser.ts` – Generic parser/flattening engine for nested JSON or CSV with depth limits, memoization, and metadata extraction.
- `src/lib/ai-inference.ts` – Placeholder inference bridge that interpolates prompts per row and simulates LLM calls for generated columns.
- `src/lib/models.ts` – Fetches curated model metadata, proxies HuggingFace search, and extracts parameter counts for catalog presentation.
- `src/lib/providers.ts` – Lists supported inference providers, derives compatibility, and formats provider badges/counts for the UI.
- `src/lib/utils.ts` – Tailwind utility class merger shared across components.

## Config & Prompts
- `src/config/ai-column-templates.ts` – Template registry describing augmentation categories, prompt files, and helper functions (loader, interpolation).
- `src/config/prompts/*.yaml` – YAML prompt payloads consumed by the column template loader and API route.
- `src/config/parser.config.ts` – Centralized parsing guardrails for maximum depth/length settings.

## Shared Types & Testing
- `src/types/agent-data.ts` – Canonical normalized agent record shape plus source-specific interfaces and upload result schema.
- `src/types/models.ts` – Model/provider/category definitions, search params, and inference request/response types.
- `src/types/file-storage.ts` – Event payloads for communicating file selections between components.
- `src/hooks/__tests__/use-file-storage.test.ts` – Placeholder tests that currently assert basic constants and should evolve into behavioral coverage.
- `src/lib/__tests__/format-parser.test.ts` – Smoke tests validating parser configuration; lacks assertions against the parser functions themselves.

## Assets & Supporting Files
- `public/FluffyVisualizer.png` – App logo displayed in the hero and headers.
- `public/sample-data/` – Example datasets spanning each supported ingestion format for manual testing.
- `AI-SHEETS-INTEGRATION-*.md` – Prior integration notes outlining spreadsheet feature plans and QA results.
