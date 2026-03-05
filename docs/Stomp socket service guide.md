# STOMP/Socket Service Engineering Guide

This guide is for engineers building realtime client services with STOMP/WebSocket who want to avoid common reliability pitfalls and ship production-grade behavior.

If you are new to STOMP/WebSocket or do not have access to this codebase, start with:
- `Stomp socket service zero to prod.md`

It uses this repository as a reference implementation:
- Frontend façade: `ws-app/src/app/core/services/stomp.service.ts`
- Helper policies: `ws-app/src/app/core/services/socket-helpers/*`
- Backend STOMP server: `src/stomp/stomp-server.js`

---

## 1) What “good” looks like

A robust realtime service should be:
- **Correct**: subscribes/publishes to expected topics, parses payloads safely.
- **Resilient**: handles disconnects, flaky networks, tab sleep, and browser offline mode.
- **Observable**: emits structured telemetry for failure diagnosis and alerting.
- **Controllable**: supports runtime tuning and safe operational fallbacks.
- **Secure**: enforces authN/authZ and abuse limits.

If you only have connect + subscribe + reconnect, you are usually still below production-grade.

---

## 2) Recommended architecture pattern

Use a **façade + helper policies** model:

- **Façade service** (`stomp.service.ts`)
  - Owns STOMP client lifecycle and public API.
  - Exposes observables/signals to UI.
  - Delegates policy decisions to helpers.

- **Helper modules** (`socket-helpers/*`)
  - `network-config.helper.ts`: effective reconnect/heartbeat profile.
  - `runtime-config.helper.ts`: runtime config fetch and single-flight.
  - `tab-lifecycle.helper.ts`: wake/sleep transition decisions.
  - `socket-health.helper.ts`: STOMP/WS/UI health evaluation.
  - `stomp-restart.helper.ts`: guarded `deactivate -> activate` restart.
  - `topic-subscription.helper.ts`: requested topics + safe replacement.
  - `circuit-breaker.helper.ts`: failure thresholds and breaker transitions.

Why this works:
- You keep orchestration centralized and testable.
- You avoid a giant “god service.”
- You can unit-test policies without spinning up a full socket stack.

---

## 3) The failure modes you must design for

### A) Browser offline/online events
Symptoms:
- UI says “connected” while socket is effectively dead.
- Pending handshakes never finish.

Mitigation:
- Track offline state explicitly.
- Debounce offline reactions.
- Force-deactivate active clients after confirmed offline.
- On online: refresh profile, reactivate/restart safely.

### B) Tab sleep / background throttling
Symptoms:
- Socket appears open but no real traffic after wake.
- Missed updates after tab resumes.

Mitigation:
- Track background/foreground transitions.
- Run wake-time health checks.
- Skip reconnect if healthy; restart only when unhealthy.

### C) Reconnect storms
Symptoms:
- Rapid retries causing backend pressure and noisy logs.

Mitigation:
- Bounded exponential backoff + jitter.
- Max reconnect attempts.
- Circuit breaker with open/half-open/closed transitions.

### D) Stale subscriptions
Symptoms:
- Duplicate message handlers, repeated UI updates.

Mitigation:
- Maintain one active subscription per destination.
- Replace stale subscriptions on reconnect.

### E) Runtime profile mismatch
Symptoms:
- Aggressive mobile behavior on weak networks, unstable heartbeats.

Mitigation:
- Resolve profile from browser hints + backend runtime config.
- Keep safe defaults and clamp override values.

### F) Invalid payloads
Symptoms:
- runtime exceptions from malformed JSON or shape drift.

Mitigation:
- Parse defensively.
- Validate payload shape/type guard.
- Drop invalid messages and emit error telemetry.

---

## 4) Build order (practical implementation sequence)

1. **Basic façade**: connect, subscribe, publish, disconnect.
2. **Reconnect foundation**: backoff, jitter, retry ceilings.
3. **Health model**: STOMP + WS + UI consistency checks.
4. **Offline/online handling**: explicit browser state transitions.
5. **Tab lifecycle handling**: wake recovery path.
6. **Circuit breaker**: protect backend from reconnect loops.
7. **Topic manager**: requested topic set + replacement semantics.
8. **Runtime config**: backend-tunable network profiles.
9. **Telemetry**: structured events at all critical transitions.
10. **Security + operations hardening**: authN/authZ/alerts/runbooks.

---

## 5) Telemetry events to standardize

At minimum, emit these events with timestamps and context:
- connect success/failure
- WebSocket error/close reason
- reconnect attempt + delay
- breaker opened/reset/half-open transition
- health-check mismatch (STOMP vs WS vs UI)
- offline/online transitions
- wake recovery action (skip/restart/activate)
- runtime config load success/failure
- subscription add/replace/clear counts

Recommended common fields:
- `event`, `timestamp`, `sessionId`, `connectionState`, `attempt`, `profile`, `wsReadyState`, `reason`

---

## 6) Production-grade requirements

### Security (required)
- WebSocket/STOMP authentication (token-based).
- Topic-level authorization (subscribe/publish ACL).
- Strict origin policy and WSS only.
- Message size/rate limits.
- Server-side payload validation and sanitization.

### Observability & Operations (required)
- Structured logs + metrics + traces (not console-only).
- Dashboards for connection count, reconnects, breaker state, latency, error rates.
- Alerts for reconnect storms, breaker open, auth failures.
- Incident runbook + rollback plan + owner escalation path.

### Scalability (required if >1 node)
- Explicit multi-instance strategy:
  - shared broker/pub-sub, or
  - sticky sessions with clear constraints.
- Graceful shutdown: drain/close client sessions predictably.

### Reliability contracts (required)
- Delivery semantics defined (ordering, dupes, replay).
- Idempotency strategy for updates.
- Reconciliation path for missed updates after long disconnect.

---

## 7) Testing strategy that catches real issues

### Unit tests (fast)
- helper policies: breaker transitions, restart suppression, health evaluation, topic replacement.

### Integration tests
- connect -> subscribe -> publish -> consume.
- reconnect after backend restart.
- runtime config fetch success/failure paths.

### Fault injection / chaos
- offline/online flapping.
- high latency and packet loss.
- malformed payload injection.
- forced tab sleep/wake path.

### Load tests
- sustained throughput.
- spike bursts.
- reconnect storm simulation.

Pass criteria should be explicit before release.

---

## 8) Anti-patterns to avoid

- Mixing all policy logic directly into one giant socket service.
- Unbounded reconnect loops.
- Subscribing blindly on every connect without replacing previous subscriptions.
- Trusting incoming payload shape without validation.
- Declaring production-ready without telemetry/alerts/runbooks.
- Assuming single-node behavior will hold after horizontal scaling.

### Common pitfall -> exact fix

| Pitfall | Exact fix |
|---|---|
| Reconnect attempts spike during incidents | Increase reconnect base/max delay, add jitter, enforce attempt cap, and open breaker after threshold |
| Duplicate UI updates after reconnect | Track `destination -> subscription`, unsubscribe old before resubscribe, and assert one active handler per destination |
| Socket appears connected but data is stale after tab wake | Run wake health check; if unhealthy, guarded `deactivate -> activate` restart; if healthy, skip reconnect |
| Mobile clients flap between online/offline | Debounce offline handling and tune heartbeat/health-check intervals using runtime profile overrides |
| Payload drift breaks consumers | Add runtime schema validation + versioned event envelopes; drop invalid payloads with telemetry |
| Multi-node rollout causes missed events | Use shared broker/pub-sub or explicitly accept sticky-session limits and document failure behavior |
| Rollout canary passes locally but fails in production | Define stop criteria and monitor reconnect rate, STOMP error rate, and message latency before expanding traffic |

---

## 9) Deployment gate template

Before production, require:
- Security checklist complete.
- SLOs defined and alert thresholds configured.
- Runbook validated in at least one game-day/fire-drill.
- Smoke test validated post-deploy:
  - connect
  - subscribe
  - receive message
  - force disconnect
  - verify reconnect and state recovery

Use: `Production readiness checklist.md` as the formal gate document.

---

## 10) Quick starter for new teams

If you’re starting fresh:
1. Copy the façade + helper decomposition model.
2. Implement only one topic first end-to-end.
3. Add health checks before adding advanced features.
4. Add circuit breaker before load testing.
5. Add telemetry before calling it “stable.”
6. Do not ship without authN/authZ and operation runbooks.

---

## 11) Starter defaults profile (copy first, tune with telemetry)

Use this baseline as a practical starting point:

- heartbeat interval: `10000 ms`
- reconnect base delay: `1000 ms`
- reconnect max delay: `30000 ms`
- reconnect jitter: `500 ms`
- max reconnect attempts (windowed): `20`
- circuit breaker failure threshold: `5`
- circuit breaker open timeout: `45000 ms`
- health-check interval: `15000 ms`
- offline debounce: `1000 ms`
- max payload size (server-enforced starter): `64 KB`

Starter profile snippet:

```json
{
  "heartbeatIntervalMs": 10000,
  "reconnect": {
    "baseDelayMs": 1000,
    "maxDelayMs": 30000,
    "jitterMs": 500,
    "maxAttemptsPerWindow": 20
  },
  "circuitBreaker": {
    "failureThreshold": 5,
    "openTimeoutMs": 45000
  },
  "healthCheckIntervalMs": 15000,
  "offlineDebounceMs": 1000,
  "maxPayloadSizeBytes": 65536
}
```

Operational rule: tune one variable at a time and validate with telemetry before keeping changes.

For rationale, tuning guidance, and telemetry signals, see section 20 in `Stomp socket service zero to prod.md`.

---

## Related docs in this repo

- `Stomp socket service zero to prod.md`
- `Production readiness checklist.md`
- `Load testing.md`
- `Readme.md`
- `ws-app/src/app/Readme.md`
