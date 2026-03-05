import { CircuitBreakerTracker } from './circuit-breaker.helper';

describe('CircuitBreakerTracker', () => {
  const config = {
    failureThreshold: 3,
    timeoutMs: 1000,
  };

  it('starts in closed state with zero failures', () => {
    const tracker = new CircuitBreakerTracker();

    const state = tracker.getState(config, 0);

    expect(state.state).toBe('closed');
    expect(state.transitionedToHalfOpen).toBeFalse();
    expect(tracker.getFailureCount()).toBe(0);
  });

  it('opens when failure threshold is reached', () => {
    const tracker = new CircuitBreakerTracker();

    tracker.recordFailure(config, 100);
    tracker.recordFailure(config, 200);
    const result = tracker.recordFailure(config, 300);

    expect(result.opened).toBeTrue();
    expect(result.state).toBe('open');
    expect(result.failureCount).toBe(3);
  });

  it('transitions open to half-open after timeout', () => {
    const tracker = new CircuitBreakerTracker();

    tracker.recordFailure(config, 100);
    tracker.recordFailure(config, 200);
    tracker.recordFailure(config, 300);

    const beforeTimeout = tracker.getState(config, 1200);
    const afterTimeout = tracker.getState(config, 1300);

    expect(beforeTimeout.state).toBe('open');
    expect(beforeTimeout.transitionedToHalfOpen).toBeFalse();
    expect(afterTimeout.state).toBe('half-open');
    expect(afterTimeout.transitionedToHalfOpen).toBeTrue();
  });

  it('re-opens immediately on failure while half-open', () => {
    const tracker = new CircuitBreakerTracker();

    tracker.recordFailure(config, 100);
    tracker.recordFailure(config, 200);
    tracker.recordFailure(config, 300);
    tracker.getState(config, 1300); // move to half-open

    const failureInHalfOpen = tracker.recordFailure(config, 1301);

    expect(failureInHalfOpen.opened).toBeTrue();
    expect(failureInHalfOpen.state).toBe('open');
  });

  it('resets back to closed with zero failures', () => {
    const tracker = new CircuitBreakerTracker();

    tracker.recordFailure(config, 100);
    tracker.recordFailure(config, 200);

    const reset = tracker.reset();
    const state = tracker.getState(config, 201);

    expect(reset.wasReset).toBeTrue();
    expect(reset.state).toBe('closed');
    expect(state.state).toBe('closed');
    expect(tracker.getFailureCount()).toBe(0);
  });
});
