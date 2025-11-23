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

    // Configure OPFS persistence if supported
    let persistentPath: string | undefined;
    try {
      if ('storage' in navigator && 'getDirectory' in navigator.storage) {
        console.log('[DuckDB] Configuring OPFS persistence...');
        persistentPath = 'fluffyviz.db';
        console.log('[DuckDB] OPFS persistence will be enabled');
      } else {
        console.warn('[DuckDB] OPFS not supported, using in-memory database');
      }
    } catch (opfsError) {
      console.warn('[DuckDB] OPFS check failed, using in-memory database:', opfsError);
    }

    // Initialize DuckDB
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

    console.log('[DuckDB] Database instantiated');

    // Open database with OPFS persistence if supported
    if (persistentPath) {
      try {
        // Use native OPFS support with opfs:// path
        await db.open({
          path: `opfs://${persistentPath}`,
          accessMode: duckdb.DuckDBAccessMode.READ_WRITE
        });
        console.log(`[DuckDB] Opened database with OPFS persistence: ${persistentPath}`);
      } catch (opfsError) {
        console.warn('[DuckDB] OPFS open failed, using in-memory database:', opfsError);
      }
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
 * Persist the current database state to OPFS
 * Uses CHECKPOINT to write from WAL to the database file
 */
export async function persistDatabase(): Promise<void> {
  try {
    if (!dbInstance) {
      console.warn('[DuckDB] Cannot persist - database not initialized');
      return;
    }

    if (!('storage' in navigator && 'getDirectory' in navigator.storage)) {
      console.warn('[DuckDB] OPFS not supported, cannot persist');
      return;
    }

    console.log('[DuckDB] Persisting database to OPFS...');

    const conn = await dbInstance.connect();
    try {
      // CHECKPOINT writes from the WAL to the OPFS database file
      await conn.query('CHECKPOINT;');
      console.log('[DuckDB] Database persisted to OPFS');
    } catch (persistError) {
      console.error('[DuckDB] Persist failed:', persistError);
      throw persistError;
    } finally {
      await conn.close();
    }
  } catch (error) {
    console.error('[DuckDB] Failed to persist database:', error);
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

/**
 * Completely reset the database including OPFS persistence
 * WARNING: This deletes ALL data permanently
 */
export async function completelyResetDatabase(): Promise<void> {
  console.log('[DuckDB] Starting complete database reset...');

  try {
    // Step 1: Terminate database instance
    if (dbInstance) {
      await dbInstance.terminate();
      dbInstance = null;
      initializationPromise = null;
      console.log('[DuckDB] Database instance terminated');
    }

    // Step 2: Delete the OPFS database file
    if ('storage' in navigator && 'getDirectory' in navigator.storage) {
      try {
        const opfsRoot = await navigator.storage.getDirectory();
        await opfsRoot.removeEntry('fluffyviz.db', { recursive: true });
        console.log('[DuckDB] OPFS database file deleted');
      } catch (error: any) {
        if (error?.name === 'NotFoundError') {
          console.log('[DuckDB] OPFS database file does not exist');
        } else {
          console.warn('[DuckDB] Failed to delete OPFS file:', error);
        }
      }
    }

    // Step 3: Reinitialize database with schema
    const { initializeSchema } = await import('./schema');
    await initializeSchema();

    console.log('[DuckDB] ✅ Complete database reset successful');
  } catch (error) {
    console.error('[DuckDB] Complete database reset failed:', error);
    throw error;
  }
}
