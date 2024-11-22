export function asleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, ms);

    // If an AbortSignal is provided, listen for the 'abort' event
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timeoutId); // Cancel the delay
        reject(new Error(signal.reason));
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
  maxRetries: number; // Maximum retry attempts
  baseDelay: number; // Initial delay in milliseconds
  maxDelay: number; // Maximum delay in milliseconds
  jitterFactor?: number; // Jitter percentage (e.g., 0.3 for 30%)
  isRecoverable?: (error: unknown) => boolean; // Function to categorize recoverable errors
};

export async function retry<T>(
  asyncFunction: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxRetries,
    baseDelay,
    maxDelay,
    jitterFactor = 0.3,
    isRecoverable = () => true, // Default: all errors are recoverable
  } = options;

  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      return await asyncFunction(); // Execute the function
    } catch (error) {
      // Check if the error is recoverable
      if (!isRecoverable(error)) {
        throw error; // Non-recoverable error, rethrow it
      }

      attempt++;
      if (attempt > maxRetries) {
        throw error; // Exceeded max retries
      }

      // Calculate delay with exponential backoff and jitter
      const delay = calculateDelay(attempt, baseDelay, maxDelay, jitterFactor);
      await asleep(delay); // Wait before the next attempt
    }
  }

  throw new Error('Retry failed: max retries exceeded'); // This is a fallback; should rarely occur
}

// Helper to calculate exponential backoff with jitter
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  jitterFactor: number
): number {
  const exponentialDelay = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay);
  const jitter = Math.random() * jitterFactor * exponentialDelay;
  return exponentialDelay + jitter;
}
