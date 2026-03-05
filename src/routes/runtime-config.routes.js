const express = require('express');

const router = express.Router();

const SOCKET_PROFILE_DEFAULT = {
  baseReconnectDelayMs: 1000,
  maxReconnectDelayMs: 30000,
  reconnectJitterMs: 500,
  maxReconnectAttempts: 20,
  healthCheckIntervalMs: 30000,
  stompHeartbeatMs: 30000,
  connectionTimeoutMs: 15000,
  offlineDebounceMs: 1500,
  circuitBreakerFailureThreshold: 5,
  circuitBreakerTimeoutMs: 60000,
};

const SOCKET_PROFILE_SLOW = {
  baseReconnectDelayMs: 1500,
  maxReconnectDelayMs: 60000,
  reconnectJitterMs: 1000,
  maxReconnectAttempts: 30,
  healthCheckIntervalMs: 45000,
  stompHeartbeatMs: 60000,
  connectionTimeoutMs: 30000,
  offlineDebounceMs: 2500,
  circuitBreakerFailureThreshold: 8,
  circuitBreakerTimeoutMs: 45000,
};

router.get('/api/runtime/socket-config', (_req, res) => {
  const forcedProfile = process.env.SOCKET_PROFILE;
  const activeProfile = forcedProfile === 'slow' || forcedProfile === 'default'
    ? forcedProfile
    : 'default';

  res.json({
    version: '1.0.0',
    activeProfile,
    profiles: {
      default: SOCKET_PROFILE_DEFAULT,
      slow: SOCKET_PROFILE_SLOW,
    },
    updatedAt: new Date().toISOString(),
  });
});

module.exports = router;
