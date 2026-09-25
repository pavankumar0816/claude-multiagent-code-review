/**
 * Rate Limiter for API requests and token usage
 * Prevents exceeding Anthropic API rate limits
 *
 * This implements a token bucket rate limiter with a sliding window.
 *
 * Concepts:
 * - Tracks requests and tokens used in the last 60 seconds
 * - Limits concurrent requests
 * - Uses token estimation to prevent exceeding token-per-minute limits
 */

export interface RateLimiterConfig {
  /** Maximum requests per minute */
  maxRequestsPerMinute: number;

  /** Maximum tokens per minute */
  maxTokensPerMinute: number;

  /** Maximum concurrent requests */
  maxConcurrent: number;
}

export const DEFAULT_RATE_LIMITS: RateLimiterConfig = {
  maxRequestsPerMinute: 50,
  maxTokensPerMinute: 100000,
  maxConcurrent: 5
};

interface RequestRecord {
  timestamp: number;
  tokens: number;
}

/**
 * Token bucket rate limiter with sliding window.
 */
export class RateLimiter {
  private config: RateLimiterConfig;

  private requestHistory: RequestRecord[] = [];

  private activeRequests: number = 0;

  private waitQueue: Array<() => void> = [];

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = {
      ...DEFAULT_RATE_LIMITS,
      ...config
    };
  }

  /**
   * Wait until a request can be made within rate limits.
   *
   * Ensures:
   * 1. Concurrent request limit is not exceeded.
   * 2. Request-per-minute limit is respected.
   * 3. Token-per-minute limit is respected.
   * 4. The request is recorded.
   *
   * @param estimatedTokens Estimated tokens for this request.
   */
  async acquire(estimatedTokens: number = 1000): Promise<void> {
    // Wait until a concurrent request slot is available.
    while (this.activeRequests >= this.config.maxConcurrent) {
      await this.waitForSlot();
    }

    // Wait until request and token rate limits allow the request.
    await this.waitForRateLimit(estimatedTokens);

    // Reserve the request slot.
    this.activeRequests++;

    // Record the request in the sliding window.
    this.requestHistory.push({
      timestamp: Date.now(),
      tokens: estimatedTokens
    });
  }

  /**
   * Release a request slot after completion.
   *
   * @param actualTokens Actual tokens used by the request.
   */
  release(actualTokens?: number): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);

    // Update the most recent request with actual token usage if provided.
    if (
  actualTokens !== undefined &&
  this.requestHistory.length > 0
) {
  const lastRequest =
    this.requestHistory[this.requestHistory.length - 1];

  if (lastRequest) {
    lastRequest.tokens = actualTokens;
  }
}
    // Wake up the next request waiting for a concurrent slot.
    const next = this.waitQueue.shift();

    if (next) {
      next();
    }
  }

  /**
   * Get current rate limit status.
   */
  getStatus(): {
    activeRequests: number;
    requestsInWindow: number;
    tokensInWindow: number;
    availableRequests: number;
    availableTokens: number;
  } {
    this.pruneOldRecords();

    const requestsInWindow = this.requestHistory.length;

    const tokensInWindow = this.requestHistory.reduce(
      (sum, record) => sum + record.tokens,
      0
    );

    return {
      activeRequests: this.activeRequests,

      requestsInWindow,

      tokensInWindow,

      availableRequests: Math.max(
        0,
        this.config.maxRequestsPerMinute - requestsInWindow
      ),

      availableTokens: Math.max(
        0,
        this.config.maxTokensPerMinute - tokensInWindow
      )
    };
  }

  /**
   * Check if a request can proceed immediately.
   *
   * @param estimatedTokens Estimated tokens for the request.
   * @returns true if the request can proceed immediately.
   */
  canProceed(estimatedTokens: number = 1000): boolean {
    // Remove requests older than 60 seconds.
    this.pruneOldRecords();

    // Check concurrent request limit.
    if (this.activeRequests >= this.config.maxConcurrent) {
      return false;
    }

    // Number of requests in the current 60-second window.
    const requestsInWindow = this.requestHistory.length;

    // Total tokens used in the current 60-second window.
    const tokensInWindow = this.requestHistory.reduce(
      (sum, record) => sum + record.tokens,
      0
    );

    // Check requests-per-minute limit.
    if (
      requestsInWindow >=
      this.config.maxRequestsPerMinute
    ) {
      return false;
    }

    // Check tokens-per-minute limit.
    if (
      tokensInWindow + estimatedTokens >
      this.config.maxTokensPerMinute
    ) {
      return false;
    }

    return true;
  }

  /**
   * Wait for a concurrent request slot to become available.
   *
   * The promise is resolved by release() when a request slot
   * becomes available.
   */
  private async waitForSlot(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * Wait until rate limits allow the request to proceed.
   *
   * Uses a sliding 60-second window.
   *
   * @param estimatedTokens Estimated tokens for the request.
   */
  private async waitForRateLimit(
    estimatedTokens: number
  ): Promise<void> {
    while (!this.canProceed(estimatedTokens)) {
      this.pruneOldRecords();

      // If there are no records, there is nothing to wait for.
      if (this.requestHistory.length === 0) {
        break;
      }

      const oldestRequest = this.requestHistory[0];

if (!oldestRequest) {
  break;
}

const expirationTime =
  oldestRequest.timestamp + 60000;

      const now = Date.now();

      // Add a small 100ms buffer to make sure the record
      // has definitely expired from the sliding window.
      let waitTime =
        expirationTime - now + 100;

      // Never wait less than 100ms.
      waitTime = Math.max(100, waitTime);

      // Never sleep for more than 5 seconds.
      waitTime = Math.min(5000, waitTime);

      await new Promise<void>((resolve) => {
        setTimeout(resolve, waitTime);
      });
    }
  }

  /**
   * Remove request records older than 60 seconds.
   *
   * This maintains the sliding 60-second window.
   */
  private pruneOldRecords(): void {
    const cutoff = Date.now() - 60000;

    this.requestHistory = this.requestHistory.filter(
      (record) => record.timestamp > cutoff
    );
  }
}

/**
 * Wrap an async function with rate limiting.
 *
 * This convenience function automatically:
 * 1. Acquires a rate-limit slot.
 * 2. Executes the function.
 * 3. Releases the slot.
 * 4. Handles errors correctly.
 */
export async function withRateLimit<T>(
  rateLimiter: RateLimiter,
  fn: () => Promise<T>,
  estimatedTokens: number = 1000
): Promise<T> {
  await rateLimiter.acquire(estimatedTokens);

  try {
    const result = await fn();

    rateLimiter.release();

    return result;
  } catch (error) {
    rateLimiter.release();

    throw error;
  }
}

/**
 * Global rate limiter instance.
 */
export const globalRateLimiter = new RateLimiter();