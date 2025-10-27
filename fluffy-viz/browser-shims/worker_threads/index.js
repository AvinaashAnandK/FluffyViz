/**
 * Browser-compatible shim for Node.js worker_threads module
 * Used by embedding-atlas when bundled for the browser
 */

// Export an empty Worker class that matches Node.js API but does nothing
export class Worker {
  constructor() {
    console.warn('worker_threads.Worker called in browser environment - using no-op shim');
  }

  postMessage() {}
  terminate() {}
  on() {}
  once() {}
  removeListener() {}
}

// Export other worker_threads APIs as no-ops
export const isMainThread = true;
export const parentPort = null;
export const threadId = 0;
export const workerData = null;

export default {
  Worker,
  isMainThread,
  parentPort,
  threadId,
  workerData,
};
