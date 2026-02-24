# Angular WebSocket STOMP + Node.js Server

This project contains:
- An Angular app (`ws-app`) using STOMP over WebSocket to communicate with a Node.js backend.
- A Node.js server (`server.js`) that acts as a STOMP broker over WebSocket.

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

For detailed setup and troubleshooting, see **[DEVELOPER_SETUP.md](DEVELOPER_SETUP.md)**.

## How It Works
- The Angular app connects to the Node.js server using STOMP over WebSocket.
- Messages sent to `/topic/data` and `/topic/recordChanged` are broadcast to all subscribers.
- Automatic reconnection with exponential backoff (1s → 30s) on connection loss.

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
└── DEVELOPER_SETUP.md                 # Developer guide

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
- STOMP topics: See `socket.service.ts` and `stomp-server.js`

---
For Copilot customization, see `.github/copilot-instructions.md`.
