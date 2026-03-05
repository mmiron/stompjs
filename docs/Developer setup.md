# Developer Setup & Ergonomics

## Quick Start (One-Click Development)

### Option 1: VS Code (Recommended)
From the root directory, press `Ctrl+Shift+B` (or `Cmd+Shift+B` on macOS) to run the default build task, which will start:
- ✅ Node.js STOMP server (port 3000, with nodemon watch mode)
- ✅ Angular dev server (port 4200)
- ✅ Automatic reload on code changes

**Terminal Output**: Both servers will log to the same terminal with distinct prefixes.

### Option 2: Command Line
```bash
# From workspace root
npm run dev:all

# Or run individually in separate terminals:
npm run dev:backend       # Node.js server with watch
npm run dev:frontend      # Angular dev server
```

---

## Environment Configuration

### Using `.env.local` for Local Overrides

The backend automatically loads `.env.local` if present in the root directory. This allows you to override default settings without committing changes.

#### Step 1: Create `.env.local`
```bash
cp .env.local.example .env.local
```

#### Step 2: Edit for Your Environment
```bash
# Edit .env.local with your settings
PORT=3000
HOST=localhost
PUBLIC_HOST=localhost
WS_PATH=/stomp
```

#### Step 3: Restart Backend
The backend will pick up the changes on next `npm run dev` or VS Code task restart.

### Environment Variables Reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3000 | Backend HTTP server port |
| `HOST` | 0.0.0.0 | Bind address (use 127.0.0.1 for local only) |
| `PUBLIC_HOST` | localhost | Public hostname for WebSocket connections |
| `WS_PATH` | /ws | STOMP WebSocket endpoint path |

**Note**: `.env.local` is **never** committed (see `.gitignore`). This keeps local overrides private.

---

## Testing

### Run All Tests (Headless)
```bash
npm test
```

### Debug Tests in Chrome
Press `Ctrl+Shift+B` and select "Debug current spec file (Karma)" to open tests in DevTools.

### Run Specific Test File
```bash
# From ws-app directory
npm run test:one -- --include="src/app/core/services/socket.service.spec.ts"
```

---

## Docker & Production

### Build for Production
```bash
npm run build
```

Outputs:
- Backend: Node.js executable via `npm start`
- Frontend: `ws-app/dist/` (serve with Express static middleware)

### Environment Variables in Production
Set environment variables directly instead of `.env.local`:

```bash
# Docker
docker run -e PORT=3000 -e PUBLIC_HOST=api.example.com my-app

# Kubernetes
env:
  - name: PORT
    value: "3000"
  - name: PUBLIC_HOST
    value: "api.example.com"
```

---

## Troubleshooting

### Port Already in Use
If you see "Port 3000 already in use", update `.env.local`:
```bash
PORT=3001
```

### WebSocket Connection Fails
1. Verify `PUBLIC_HOST` matches your browser's hostname
2. Check firewall allows WebSocket traffic on the port
3. Restart backend after config changes

### Angular App Won't Connect
1. Ensure backend is running: `http://localhost:3000/health`
2. Check browser console for STOMP connection errors
3. Verify Angular `environment.ts` has correct `wsUrl`

---

## Architecture Notes

- **Backend** (`server.js`): Express.js + STOMP broker on WebSocket
- **Frontend** (`ws-app/`): Angular 21 + RxJS, connects via `@stomp/stompjs`
- **Config**: Environment-driven via `src/environments/environment.ts` (Angular) and env vars + `.env.local` (Node.js)
- **Real-time Data**: STOMP topics (`/topic/data`, `/topic/recordChanged`)

---

## VS Code Extensions

Recommended for best developer experience:
- **Angular Language Service** - Template type checking
- **Prettier** - Code formatting
- **ESLint** - Linting
- **Debugger for Chrome** - Test debugging
