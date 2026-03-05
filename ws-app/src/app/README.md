# App Structure

This application follows Angular best practices with a feature-based folder structure.

## Folder Organization

```
src/app/
├── core/                          # Core module - singleton services and app-wide utilities
│   ├── services/                  # Core services (interceptors, providers)
│   │   ├── data.service.ts       # Data management service
│   │   ├── locale.service.ts     # Localization service
│   │   ├── socket.service.ts     # WebSocket/STOMP service
│   │   └── index.ts              # Barrel export
│   ├── resolvers/                 # Route resolvers
│   │   ├── locale.resolve.ts     # Locale resolver for route guards
│   │   └── index.ts              # Barrel export
│   └── index.ts                  # Core barrel export
│
├── shared/                        # Shared module - reusable components, directives, pipes
│   ├── pipes/                     # Shared pipes
│   │   ├── translate.pipe.ts     # Translation pipe
│   │   └── index.ts              # Barrel export
│   ├── models/                    # Shared data models
│   │   ├── data.model.ts         # Data model interface
│   │   ├── data-record.view-model.ts  # ViewModel for table records
│   │   └── index.ts              # Barrel export
│   └── index.ts                  # Shared barrel export
│
├── features/                      # Feature modules - page-specific components
│   ├── home/                      # Home feature module
│   │   ├── home.component.ts
│   │   ├── home.component.html
│   │   └── home.component.css
│   │
│   ├── pdf-extract/               # PDF extraction feature module
│   │   ├── pdf-extract.component.ts
│   │   ├── pdf-extract.component.html
│   │   ├── pdf-extract.component.css
│   │   ├── pdf-extract.service.ts # Feature-specific service
│   │   └── pdf-extract.service.spec.ts
│   │
│   ├── qr-extract/                # QR code extraction feature module
│   │   ├── qr-extract.component.ts
│   │   ├── qr-extract.component.html
│   │   └── qr-extract.component.css
│   │
│   └── table/                     # Table/data display feature module
│       ├── table.component.ts
│       ├── table.component.html
│       ├── table.component.css
│       ├── table-filter.component.ts
│       ├── table-filter.component.html
│       ├── row-details.component.ts
│       └── row-details.component.html
│
├── app.routes.ts                  # Main application routes
├── app.config.ts                  # Application configuration
├── app.component.ts               # Root component
├── app.component.html             # Root template
└── app.component.css              # Root styles
```

## Key Principles

### Core Module
- **Purpose**: Houses singleton services that should only be instantiated once
- **Services**: Authentication, HTTP interceptors, global configuration
- **When to use**: Services that manage app-wide state or global utilities

### Shared Module  
- **Purpose**: Contains reusable components, directives, and pipes
- **Contents**: Shared UI components, utility pipes, common models
- **When to use**: Code that's used in multiple features

### Feature Modules
- **Purpose**: Self-contained feature areas with their own components and services
- **Structure**: Each feature is independent and can be lazy-loaded
- **Services**: Feature-specific services stay within the feature folder
- **When to use**: Grouping related functionality for a specific page or feature

## Import Guidelines

### From Core Services
```typescript
import { LocaleService } from '../../core/services/locale.service';
// or use barrel export
import { LocaleService } from '../../core';
```

### From Shared
```typescript
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
// or use barrel export
import { TranslatePipe } from '../../shared';
```

### Between Features
```typescript
// From pdf-extract in qr-extract component
import { PdfExtractService } from '../pdf-extract/pdf-extract.service';
```

## File Naming Conventions

- Components: `feature.component.ts`, `feature.component.html`, `feature.component.css`, `feature.component.spec.ts`
- Services: `feature.service.ts`, `feature.service.spec.ts`
- Pipes: `feature.pipe.ts`, `feature.pipe.spec.ts`
- Models: `feature.model.ts`, `feature.view-model.ts`
- Resolvers: `feature.resolve.ts`

## Benefits of This Structure

1. **Scalability**: Easy to add new features without cluttering the app folder
2. **Maintainability**: Related files are grouped together
3. **Reusability**: Shared code in core and shared modules
4. **Lazy Loading**: Features can be lazy-loaded for better performance
5. **Testability**: Clear separation of concerns improves testing
6. **Team Collaboration**: Multiple developers can work on different features
