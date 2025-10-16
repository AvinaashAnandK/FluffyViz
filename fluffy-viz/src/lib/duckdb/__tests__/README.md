# DuckDB Tests

## Why tests are skipped in Jest

DuckDB WASM requires a browser environment with WASM and Worker support. Jest runs in Node.js which doesn't have these APIs, so we skip these tests in the automated test suite.

## Manual testing in browser

To test DuckDB functionality:

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Open browser console** at http://localhost:3000

3. **Run test commands:**
   ```javascript
   // Import DuckDB functions
   const { getDuckDB, initializeSchema, executeQuery } = await import('@/lib/duckdb');

   // Test 1: Initialize DuckDB
   const db = await getDuckDB();
   console.log('✓ DuckDB initialized:', db);

   // Test 2: Initialize schema
   await initializeSchema();
   console.log('✓ Schema initialized');

   // Test 3: Run simple query
   const result = await executeQuery('SELECT 1 + 1 as result');
   console.log('✓ Query result:', result);

   // Test 4: Create test table
   await executeQuery('CREATE TABLE test_table (id INTEGER, name TEXT)');
   await executeQuery('INSERT INTO test_table VALUES (1, \'Alice\'), (2, \'Bob\')');
   const rows = await executeQuery('SELECT * FROM test_table');
   console.log('✓ Test table:', rows);
   ```

4. **Test OPFS persistence:**
   - Run the above commands
   - Refresh the page
   - Run the query again - data should persist

## Integration testing

DuckDB will be tested through integration tests once Features 1-3 are implemented (file upload → spreadsheet display flow).

## Expected behavior

- ✅ DuckDB initializes without errors
- ✅ Schema creates tables successfully
- ✅ Queries execute and return correct results
- ✅ OPFS persistence works across page refreshes
- ✅ No memory leaks (check DevTools)
- ✅ Works in Chrome, Firefox, Safari
