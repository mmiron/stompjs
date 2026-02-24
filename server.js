const http = require("http");
const fs = require("fs");
const path = require("path");
const ServerInitializer = require("./src/utils/server-initializer");
const StompServerManager = require("./src/stomp/stomp-server");
const dataService = require("./src/services/data.service");

// Load .env.local if it exists (local overrides only)
const envLocalPath = path.join(__dirname, ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envLocal = fs.readFileSync(envLocalPath, "utf-8");
  envLocal.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=");
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_HOST = process.env.PUBLIC_HOST || "localhost";
const wsPathFromEnv = process.env.WS_PATH || "/ws";
const WS_PATH = wsPathFromEnv.startsWith("/") ? wsPathFromEnv : `/${wsPathFromEnv}`;

// Create Express app
const app = ServerInitializer.createExpressApp();

// Create HTTP server
const server = http.createServer(app);

// Initialize STOMP server
const stompServerManager = new StompServerManager(server, WS_PATH);

async function startServer() {
  try {
    // Load mock data before starting server
    await dataService.loadMockData();
    
    // Start the server
    server.listen(PORT, HOST, () => {
      console.log(`\n✅ Server is running on http://${PUBLIC_HOST}:${PORT}`);
      console.log(`✅ WebSocket endpoint: ws://${PUBLIC_HOST}:${PORT}${WS_PATH}`);
      console.log(`✅ Health check: http://${PUBLIC_HOST}:${PORT}/health\n`);
    });

  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});

startServer();

// Broadcast random record every 5 seconds to /topic/data
setInterval(() => {
  const allData = dataService.getAllData();
  if (allData.length > 0) {
    const randomIndex = Math.floor(Math.random() * allData.length);
    const randomRecord = allData[randomIndex];
    stompServerManager.broadcast("/topic/data", randomRecord);
  }
}, 5000);

// Every 3 seconds, randomly change a record and push to /topic/recordChanged
setInterval(() => {
  const allData = dataService.getAllData();
  if (allData.length > 0) {
    const randomIndex = Math.floor(Math.random() * allData.length);
    const record = allData[randomIndex];
    record.updatedAt = new Date().toISOString();
    stompServerManager.broadcast('/topic/recordChanged', record);
  }
}, 3000);

