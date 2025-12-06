# FluffyViz Side Project - What Actually Needs Fixing

**Total Issues Found:** 94
**Actually Matter for Side Project:** 11
**Must Fix to Prevent Data Loss:** 3

---

## The Only 3 Critical Issues (Fix This Weekend - 4 hours)

### 1. SQL Injection → Data Corruption
**File:** `src/lib/duckdb/query-builder.ts`, `src/lib/embedding/storage.ts`
**Fix:** Use parameterized queries: `conn.prepare("SELECT * WHERE id = ?").query(id)`
**Time:** 2-3 hours

### 2. Stale Closure → Wrong Data Saved
**File:** `src/components/spreadsheet/SpreadsheetEditor.tsx:595-651`
**Fix:** Pass `data` as parameter to `generateAIColumnData()` instead of capturing
**Time:** 1 hour

### 3. Missing persistDatabase() → Lost Embeddings
**File:** `src/lib/embedding/storage.ts:121`
**Fix:** Add `await persistDatabase()` after `await conn.query('COMMIT')`
**Time:** 15 minutes

---

## 8 Annoying Bugs (Fix If Bored - 3 hours)

1. **Memory leak in drag** - `SpreadsheetTable.tsx:140` - Use useRef
2. **Infinite loop risk** - `SpreadsheetEditor.tsx:268` - Remove getFile from deps
3. **Can't cancel operations** - Add AbortController to fetch
4. **maxTokens ignored** - Pass it to generateText() call
5. **referenceColumns ignored** - Include in request body
6. **WASM paths hardcoded** - Use relative paths
7. **No error boundary** - Wrap SpreadsheetEditor
8. **Race conditions in DB** - Add connection queue

---

## Ignore Everything Else

❌ **Don't waste time on:**
- Accessibility (ARIA labels, keyboard nav)
- Security (CSRF, API key logging)
- Performance (bundle size, lazy loading)
- Code quality (TypeScript types, duplicated code)
- Testing (0% coverage is fine)
- Documentation (you know your code)
- Deployment issues (unless actually deploying)

---

## Quick Fixes You Can Do Right Now

```typescript
// 1. Fix persistDatabase (15 min) - src/lib/embedding/storage.ts:111
await conn.query('COMMIT');
await persistDatabase(); // ADD THIS LINE
console.log(`[Embedding Storage] ✓ Layer ${layer.id} saved`);

// 2. Add Error Boundary (30 min) - src/app/edit/[fileId]/page.tsx
<ErrorBoundary fallback={<div>Something broke. Refresh.</div>}>
  <SpreadsheetEditor fileId={fileId} />
</ErrorBoundary>

// 3. Fix maxTokens (20 min) - src/lib/ai-inference.ts:274
const { text } = await generateText({
  model: aiModel,
  prompt,
  temperature,
  maxTokens, // ADD THIS LINE
});
```

---

## Summary

**Your app works fine for a side project.** The 94 issues are mostly production concerns that don't affect personal use. Fix the 3 data loss bugs this weekend (4 hours), and maybe the annoying bugs next weekend (3 hours). Everything else is overthinking it.

**Total time to "good enough":** 7 hours
**Original production estimate:** 240+ hours
**You save:** 233 hours of unnecessary work