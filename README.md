# Angular WebSocket STOMP + Node.js Server

This project contains:
- An Angular app (`ws-app`) using STOMP over WebSocket to communicate with a Node.js backend.
- A Node.js server (`server.js`) that acts as a STOMP broker over WebSocket.

## Repository Layout

- This is a single repository (monorepo) on branch `main`.
- `ws-app` is tracked as a normal folder in this repo (not a git submodule).
- Commit and push from the repository root to include both backend and frontend changes together.

## Quick Start

### One-Click Development (VS Code)
Press `Ctrl+Shift+B` (or `Cmd+Shift+B` on macOS) to start both servers simultaneously:
- Node.js STOMP server on `http://localhost:3000`
- Angular dev server on `http://localhost:4200`

### Command Line
```bash
# Start both backend and frontend in one command
npm run dev:all

# Or start individually in separate terminals:
npm run dev:backend    # Node.js with nodemon watch
npm run dev:frontend   # Angular with live reload
```

## Environment Configuration

Create a `.env.local` file to override backend defaults without committing changes:

```bash
cp .env.local.example .env.local
# Edit .env.local with your settings
```

Supported variables:
- `PORT` (default: 3000)
- `HOST` (default: 0.0.0.0)
- `PUBLIC_HOST` (default: localhost)
- `WS_PATH` (default: /ws)

For detailed setup and troubleshooting, see **[Developer setup.md](docs/Developer%20setup.md)**.

## How It Works
- The Angular app connects to the Node.js server using STOMP over WebSocket.
- Messages sent to `/topic/data` and `/topic/recordChanged` are broadcast to all subscribers.
- Automatic reconnection with exponential backoff (1s → 30s) on connection loss.

## Socket Helpers Overview (Frontend)
- `stomp.service.ts` remains the STOMP lifecycle/orchestration façade.
- `network-config.helper.ts` resolves effective reconnect/heartbeat profile.
- `runtime-config.helper.ts` handles runtime config fetch + single-flight coordination.
- `tab-lifecycle.helper.ts` evaluates background/foreground wake recovery decisions.
- `socket-health.helper.ts` computes STOMP/WebSocket/UI health snapshots.
- `stomp-restart.helper.ts` coordinates guarded restart (`deactivate -> activate`).
- `topic-subscription.helper.ts` tracks requested topics and replaces stale subscriptions safely.
- `circuit-breaker.helper.ts` encapsulates failure thresholds and state transitions.

## Project Structure

```
.
├── server.js                          # Node.js entry point
├── src/
│   ├── config/                        # Server configuration
│   ├── middleware/                    # Express middleware (CORS, etc.)
│   ├── routes/                        # API routes
│   ├── services/                      # Business logic (data, etc.)
│   ├── stomp/                         # STOMP server setup
│   └── utils/                         # Utilities
├── ws-app/                            # Angular application
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/                  # Services, resolvers
│   │   │   ├── features/              # Feature modules (table, PDF, QR)
│   │   │   └── shared/                # Shared components, models, pipes
│   │   ├── environments/              # Angular environment configs
│   │   └── index.html                 # Entry HTML
│   └── angular.json                   # Angular build config
├── .env.local.example                 # Environment override template
└── docs/Developer setup.md            # Developer guide

```

## Testing

```bash
# Run all tests (headless)
npm test

# Run with coverage
npm run test:ci

# Debug in Chrome
# In VS Code: Ctrl+Shift+B → "Debug current spec file (Karma)"
```

## Customization
- Angular code: `ws-app/src/app/`
- Node.js server logic: `src/` directories
- STOMP topics: See `stomp.service.ts` and `stomp-server.js`

## Production Readiness
- Use [Production readiness checklist.md](docs/Production%20readiness%20checklist.md) as the staging/production deployment gate.
- Use [Stomp socket service guide.md](docs/Stomp%20socket%20service%20guide.md) for implementation patterns, failure modes, and hardening guidance.
- Use [Stomp socket service zero to prod.md](docs/Stomp%20socket%20service%20zero%20to%20prod.md) for a beginner-friendly, codebase-independent path from fundamentals to production readiness.

## Business Planning Docs
- Use [CH-Document-Map.md](docs/CH-Document-Map.md) as the index for the full business planning and lender/investor document pack.

---
For Copilot customization, see `.github/copilot-instructions.md`.
