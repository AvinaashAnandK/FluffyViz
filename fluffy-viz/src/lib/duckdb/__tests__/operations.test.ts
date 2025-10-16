/**
 * Tests for DuckDB operations (CRUD on file tables)
 */

import { resetDatabase } from '../client';
import { initializeSchema } from '../schema';
import {
  createFileTable,
  queryFileData,
  getFileRowCount,
  updateCellValue,
  addColumn,
  deleteFileTable,
  tableExists,
  getTableColumns,
} from '../operations';

describe('DuckDB Operations', () => {
  beforeEach(async () => {
    await resetDatabase();
    await initializeSchema();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  describe('createFileTable', () => {
    it('should create a table from parsed data', async () => {
      const testData = [
        { name: 'Alice', age: 30, city: 'New York' },
        { name: 'Bob', age: 25, city: 'San Francisco' },
        { name: 'Charlie', age: 35, city: 'Seattle' },
      ];

      await createFileTable('test_file_1', testData);

      const exists = await tableExists('test_file_1');
      expect(exists).toBe(true);
    });

    it('should handle special characters in column names', async () => {
      const testData = [
        { 'user.name': 'Alice', 'user.email': 'alice@example.com' },
        { 'user.name': 'Bob', 'user.email': 'bob@example.com' },
      ];

      await createFileTable('test_file_2', testData);

      const result = await queryFileData('test_file_2');
      expect(result).toHaveLength(2);
    });

    it('should reject empty data', async () => {
      await expect(createFileTable('test_file_3', [])).rejects.toThrow();
    });
  });

  describe('queryFileData', () => {
    beforeEach(async () => {
      const testData = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        value: Math.random() * 100,
      }));

      await createFileTable('test_query', testData);
    });

    it('should query with pagination', async () => {
      const page1 = await queryFileData('test_query', { limit: 10, offset: 0 });
      const page2 = await queryFileData('test_query', { limit: 10, offset: 10 });

      expect(page1).toHaveLength(10);
      expect(page2).toHaveLength(10);
      expect(page1[0].id).toBe(0);
      expect(page2[0].id).toBe(10);
    });

    it('should query with sorting', async () => {
      const ascending = await queryFileData('test_query', {
        limit: 5,
        orderBy: 'id ASC',
      });

      const descending = await queryFileData('test_query', {
        limit: 5,
        orderBy: 'id DESC',
      });

      expect(ascending[0].id).toBe(0);
      expect(descending[0].id).toBe(99);
    });

    it('should query with filtering', async () => {
      const filtered = await queryFileData('test_query', {
        where: 'id < 10',
      });

      expect(filtered.length).toBeLessThanOrEqual(10);
      expect(filtered.every((row: any) => row.id < 10)).toBe(true);
    });

    it('should query specific columns', async () => {
      const result = await queryFileData('test_query', {
        columns: ['id', 'name'],
        limit: 1,
      });

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).not.toHaveProperty('value');
    });
  });

  describe('getFileRowCount', () => {
    it('should return correct row count', async () => {
      const testData = Array.from({ length: 42 }, (_, i) => ({ id: i }));
      await createFileTable('test_count', testData);

      const count = await getFileRowCount('test_count');
      expect(count).toBe(42);
    });
  });

  describe('updateCellValue', () => {
    beforeEach(async () => {
      const testData = [
        { id: 0, name: 'Alice', status: 'active' },
        { id: 1, name: 'Bob', status: 'inactive' },
      ];
      await createFileTable('test_update', testData);
    });

    it('should update a single cell', async () => {
      await updateCellValue('test_update', 0, 'status', 'inactive');

      const result = await queryFileData('test_update', {
        where: 'row_index = 0',
      });

      expect(result[0].status).toBe('inactive');
    });
  });

  describe('addColumn', () => {
    beforeEach(async () => {
      const testData = [
        { id: 0, name: 'Alice' },
        { id: 1, name: 'Bob' },
      ];
      await createFileTable('test_add_col', testData);
    });

    it('should add a new column with default value', async () => {
      await addColumn('test_add_col', 'email', 'TEXT', 'unknown@example.com');

      const result = await queryFileData('test_add_col');
      expect(result[0]).toHaveProperty('email');
      expect(result[0].email).toBe('unknown@example.com');
    });
  });

  describe('deleteFileTable', () => {
    it('should delete a table', async () => {
      const testData = [{ id: 0 }];
      await createFileTable('test_delete', testData);

      expect(await tableExists('test_delete')).toBe(true);

      await deleteFileTable('test_delete');

      expect(await tableExists('test_delete')).toBe(false);
    });
  });

  describe('getTableColumns', () => {
    it('should return column information', async () => {
      const testData = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      await createFileTable('test_columns', testData);

      const columns = await getTableColumns('test_columns');

      expect(columns.length).toBeGreaterThan(0);
      expect(columns.some(col => col.name === 'name')).toBe(true);
      expect(columns.some(col => col.name === 'age')).toBe(true);
    });
  });
});
