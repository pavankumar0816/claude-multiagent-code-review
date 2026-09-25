/**
 * Custom error class for review operations
 */
export class ReviewError extends Error {
  constructor(
    message: string,
    public code: string,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ReviewError';
    Error.captureStackTrace(this, ReviewError);
  }
}

/**
 * Error codes for the review system
 */
export const ErrorCodes = {
  // Configuration errors
  MISSING_API_KEY: 'MISSING_API_KEY',
  MISSING_GITHUB_TOKEN: 'MISSING_GITHUB_TOKEN',
  INVALID_CONFIG: 'INVALID_CONFIG',

  // GitHub errors
  PR_NOT_FOUND: 'PR_NOT_FOUND',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  GITHUB_API_ERROR: 'GITHUB_API_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  // Agent errors
  AGENT_TIMEOUT: 'AGENT_TIMEOUT',
  AGENT_FAILED: 'AGENT_FAILED',
  STRUCTURED_OUTPUT_FAILED: 'STRUCTURED_OUTPUT_FAILED',

  // General errors
  RETRY_EXHAUSTED: 'RETRY_EXHAUSTED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Retry utility with exponential backoff
 *
 * This function retries a failed async operation.
 * Each retry waits longer than the previous attempt.
 *
 * Example:
 * Attempt 1 -> immediate
 * Attempt 2 -> wait 1000ms
 * Attempt 3 -> wait 2000ms
 * Attempt 4 -> wait 4000ms
 *
 * A small random jitter is added to prevent multiple
 * requests from retrying at exactly the same time.
 *
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retries
 * @param delayMs - Base delay in milliseconds
 * @returns The result of the successful function execution
 * @throws ReviewError with RETRY_EXHAUSTED code if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      // Try to execute the operation
      return await fn();
    } catch (error) {
      lastError = error;

      // If there are no retries remaining, stop retrying
      if (attempt > maxRetries) {
        break;
      }

      // Exponential backoff:
      // attempt 1 -> delayMs
      // attempt 2 -> delayMs * 2
      // attempt 3 -> delayMs * 4
      const backoff = delayMs * Math.pow(2, attempt - 1);

      // Add random jitter between 0 and 100ms
      const jitter = Math.random() * 100;

      const waitTime = backoff + jitter;

      await new Promise<void>((resolve) => {
        setTimeout(resolve, waitTime);
      });
    }
  }

  // All attempts failed
  throw new ReviewError(
    'Operation failed after all retry attempts',
    ErrorCodes.RETRY_EXHAUSTED,
    {
      maxRetries,
      lastError:
        lastError instanceof Error
          ? lastError.message
          : String(lastError)
    }
  );
}

/**
 * Wrap an async function with timeout
 *
 * This function races the provided function against a timeout.
 * Whichever completes first wins.
 *
 * @param fn - Async function to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Custom error message
 * @returns The result of the function if it completes before timeout
 * @throws ReviewError with AGENT_TIMEOUT code if timeout is reached
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    // Run the actual operation
    fn(),

    // Timeout promise
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(
          new ReviewError(
            errorMessage,
            ErrorCodes.AGENT_TIMEOUT,
            {
              timeoutMs
            }
          )
        );
      }, timeoutMs);
    })
  ]);
}

/**
 * Check if an error is a ReviewError
 */
export function isReviewError(error: unknown): error is ReviewError {
  return error instanceof ReviewError;
}

/**
 * Format error for logging/display
 */
export function formatError(error: unknown): string {
  if (isReviewError(error)) {
    return `[${error.code}] ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}