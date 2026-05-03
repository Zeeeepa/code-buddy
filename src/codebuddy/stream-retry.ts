/**
 * Stream retry helper — wraps an async generator factory with
 * exponential-backoff retry on retryable errors.
 *
 * Derived from the comparative audit Gemini CLI vs Code Buddy
 * (claude-et-patrice/propositions/AUDIT-GEMINI-CLI-AGENTIC-LOOP-2026-05-04.md,
 * recommendation #1 — vrai gap, M scope).
 *
 * Problem
 * -------
 * Gemini CLI's `geminiChat.ts` has `MID_STREAM_RETRY_OPTIONS` (4 max
 * attempts, 1s initial delay, exponential backoff) for mid-stream
 * network failures. Code Buddy's `CodeBuddyClient.chatStream()` has
 * NO equivalent — if the network drops between two chunks, the
 * caller sees the error directly, has to handle it themselves, and
 * loses all the chunks already streamed.
 *
 * Solution
 * --------
 * A pure higher-order async generator that takes a `factory` (produces
 * the generator to retry) plus retry options, and re-yields all events.
 * On a retryable error, it waits with exponential backoff and re-calls
 * the factory (which produces a fresh stream from the start). The
 * caller decides what's retryable via a predicate.
 *
 * Trade-off: a retried stream restarts from the beginning. The caller
 * sees duplicate chunks across the retry boundary. This matches Gemini
 * CLI's behavior — true delta-resume requires LLM-level support that
 * doesn't exist today.
 *
 * Standalone module: pure function, easily testable, opt-in at the
 * call site. Does NOT modify `CodeBuddyClient.chatStream()` itself —
 * zero risk to existing callers.
 */

/**
 * Options controlling the retry behavior. Mirrors Gemini CLI's
 * `MID_STREAM_RETRY_OPTIONS` shape with sensible defaults.
 */
export interface StreamRetryOptions {
  /** Max retry attempts (the initial call counts as attempt 1; default 4 = 1 initial + 3 retries). */
  maxAttempts?: number;
  /** Initial delay in ms before the first retry (default 1000). */
  initialDelayMs?: number;
  /** Cap for exponential backoff (default 8000). */
  maxDelayMs?: number;
  /**
   * Predicate deciding whether an error is worth retrying. Default
   * heuristic: retry on network-ish errors (ECONNRESET, ETIMEDOUT,
   * fetch aborted by network, undici stream errors). Non-retryable
   * errors (auth failures, validation errors, 4xx semantic errors)
   * propagate immediately.
   */
  isRetryable?: (err: unknown) => boolean;
  /** Optional abort signal — cancels pending retry waits. */
  signal?: AbortSignal;
  /** Optional callback fired before each retry attempt (debug / metrics). */
  onRetry?: (attempt: number, delayMs: number, err: unknown) => void;
}

const DEFAULT_OPTIONS: Required<Omit<StreamRetryOptions, 'signal' | 'onRetry'>> = {
  maxAttempts: 4,
  initialDelayMs: 1000,
  maxDelayMs: 8000,
  isRetryable: defaultIsRetryable,
};

/**
 * Default heuristic for retryability. Matches the patterns we see in
 * the wild from undici / node fetch / ws libs.
 */
function defaultIsRetryable(err: unknown): boolean {
  if (!err) return false;
  const e = err as { code?: string; name?: string; message?: string };
  // Common Node network error codes worth retrying
  if (typeof e.code === 'string') {
    const code = e.code;
    if (
      code === 'ECONNRESET' ||
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT' ||
      code === 'ENOTFOUND' ||
      code === 'EAI_AGAIN' ||
      code === 'EPIPE' ||
      code === 'UND_ERR_SOCKET'
    ) {
      return true;
    }
  }
  // Undici-style error names
  if (typeof e.name === 'string') {
    const name = e.name;
    if (name === 'AbortError' && (e.message ?? '').toLowerCase().includes('network')) return true;
    if (name === 'FetchError' || name === 'NetworkError' || name === 'TimeoutError') return true;
  }
  // Loose message-level fallback
  if (typeof e.message === 'string') {
    const m = e.message.toLowerCase();
    if (m.includes('socket hang up')) return true;
    if (m.includes('terminated') && m.includes('stream')) return true;
    if (m.includes('upstream connect error')) return true;
  }
  return false;
}

/**
 * Wrap an async generator factory with exponential-backoff retry.
 * On each retry, calls `factory()` to get a FRESH generator (the
 * caller is responsible for that factory being safe to re-invoke).
 *
 * Usage:
 *
 *   const factory = () => client.chatStream(messages, tools, opts);
 *   for await (const chunk of withStreamRetry(factory, { maxAttempts: 4 })) {
 *     // handle chunk
 *   }
 *
 * Yields every event from the (possibly retried) inner generator,
 * including the duplicated prefix when a retry happens. Throws
 * synchronously when retries are exhausted OR when an error is not
 * retryable (per the predicate).
 */
export async function* withStreamRetry<T>(
  factory: () => AsyncGenerator<T> | AsyncIterable<T>,
  options: StreamRetryOptions = {},
): AsyncGenerator<T> {
  const opts = {
    maxAttempts: options.maxAttempts ?? DEFAULT_OPTIONS.maxAttempts,
    initialDelayMs: options.initialDelayMs ?? DEFAULT_OPTIONS.initialDelayMs,
    maxDelayMs: options.maxDelayMs ?? DEFAULT_OPTIONS.maxDelayMs,
    isRetryable: options.isRetryable ?? DEFAULT_OPTIONS.isRetryable,
    signal: options.signal,
    onRetry: options.onRetry,
  };

  if (opts.maxAttempts < 1) {
    throw new Error('withStreamRetry: maxAttempts must be >= 1');
  }

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt++;
    try {
      const gen = factory();
      yield* gen as AsyncIterable<T>;
      return;
    } catch (err) {
      if (attempt >= opts.maxAttempts) {
        throw err;
      }
      if (!opts.isRetryable(err)) {
        throw err;
      }
      // Exponential backoff: initial * 2^(attempt-1), capped at max.
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(2, attempt - 1),
        opts.maxDelayMs,
      );
      opts.onRetry?.(attempt, delay, err);
      await waitWithAbort(delay, opts.signal);
    }
  }
}

/**
 * Sleep for `ms` milliseconds, but bail out early if the signal aborts.
 * Throws an `AbortError`-shaped error if aborted (matching node fetch
 * convention so callers can handle uniformly).
 */
async function waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    const err = new Error('Stream retry aborted by signal');
    (err as Error & { name?: string }).name = 'AbortError';
    throw err;
  }
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    timer.unref?.();
    const onAbort = () => {
      cleanup();
      const err = new Error('Stream retry aborted by signal');
      (err as Error & { name?: string }).name = 'AbortError';
      reject(err);
    };
    function cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
    if (signal) signal.addEventListener('abort', onAbort);
  });
}

/** Test-only: re-export the default isRetryable predicate for direct testing. */
export const _defaultIsRetryableForTests = defaultIsRetryable;
