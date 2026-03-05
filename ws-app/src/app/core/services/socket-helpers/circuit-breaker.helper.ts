export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  timeoutMs: number;
}

export interface CircuitBreakerStateResult {
  state: CircuitBreakerState;
  transitionedToHalfOpen: boolean;
}

export interface CircuitBreakerFailureResult {
  state: CircuitBreakerState;
  failureCount: number;
  opened: boolean;
}

export interface CircuitBreakerResetResult {
  state: CircuitBreakerState;
  wasReset: boolean;
}

/**
 * Encapsulates circuit-breaker failure counting and state transitions.
 */
export class CircuitBreakerTracker {
  private state: CircuitBreakerState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;

  public getFailureCount(): number {
    return this.failureCount;
  }

  public getState(config: CircuitBreakerConfig, nowMs: number = Date.now()): CircuitBreakerStateResult {
    if (this.state === 'open') {
      const timeSinceLastFailure = nowMs - this.lastFailureTime;
      if (timeSinceLastFailure >= config.timeoutMs) {
        this.state = 'half-open';
        return {
          state: this.state,
          transitionedToHalfOpen: true,
        };
      }
    }

    return {
      state: this.state,
      transitionedToHalfOpen: false,
    };
  }

  public recordFailure(config: CircuitBreakerConfig, nowMs: number = Date.now()): CircuitBreakerFailureResult {
    this.failureCount += 1;
    this.lastFailureTime = nowMs;

    let opened = false;
    if (this.state === 'half-open' || this.failureCount >= config.failureThreshold) {
      if (this.state !== 'open') {
        this.state = 'open';
        opened = true;
      }
    }

    return {
      state: this.state,
      failureCount: this.failureCount,
      opened,
    };
  }

  public reset(): CircuitBreakerResetResult {
    const wasReset = this.failureCount > 0 || this.state !== 'closed';
    this.failureCount = 0;
    this.state = 'closed';

    return {
      state: this.state,
      wasReset,
    };
  }
}
