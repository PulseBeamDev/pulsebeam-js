/**
 * asleep is an async version of setTimeout with abortable signal.
 * the function will resolve to false when aborted, meaning the delay will
 * be less than the expected.
 */
export function asleep(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => resolve(true), ms);

    // If an AbortSignal is provided, listen for the 'abort' event
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timeoutId); // Cancel the delay
        resolve(false);
      });
    }
  });
}

export function joinSignals(...signals: AbortSignal[]): AbortSignal {
  const joined = new AbortController();

  const joinedAbort = () => {
    joined.abort();

    for (const signal of signals) {
      signal.removeEventListener("abort", joinedAbort);
    }
  };

  for (const signal of signals) {
    signal.addEventListener("abort", joinedAbort);
  }

  return joined.signal;
}

export type RetryOptions = {
  maxRetries: number; // Maximum retry attempts. negative means no limit, 0 means 1 try (0 retry)
  baseDelay: number; // Initial delay in milliseconds
  maxDelay: number; // Maximum delay in milliseconds
  jitterFactor?: number; // Jitter percentage (e.g., 0.3 for 30%)
  isRecoverable?: (error: unknown) => boolean; // Function to categorize recoverable errors
  abortSignal?: AbortSignal;
};

export async function retry<T>(
  asyncFunction: () => Promise<T>,
  options: RetryOptions,
): Promise<T | null> {
  const {
    maxRetries,
    baseDelay,
    maxDelay,
    jitterFactor = 0.3,
    isRecoverable = () => true, // Default: all errors are recoverable
    abortSignal,
  } = options;

  let attempt = 0;

  while ((attempt <= maxRetries || maxRetries < 0) && !abortSignal?.aborted) {
    try {
      return await asyncFunction(); // Execute the function
    } catch (error) {
      // Check if the error is recoverable
      if (!isRecoverable(error)) {
        throw error; // Non-recoverable error, rethrow it
      }

      attempt++;
      if (maxRetries >= 0 && attempt > maxRetries) {
        throw error; // Exceeded max retries
      }

      // Calculate delay with exponential backoff and jitter
      const delay = calculateDelay(attempt, baseDelay, maxDelay, jitterFactor);
      await asleep(delay, abortSignal).catch(() => { }); // Wait before the next attempt
    }
  }

  if (abortSignal?.aborted) {
    return null;
  }

  throw new Error("Retry failed: max retries exceeded"); // This is a fallback; should rarely occur
}

// Helper to calculate exponential backoff with jitter
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  jitterFactor: number,
): number {
  const exponentialDelay = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay);
  const jitter = Math.random() * jitterFactor * exponentialDelay;
  return exponentialDelay + jitter;
}
