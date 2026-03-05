# Backend Project Structure

This Node.js backend follows a clean, modular architecture suitable for scalable applications.

## Folder Organization

```
.
├── src/                          # Main source code directory
│   ├── config/                   # Configuration files
│   │   └── cors.config.js       # CORS configuration
│   │
│   ├── middleware/               # Express middleware
│   │   └── cors.middleware.js   # Custom CORS middleware
│   │
│   ├── routes/                   # API route handlers
│   │   └── data.routes.js       # Data endpoints
│   │
│   ├── services/                 # Business logic layer
│   │   └── data.service.js      # Data access and processing
│   │
│   ├── stomp/                    # WebSocket/STOMP handling
│   │   └── stomp-server.js      # STOMP server management
│   │
│   └── utils/                    # Utility functions
│       └── server-initializer.js # Express app setup
│
├── mock-data.json                # Mock data file
├── server.js                     # Entry point
├── package.json                  # Dependencies
└── Readme.md                     # This file
```

## File Descriptions

### Config Directory
- **cors.config.js**: Centralized CORS configuration that can be modified for different environments

### Middleware Directory
- **cors.middleware.js**: Custom middleware for handling CORS headers and preflight requests

### Routes Directory
- **data.routes.js**: REST API endpoints for data operations
  - GET `/api/data` - Get all data
  - GET `/api/data/:id` - Get specific record
  - POST `/api/data/filter` - Filter data by criteria
  - GET `/health` - Health check endpoint

### Services Directory
- **data.service.js**: Singleton service handling:
  - Loading mock data from JSON file
  - Retrieving all data
  - Finding data by ID
  - Filtering data by criteria

### STOMP Directory
- **stomp-server.js**: WebSocket/STOMP server management
  - Initializes STOMP over WebSocket at `/ws`
  - Handles subscriptions and message broadcasting
  - Methods for broadcasting to specific topics

### Utils Directory
- **server-initializer.js**: Centralizes Express app configuration
  - Applies all middleware
  - Registers all routes
  - Sets up error handling

### Entry Point
- **server.js**: Main application entry point
  - Initializes Express and HTTP server
  - Sets up STOMP streaming
  - Manages periodic data broadcasts
  - Handles graceful shutdown

## Running the Server

```bash
# Install dependencies (if not already done)
npm install

# Start the development server
npm start

# Server will run on http://localhost:3000
# WebSocket available at ws://localhost:3000/ws
```

## Environment Variables

```bash
PORT=3000  # Default port (can be overridden)
```

## Key Features

1. **Modular Architecture**: Each concern is separated into its own module
2. **Service Layer**: Business logic is abstracted in services
3. **Route Organization**: All API endpoints are organized in route modules
4. **STOMP WebSocket**: Real-time bidirectional communication with clients
5. **Error Handling**: Graceful error handling and logging
6. **Graceful Shutdown**: Proper cleanup on process termination

## API Endpoints

### Data Endpoints
- `GET /api/data` - Retrieve all data records
- `GET /api/data/:id` - Retrieve specific record by ID
- `POST /api/data/filter` - Filter records (send JSON criteria in body)

### Health Check
- `GET /health` - Returns server status and timestamp

### WebSocket (STOMP)
- Path: `/ws`
- Topics:
  - `/topic/data` - Random data broadcast every 5 seconds
  - `/topic/recordChanged` - Modified record updates every 3 seconds

## Best Practices Implemented

1. **Separation of Concerns**: Each module has a single responsibility
2. **Configuration Externalization**: Config values are in dedicated files
3. **Middleware Pattern**: Reusable middleware for cross-cutting concerns
4. **Service Singleton**: DataService is instantiated once and reused
5. **Error Handling**: Comprehensive error handling in routes and services
6. **Logging**: Console logging for monitoring and debugging
7. **Graceful Shutdown**: Proper process termination handling

## Adding New Features

### Adding a New API Endpoint
1. Create your logic in `src/services/`
2. Add routes in `src/routes/`
3. Import and register in `src/utils/server-initializer.js`

### Adding New Middleware
1. Create middleware file in `src/middleware/`
2. Import in `src/utils/server-initializer.js`
3. Apply with `app.use()`

### Adding New STOMP Topics
1. Modify `src/stomp/stomp-server.js`
2. Add broadcasts with `stompServerManager.broadcast()`
