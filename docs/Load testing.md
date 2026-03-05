# Load Testing Guide

## Overview

The load testing framework provides comprehensive performance testing for high-frequency STOMP message handling. It allows you to simulate various network conditions and message patterns to validate your WebSocket connection's resilience and performance.

## Quick Start

### UI-Based Testing

1. Start the Angular dev server: `npm start`
2. The Load Test Runner appears at the bottom of the page (dev mode only)
3. Click any test scenario to start
4. Monitor metrics in real-time
5. Review results after test completes

### Programmatic Testing

```typescript
import { LoadTestService, LoadTestConfig } from './core/services/load-test.service';

constructor(private loadTestService: LoadTestService) {}

async testHighLoad() {
  const config: LoadTestConfig = {
    name: 'Custom Test',
    messagesPerSecond: 250,
    durationSeconds: 30,
    messageSize: 'medium',
    pattern: 'burst'
  };

  const metrics = await this.loadTestService.runLoadTest(config);
  console.log('Test complete:', metrics);
}
```

## Test Scenarios

### 1. **Baseline** (10 msg/sec, 10s)
- Small messages at constant rate
- Validates basic connectivity
- **Expected behavior:** 100% success, <10ms latency

### 2. **Moderate Load** (100 msg/sec, 15s)
- Medium messages at steady rate
- Typical user scenario
- **Expected behavior:** 100% success, <50ms latency

### 3. **High Load** (500 msg/sec, 20s)
- Medium messages at high rate
- Tests sustained performance
- **Expected behavior:** 95%+ success, <100ms latency

### 4. **Extreme Load** (1000+ msg/sec, 30s)
- Large messages with burst pattern
- Stress test with complex payloads
- **Expected behavior:** 80%+ success

### 5. **Spike Test** (200 msg/sec, 20s, spike pattern)
- Simulates sudden traffic surge
- Tests circuit breaker behavior
- **Expected behavior:** Graceful degradation

### 6. **Ramp Test** (500 msg/sec, 25s, ramp pattern)
- Gradually increasing load
- Identifies breaking point
- **Expected behavior:** Performance degrades gracefully

## Message Patterns

### Constant
- Fixed message rate throughout test
- **Use case:** Baseline performance measurement

### Burst
- Every 2 seconds, send 10x burst
- **Use case:** Test message buffering

### Spike
- Gradual increase then sudden drop
- **Use case:** Test circuit breaker recovery

### Ramp
- Gradually increasing load over time
- **Use case:** Find breaking point

## Metrics Explained

| Metric | Description | Healthy Range |
|--------|-------------|----------------|
| **Total Messages** | Messages sent during test | All planned messages |
| **Successful** | Messages processed without error | 95%+ |
| **Failed** | Messages lost or errored | <5% |
| **Throughput** | Messages per second (actual) | ≥ Target rate |
| **Avg Latency** | Average message processing time | <100ms |
| **Min/Max Latency** | Range of latency values | Min <10ms, Max <500ms |
| **Memory Delta** | Memory used during test | <50MB for baseline |
| **Est. CPU** | CPU usage estimate | <80% |
| **Duration** | Test runtime | ≈ Expected duration |

## Interpreting Results

### ✅ Healthy Results
```
- Throughput: 500+ msg/sec
- Avg Latency: <50ms
- Failed: 0-2%
- Memory: <20MB delta
- CPU: <60%
→ System handles load efficiently
```

### ⚠️ Degraded Performance
```
- Throughput: 200-500 msg/sec
- Avg Latency: 50-150ms
- Failed: 3-10%
- Memory: 20-50MB delta
- CPU: 60-80%
→ Circuit breaker likely triggered
→ System self-healing in progress
```

### ❌ Failure Conditions
```
- Throughput: <200 msg/sec
- Avg Latency: >150ms
- Failed: >10%
- Memory: >50MB delta
- CPU: >80%
→ System under severe stress
→ Manual intervention may be needed
```

## Advanced Usage

### Custom Configuration

```typescript
const customTest: LoadTestConfig = {
  name: 'Payment Service Peak Load',
  messagesPerSecond: 750,
  durationSeconds: 60,
  messageSize: 'large',
  pattern: 'ramp'
};

const results = await this.loadTestService.runLoadTest(customTest);
```

### Monitoring Circuit Breaker Behavior

The load tester automatically tracks circuit breaker state transitions:

```typescript
// In your component
circuitBreakerState = this.socketService.circuitBreakerState;

// Will change from 'closed' → 'open' → 'half-open' → 'closed'
```

### Stress Testing with Network Conditions

Combine load tests with browser DevTools network throttling:

1. Open DevTools → Network tab
2. Select throttling profile (3G, 4G, etc.)
3. Run load test
4. Observe how system adapts to latency

## Best Practices

### ✅ Do's

- **Start with baseline** - Establish healthy baseline first
- **Increment gradually** - Move from moderate → high → extreme
- **Test after code changes** - Validate performance impact
- **Monitor memory** - Watch for memory leaks under load
- **Test during off-hours** - Don't hammer backend during usage
- **Run multiple times** - Average results across runs

### ❌ Don'ts

- **Don't hit production servers** - Use staging environment
- **Don't test in production without approval**
- **Don't ignore circuit breaker triggers** - It's working as designed
- **Don't assume one test is definitive** - Environmental factors vary

## Troubleshooting

### Test hangs or times out

**Cause:** Circuit breaker opened after too many failures  
**Solution:** Check backend logs, restart services, try baseline test first

### Extremely high latency (>1000ms)

**Cause:** Backend overloaded or network throttled  
**Solution:** Check backend resources, try with smaller message size

### Memory not released after test

**Cause:** Potential memory leak in message handling  
**Solution:** Check for unclosed subscriptions, enable Chrome DevTools memory profiling

### Inconsistent results between runs

**Cause:** System resource contention  
**Solution:** Close other applications, run tests at quieter times, multiple runs

## Performance Targets

### Recommended Thresholds by Scenario

| Scenario | Msg/Sec | Latency | Success Rate | Memory |
|----------|---------|---------|--------------|--------|
| Development | <100 | <50ms | 100% | <10MB |
| Staging | <500 | <100ms | 95%+ | <30MB |
| Production | <1000+ | <200ms | 90%+ | <50MB |

## Next Steps

- Run baseline test to establish baseline metrics
- Run moderate test to validate normal operation
- Run high load test for capacity planning
- Implement automated CI/CD tests using LoadTestService API
- Monitor production metrics against baseline

## Related Documentation

- [Stomp Service](../ws-app/src/app/core/services/stomp.service.ts) - Core STOMP client
- [Circuit Breaker Pattern](../Readme.md#circuit-breaker) - Resilience mechanism
- [Connection Status Component](../ws-app/src/app/shared/components/connection-status.component.ts) - UI indicators
