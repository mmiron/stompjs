// Custom CORS middleware
const corsMiddleware = (req, res, next) => {
  // Set Access-Control-Allow-Origin to the specific origin of your frontend application
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');

  // Allow credentials to be sent with the request (e.g., cookies, HTTP authentication)
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Set allowed methods and headers for preflight requests (if applicable)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
};

module.exports = corsMiddleware;
