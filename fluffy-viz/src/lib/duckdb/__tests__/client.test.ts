/**
 * Tests for DuckDB client initialization and basic operations
 */

import { getDuckDB, executeQuery, resetDatabase } from '../client';
import { initializeSchema, isSchemaInitialized } from '../schema';

describe('DuckDB Client', () => {
  afterEach(async () => {
    // Clean up after each test
    await resetDatabase();
  });

  it('should initialize DuckDB successfully', async () => {
    const db = await getDuckDB();
    expect(db).toBeDefined();
  });

  it('should return the same instance on multiple calls', async () => {
    const db1 = await getDuckDB();
    const db2 = await getDuckDB();
    expect(db1).toBe(db2);
  });

  it('should execute simple queries', async () => {
    const result = await executeQuery<{ result: number }>('SELECT 1 + 1 as result');
    expect(result).toHaveLength(1);
    expect(result[0].result).toBe(2);
  });

  it('should handle parameterized queries', async () => {
    await executeQuery('CREATE TEMPORARY TABLE test_table (id INTEGER, name TEXT)');
    await executeQuery('INSERT INTO test_table VALUES (?, ?)', [1, 'Alice']);
    await executeQuery('INSERT INTO test_table VALUES (?, ?)', [2, 'Bob']);

    const result = await executeQuery<{ name: string }>(
      'SELECT name FROM test_table WHERE id = ?',
      [1]
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
  });
});

describe('DuckDB Schema', () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it('should initialize schema successfully', async () => {
    await initializeSchema();
    const initialized = await isSchemaInitialized();
    expect(initialized).toBe(true);
  });

  it('should create all required tables', async () => {
    await initializeSchema();

    // Check files table exists
    const filesCheck = await executeQuery<{ exists: boolean }>(`
      SELECT COUNT(*) > 0 as exists
      FROM information_schema.tables
      WHERE table_name = 'files'
    `);
    expect(filesCheck[0].exists).toBe(true);

    // Check embedding_layers table exists
    const layersCheck = await executeQuery<{ exists: boolean }>(`
      SELECT COUNT(*) > 0 as exists
      FROM information_schema.tables
      WHERE table_name = 'embedding_layers'
    `);
    expect(layersCheck[0].exists).toBe(true);

    // Check embedding_points table exists
    const pointsCheck = await executeQuery<{ exists: boolean }>(`
      SELECT COUNT(*) > 0 as exists
      FROM information_schema.tables
      WHERE table_name = 'embedding_points'
    `);
    expect(pointsCheck[0].exists).toBe(true);
  });

  it('should be idempotent (safe to run multiple times)', async () => {
    await initializeSchema();
    await initializeSchema(); // Should not error
    const initialized = await isSchemaInitialized();
    expect(initialized).toBe(true);
  });
});
