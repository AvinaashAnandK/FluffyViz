/**
 * DuckDB WASM Client - Singleton connection manager
 *
 * Initializes and manages a single DuckDB WASM instance with OPFS persistence.
 * Handles browser worker setup and provides connection access.
 */

import * as duckdb from '@duckdb/duckdb-wasm';

let dbInstance: duckdb.AsyncDuckDB | null = null;
let initializationPromise: Promise<duckdb.AsyncDuckDB> | null = null;

/**
 * Initialize DuckDB WASM with OPFS persistence
 * Uses singleton pattern to ensure only one instance exists
 */
export async function getDuckDB(): Promise<duckdb.AsyncDuckDB> {
  // Return existing instance if available
  if (dbInstance) {
    return dbInstance;
  }

  // Return existing initialization promise if in progress
  if (initializationPromise) {
    return initializationPromise;
  }

  // Start new initialization
  initializationPromise = initializeDatabase();
  dbInstance = await initializationPromise;
  initializationPromise = null;

  return dbInstance;
}

/**
 * Internal initialization function
 */
async function initializeDatabase(): Promise<duckdb.AsyncDuckDB> {
  try {
    console.log('[DuckDB] Initializing DuckDB WASM...');

    // Select appropriate bundle based on browser capabilities
    const bundle = await duckdb.selectBundle({
      mvp: {
        mainModule: '/duckdb-mvp.wasm',
        mainWorker: '/duckdb-browser-mvp.worker.js',
      },
      eh: {
        mainModule: '/duckdb-eh.wasm',
        mainWorker: '/duckdb-browser-eh.worker.js',
      },
    });

    console.log('[DuckDB] Selected bundle:', bundle.mainModule);

    // Create worker
    const worker = new Worker(bundle.mainWorker!);

    // Create logger
    const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);

    // Initialize DuckDB
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule);

    console.log('[DuckDB] Database instantiated');

    // Configure OPFS persistence if supported
    try {
      if ('storage' in navigator && 'getDirectory' in navigator.storage) {
        console.log('[DuckDB] Configuring OPFS persistence...');

        // Get OPFS directory handle
        const opfsRoot = await navigator.storage.getDirectory();

        // Register file handle for persistence
        await db.registerFileHandle(
          'fluffyviz.db',
          opfsRoot,
          duckdb.DuckDBDataProtocol.BROWSER_FSACCESS,
          true // create if not exists
        );

        console.log('[DuckDB] OPFS persistence enabled');
      } else {
        console.warn('[DuckDB] OPFS not supported, using in-memory database');
      }
    } catch (opfsError) {
      console.warn('[DuckDB] OPFS setup failed, using in-memory database:', opfsError);
    }

    console.log('[DuckDB] Initialization complete');
    return db;

  } catch (error) {
    console.error('[DuckDB] Initialization failed:', error);
    throw new Error(`Failed to initialize DuckDB: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a connection from the database
 * Connections should be closed after use
 */
export async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  const db = await getDuckDB();
  return await db.connect();
}

/**
 * Execute a query with automatic connection management
 * @param query SQL query string
 * @param params Optional query parameters
 */
export async function executeQuery<T = unknown>(
  query: string,
  params?: unknown[]
): Promise<T[]> {
  const conn = await getConnection();

  try {
    let result;
    if (params && params.length > 0) {
      const stmt = await conn.prepare(query);
      result = await stmt.query(...params);
    } else {
      result = await conn.query(query);
    }

    return result.toArray() as T[];
  } finally {
    await conn.close();
  }
}

/**
 * Reset the database instance (for testing)
 */
export async function resetDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.terminate();
    dbInstance = null;
    initializationPromise = null;
  }
}
