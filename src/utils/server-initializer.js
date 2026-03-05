const express = require('express');
const cors = require('cors');
const corsConfig = require('../config/cors.config');
const corsMiddleware = require('../middleware/cors.middleware');
const dataRoutes = require('../routes/data.routes');
const runtimeConfigRoutes = require('../routes/runtime-config.routes');

class ServerInitializer {
  static createExpressApp() {
    const app = express();
    
    // Middleware
    app.use(express.json());
    app.use(cors(corsConfig));
    app.use(corsMiddleware);

    // Routes
    app.use(dataRoutes);
    app.use(runtimeConfigRoutes);

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error('Error:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    });

    return app;
  }
}

module.exports = ServerInitializer;
