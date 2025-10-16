/**
 * Query builder utilities for type-safe DuckDB queries
 *
 * Provides a fluent interface for building SQL queries programmatically
 */

export class QueryBuilder {
  private selectColumns: string[] = ['*'];
  private fromTable = '';
  private whereConditions: string[] = [];
  private orderByClause = '';
  private limitValue: number | null = null;
  private offsetValue: number | null = null;

  /**
   * Start a new query builder
   */
  static from(table: string): QueryBuilder {
    const builder = new QueryBuilder();
    builder.fromTable = table;
    return builder;
  }

  /**
   * Select specific columns
   */
  select(...columns: string[]): this {
    this.selectColumns = columns.length > 0 ? columns : ['*'];
    return this;
  }

  /**
   * Add WHERE condition
   */
  where(condition: string): this {
    this.whereConditions.push(condition);
    return this;
  }

  /**
   * Add WHERE condition with value
   */
  whereEquals(column: string, value: unknown): this {
    this.whereConditions.push(`"${column}" = ${this.formatValue(value)}`);
    return this;
  }

  /**
   * Add WHERE LIKE condition
   */
  whereLike(column: string, pattern: string): this {
    this.whereConditions.push(`"${column}" LIKE '${pattern.replace(/'/g, "''")}'`);
    return this;
  }

  /**
   * Add WHERE IN condition
   */
  whereIn(column: string, values: unknown[]): this {
    const formattedValues = values.map(v => this.formatValue(v)).join(', ');
    this.whereConditions.push(`"${column}" IN (${formattedValues})`);
    return this;
  }

  /**
   * Order by column
   */
  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByClause = `"${column}" ${direction}`;
    return this;
  }

  /**
   * Set limit
   */
  limit(value: number): this {
    this.limitValue = value;
    return this;
  }

  /**
   * Set offset
   */
  offset(value: number): this {
    this.offsetValue = value;
    return this;
  }

  /**
   * Build the SQL query string
   */
  build(): string {
    let query = `SELECT ${this.selectColumns.join(', ')} FROM ${this.fromTable}`;

    if (this.whereConditions.length > 0) {
      query += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }

    if (this.orderByClause) {
      query += ` ORDER BY ${this.orderByClause}`;
    }

    if (this.limitValue !== null) {
      query += ` LIMIT ${this.limitValue}`;
    }

    if (this.offsetValue !== null) {
      query += ` OFFSET ${this.offsetValue}`;
    }

    return query;
  }

  /**
   * Format value for SQL
   */
  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }

    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    return `'${String(value)}'`;
  }
}

/**
 * Build an INSERT query
 */
export class InsertBuilder {
  private tableName = '';
  private columnsToInsert: string[] = [];
  private valuesToInsert: unknown[][] = [];

  static into(table: string): InsertBuilder {
    const builder = new InsertBuilder();
    builder.tableName = table;
    return builder;
  }

  /**
   * Set columns
   */
  columns(...columns: string[]): this {
    this.columnsToInsert = columns;
    return this;
  }

  /**
   * Add values row
   */
  values(...values: unknown[]): this {
    if (this.columnsToInsert.length > 0 && values.length !== this.columnsToInsert.length) {
      throw new Error(`Expected ${this.columnsToInsert.length} values, got ${values.length}`);
    }
    this.valuesToInsert.push(values);
    return this;
  }

  /**
   * Build the INSERT query
   */
  build(): string {
    const columnList = this.columnsToInsert.map(c => `"${c}"`).join(', ');
    const valuesList = this.valuesToInsert
      .map(row => `(${row.map(v => this.formatValue(v)).join(', ')})`)
      .join(',\n');

    return `INSERT INTO ${this.tableName} (${columnList}) VALUES ${valuesList}`;
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }

    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    return `'${String(value)}'`;
  }
}

/**
 * Build an UPDATE query
 */
export class UpdateBuilder {
  private tableName = '';
  private setValues: Map<string, unknown> = new Map();
  private whereConditions: string[] = [];

  static table(table: string): UpdateBuilder {
    const builder = new UpdateBuilder();
    builder.tableName = table;
    return builder;
  }

  /**
   * Set column value
   */
  set(column: string, value: unknown): this {
    this.setValues.set(column, value);
    return this;
  }

  /**
   * Add WHERE condition
   */
  where(condition: string): this {
    this.whereConditions.push(condition);
    return this;
  }

  /**
   * Add WHERE condition with value
   */
  whereEquals(column: string, value: unknown): this {
    this.whereConditions.push(`"${column}" = ${this.formatValue(value)}`);
    return this;
  }

  /**
   * Build the UPDATE query
   */
  build(): string {
    const setClause = Array.from(this.setValues.entries())
      .map(([col, val]) => `"${col}" = ${this.formatValue(val)}`)
      .join(', ');

    let query = `UPDATE ${this.tableName} SET ${setClause}`;

    if (this.whereConditions.length > 0) {
      query += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }

    return query;
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }

    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    return `'${String(value)}'`;
  }
}

/**
 * Helper to escape SQL identifiers
 */
export function escapeIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Helper to escape SQL string values
 */
export function escapeString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
