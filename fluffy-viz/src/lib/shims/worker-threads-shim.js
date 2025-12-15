/**
 * Worker threads shim for browser and SSR environments
 * Provides a mock Worker class that does nothing, allowing embedding-atlas
 * and DuckDB WASM code to be bundled without errors when they try to
 * conditionally require worker_threads (a Node.js-only module).
 *
 * Also installs a global Worker shim for SSR where the browser Worker API
 * doesn't exist.
 */

// Mock Worker class for worker_threads module
class WorkerThreadsWorker {
  constructor() {
    // Don't throw - just be a no-op so bundling succeeds
  }
  postMessage() {}
  terminate() {}
  on() { return this; }
  once() { return this; }
  off() { return this; }
  addEventListener() {}
  removeEventListener() {}
}

// Mock MessageChannel
class MessageChannel {
  constructor() {
    this.port1 = { postMessage: () => {}, on: () => {}, close: () => {} };
    this.port2 = { postMessage: () => {}, on: () => {}, close: () => {} };
  }
}

// Mock parentPort
const parentPort = null;

// Mock isMainThread
const isMainThread = true;

// Mock workerData
const workerData = null;

// Install global Worker shim for SSR if Worker doesn't exist
// This allows embedding-atlas code to be evaluated during SSR without errors
if (typeof globalThis !== 'undefined' && typeof globalThis.Worker === 'undefined') {
  globalThis.Worker = class BrowserWorkerShim {
    constructor() {
      // No-op constructor for SSR
    }
    postMessage() {}
    terminate() {}
    addEventListener() {}
    removeEventListener() {}
  };
}

module.exports = {
  Worker: WorkerThreadsWorker,
  MessageChannel,
  parentPort,
  isMainThread,
  workerData,
};
