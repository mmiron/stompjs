# Project Structure & Organization

This repository contains a full-stack application with Angular frontend and Node.js backend, organized following industry best practices.

## Project Layout

```
ng-ws-stomp-nodejs/
├── ws-app/                       # Angular frontend application
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/            # Singleton services, resolvers
│   │   │   ├── shared/          # Reusable components, pipes, models
│   │   │   ├── features/        # Feature modules (lazy-loaded)
│   │   │   ├── app.routes.ts    # Route configuration
│   │   │   ├── app.config.ts    # App providers
│   │   │   └── app.component.*  # Root component
│   │   ├── assets/              # Static assets
│   │   ├── main.ts              # Bootstrap file
│   │   └── styles.css           # Global styles
│   ├── angular.json             # Angular CLI configuration
│   └── package.json             # Frontend dependencies
│
├── src/                          # Node.js backend source
│   ├── config/                  # Configuration files
│   ├── middleware/              # Express middleware
│   ├── routes/                  # API route handlers
│   ├── services/                # Business logic
│   ├── stomp/                   # WebSocket/STOMP server
│   └── utils/                   # Utility functions
│
├── server.js                     # Backend entry point
├── mock-data.json               # Mock database
├── package.json                 # Backend dependencies
├── README.md                     # Main documentation
├── BACKEND_STRUCTURE.md          # Backend architecture docs
└── .github/
    └── copilot-instructions.md  # Copilot configuration
```

## Frontend Architecture

### Core Module (`src/app/core/`)
**Purpose**: Singleton services and app-wide utilities

**Contents**:
- `services/` - Application-wide services
  - `data.service.ts` - Data management
  - `locale.service.ts` - Localization
  - `socket.service.ts` - WebSocket connectivity
- `resolvers/` - Route guards and resolvers
  - `locale.resolve.ts` - Pre-load locale data

**Usage**: Import once at app level, use via dependency injection

### Shared Module (`src/app/shared/`)
**Purpose**: Reusable code across features

**Contents**:
- `pipes/` - Custom Angular pipes
  - `translate.pipe.ts` - Translation utility
- `models/` - Data models and interfaces
  - `data.model.ts` - Data interfaces
  - `data-record.view-model.ts` - ViewModel for table

**Usage**: Import in any feature that needs shared code

### Features (`src/app/features/`)
**Purpose**: Self-contained feature modules

**Modules**:
1. **Home** (`features/home/`)
   - Landing page with navigation cards
   - Uses shared pipes and core services
   
2. **PDF Extract** (`features/pdf-extract/`)
   - PDF form section extraction
   - Includes `pdf-extract.service.ts`
   - Displays extracted regions as images
   
3. **QR Extract** (`features/qr-extract/`)
   - QR code detection from PDFs
   - Uses `PdfExtractService` from sibling feature
   
4. **Table** (`features/table/`)
   - Data display and filtering
   - Sub-components: `TableComponent`, `TableFilterComponent`, `RowDetailsComponent`
   - Real-time updates via WebSocket

## Backend Architecture

### Configuration (`src/config/`)
Centralized configuration management
- CORS settings
- Environment variables
- Feature flags

### Middleware (`src/middleware/`)
Express middleware for cross-cutting concerns
- CORS handling
- Authentication (future)
- Request logging (future)

### Routes (`src/routes/`)
API endpoint definitions
- REST endpoints
- Parameter validation
- Response formatting

### Services (`src/services/`)
Business logic layer
- Data access
- Processing
- External API calls

### STOMP (`src/stomp/`)
WebSocket server for real-time communication
- Connection management
- Message broadcasting
- Topic subscriptions

### Utils (`src/utils/`)
Helper functions and utilities
- Server initialization
- Common helpers

## Technology Stack

### Frontend
- **Angular 19** (Standalone components)
- **TypeScript** (strict mode)
- **RxJS** (reactive programming)
- **Standalone Components** (no NgModules)
- **Lazy Loading** (route-based code splitting)

### Backend
- **Node.js** (v18+)
- **Express** (web framework)
- **STOMP Broker JS** (WebSocket/STOMP)
- **CORS** (cross-origin requests)

## Import Guidelines

### Frontend

#### From Core Services
```typescript
// Direct import
import { LocaleService } from '../../core/services/locale.service';

// Using barrel export (preferred)
import { LocaleService } from '../../core';
```

#### From Shared
```typescript
// Direct import
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

// Using barrel export (preferred)
import { TranslatePipe } from '../../shared';
```

#### Between Features
```typescript
// Cross-feature import (sibling features only)
import { PdfExtractService } from '../pdf-extract/pdf-extract.service';
```

### Backend

#### Using Services
```typescript
const dataService = require('./services/data.service');
```

#### Using Routes
```typescript
const dataRoutes = require('./routes/data.routes');
app.use(dataRoutes);
```

## Development Workflow

### Starting the Development Environment

```bash
# Terminal 1: Start Backend
npm install
npm start

# Backend runs on http://localhost:3000
# WebSocket available at ws://localhost:3000/ws

# Terminal 2: Start Frontend
cd ws-app
npm install
npm start

# Frontend runs on http://localhost:4200
```

### Adding a New Feature

1. Create feature folder in `src/app/features/[feature-name]/`
2. Add components: `[feature].component.ts|html|css`
3. Add feature-specific service if needed
4. Create route in `app.routes.ts`
5. Link from navigation components

### Adding a New Backend API

1. Create service in `src/services/`
2. Create routes in `src/routes/`
3. Register routes in `src/utils/server-initializer.js`
4. Add CORS and middleware as needed

## Best Practices

### Frontend
- ✅ Use standalone components
- ✅ Lazy-load features
- ✅ Keep services lean and focused
- ✅ Use proper folder structure
- ✅ Avoid circular dependencies
- ✅ Use barrel exports (index.ts)
- ✅ Implement OnDestroy for subscriptions
- ✅ Use ChangeDetectionStrategy.OnPush when possible

### Backend
- ✅ Separate concerns (routes, services, middleware)
- ✅ Use configuration files
- ✅ Implement error handling
- ✅ Log important events
- ✅ Use environment variables
- ✅ Implement graceful shutdown
- ✅ Use singleton pattern for services
- ✅ Validate input data

## Performance Considerations

**Lazy Loading**
- Features are loaded on-demand via Angular Router
- Reduces initial bundle size

**Service Reuse**
- Core services are singletons
- Shared components avoid duplication

**Real-time Updates**
- WebSocket instead of polling
- Efficient STOMP message routing

## Deployment

### Frontend Build
```bash
cd ws-app
npm run build
# Output: dist/ folder for deployment
```

### Backend
```bash
# Set PORT environment variable
PORT=8000 npm start
```

## Documentation

- `README.md` - This file (overview)
- `BACKEND_STRUCTURE.md` - Backend architecture details
- `ws-app/src/app/README.md` - Frontend architecture details
- `ws-app/README.md` - Angular app documentation

## Project Statistics

- **Frontend Components**: 7 (Home, PdfExtract, QrExtract, Table, RowDetails, TableFilter)
- **Frontend Services**: 3 (Data, Locale, Socket) + 1 shared feature service (PdfExtract)
- **Shared Pipes**: 1 (Translate)
- **Backend Routes**: 1 module (Data)
- **Backend Services**: 1 (Data)
- **API Endpoints**: 4 main + health check
- **WebSocket Topics**: 2 (/topic/data, /topic/recordChanged)

## Future Enhancements

- [ ] Authentication module (JWT)
- [ ] Database integration (MongoDB/PostgreSQL)
- [ ] Advanced logging (Winston/Bunyan)
- [ ] Input validation (Joi/Yup)
- [ ] API documentation (Swagger)
- [ ] E2E testing (Cypress)
- [ ] Unit test coverage (80%+)
- [ ] CI/CD pipeline

## Contributing

1. Follow the established folder structure
2. Use proper naming conventions
3. Keep components small and focused
4. Write unit tests for services
5. Update documentation for new features

## Support

For issues or questions, refer to the detailed documentation in individual README files.
