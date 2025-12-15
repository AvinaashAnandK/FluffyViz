/**
 * Next.js Instrumentation - runs before any other code
 * Used to set up polyfills for SSR environment
 */

export async function register() {
  // Only install polyfills on the server (Node.js environment)
  if (typeof window === 'undefined') {
    // Install Worker shim for SSR if it doesn't exist
    // This allows embedding-atlas and similar libraries to be evaluated during SSR
    if (typeof globalThis.Worker === 'undefined') {
      // @ts-expect-error - We're polyfilling Worker for SSR
      globalThis.Worker = class WorkerShim {
        constructor(_scriptURL?: string | URL, _options?: WorkerOptions) {
          // No-op constructor for SSR
        }
        postMessage(_message: unknown, _transfer?: Transferable[]): void {}
        terminate(): void {}
        addEventListener(_type: string, _listener: EventListener): void {}
        removeEventListener(_type: string, _listener: EventListener): void {}
        dispatchEvent(_event: Event): boolean { return false; }
        onmessage: ((ev: MessageEvent) => void) | null = null;
        onmessageerror: ((ev: MessageEvent) => void) | null = null;
        onerror: ((ev: ErrorEvent) => void) | null = null;
      };
    }

    // Install MessageChannel shim if it doesn't exist
    if (typeof globalThis.MessageChannel === 'undefined') {
      // @ts-expect-error - We're polyfilling MessageChannel for SSR
      globalThis.MessageChannel = class MessageChannelShim {
        port1 = { postMessage: () => {}, close: () => {}, onmessage: null };
        port2 = { postMessage: () => {}, close: () => {}, onmessage: null };
      };
    }
  }
}
