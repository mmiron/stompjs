# Production Readiness Checklist

This checklist is tailored to this repository:
- Angular frontend (`ws-app`)
- Node.js backend (`server.js` + `src/`)
- STOMP over WebSocket realtime channel

Use this as a deployment gate for staging and production.

## Status Legend
- [ ] Not started
- [~] In progress / partial
- [x] Done

---

## 1) Architecture & Reliability

- [x] Reconnect strategy implemented (backoff + jitter)
- [x] Circuit breaker strategy implemented
- [x] Browser offline/online handling implemented
- [x] Tab sleep/wake recovery implemented
- [x] Health-check path implemented for STOMP/WebSocket state
- [~] Define message delivery guarantees (at-most-once / at-least-once / ordering)
- [ ] Define replay/recovery strategy after prolonged disconnect
- [ ] Document idempotency requirements for update operations

## 2) Security (Critical)

- [ ] Add authentication for WebSocket/STOMP connections
- [ ] Add authorization for topic subscriptions and publish destinations
- [ ] Validate and sanitize inbound STOMP payloads server-side
- [ ] Add message size limits and rate limiting (WS + HTTP)
- [ ] Enforce strict CORS/origin policy for production domains only
- [ ] Enforce HTTPS/WSS in production
- [ ] Secret management via environment/secret store (no hardcoded secrets)

## 3) Observability & Operations

- [~] Telemetry points defined in client service
- [ ] Replace console telemetry with structured logging/metrics pipeline
- [ ] Add correlation/request IDs across HTTP + WS lifecycle
- [ ] Define SLOs (availability, reconnect latency, message latency)
- [ ] Add alerting for critical events (circuit breaker open, reconnect storms, auth failures)
- [ ] Create runbook for incident response and rollback
- [ ] Add dashboards (error rate, reconnect count, WS connection count, message throughput)

## 4) Backend Runtime Hardening

- [ ] Validate runtime config endpoint responses with schema
- [ ] Add request timeouts and safe defaults for all endpoints
- [ ] Add graceful shutdown handling for active WS clients
- [ ] Add health/readiness endpoints suited for orchestrators
- [ ] Add process supervision strategy (PM2/systemd/container orchestration)
- [ ] Define horizontal scaling strategy for STOMP (shared broker or sticky sessions)

## 5) Frontend Runtime Hardening

- [x] Realtime logic modularized into helper policies
- [x] Fallback-safe defaults for runtime socket config
- [ ] Add feature flag kill-switch for realtime channel
- [ ] Add UX path for degraded mode (polling/manual refresh fallback)
- [ ] Add frontend error budget guardrails (throttle retries under severe outage)

## 6) Data & Consistency

- [ ] Define canonical event schema with versioning
- [ ] Add schema validation at publish/consume boundaries
- [ ] Add compatibility policy for schema evolution
- [ ] Define dedup strategy for duplicate messages
- [ ] Define reconciliation path for missed updates

## 7) Testing & Quality Gates

- [x] Unit tests passing for current helper/service architecture
- [~] Add integration tests for full STOMP connect/subscribe/publish flow
- [ ] Add chaos tests (offline flaps, broker restart, high latency)
- [ ] Add load tests in CI for baseline thresholds
- [ ] Add security tests (auth failures, malformed frames, abuse cases)
- [ ] Enforce CI gates for lint/test/build before deploy

## 8) Deployment & Release

- [ ] Define environment matrix (dev/staging/prod) with explicit config values
- [ ] Add immutable build artifacts and release tagging
- [ ] Add canary or phased rollout strategy
- [ ] Add rollback automation and verification checklist
- [ ] Add post-deploy verification script (HTTP + WS smoke)

## 9) Documentation & Ownership

- [x] Architecture docs updated for socket helper decomposition
- [ ] Add ownership map (who owns frontend realtime / backend realtime / infra)
- [ ] Add on-call escalation path
- [ ] Add SLA/maintenance window policy
- [ ] Keep this checklist versioned and reviewed per release

---

## Release Gate Proposal

### Staging Exit Criteria
- All items in sections 1 and 7 marked [x] or [~]
- At least 70% of section 3 completed
- Security section has no [ ] on authentication/authorization basics

### Production Exit Criteria
- All critical security items complete
- Observability + alerting complete
- Runbook + rollback validated in at least one fire drill
- Load/chaos tests pass agreed thresholds
- Deployment checklist fully complete

---

## Suggested Next 3 Tasks (Highest ROI)

1. Implement WS/STOMP authentication + topic authorization
2. Replace console telemetry with structured metrics/logging + alerts
3. Add production smoke test covering connect -> subscribe -> receive -> reconnect
