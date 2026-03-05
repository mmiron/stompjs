import {
  NetworkConfig,
  NetworkConfigOverrides,
  NetworkProfile,
} from '../../models/socket-network-config.model';

/**
 * Defines the Browser Network Information API shape used by profile detection.
 */
export interface BrowserConnectionInfo {
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
  saveData?: boolean;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
}

const NETWORK_CONFIG_BOUNDS = {
  baseReconnectDelayMs: { min: 250, max: 120000 },
  maxReconnectDelayMs: { min: 1000, max: 300000 },
  reconnectJitterMs: { min: 0, max: 10000 },
  maxReconnectAttempts: { min: 1, max: 500 },
  healthCheckIntervalMs: { min: 5000, max: 300000 },
  stompHeartbeatMs: { min: 10000, max: 300000 },
  connectionTimeoutMs: { min: 5000, max: 120000 },
  offlineDebounceMs: { min: 0, max: 30000 },
  circuitBreakerFailureThreshold: { min: 1, max: 100 },
  circuitBreakerTimeoutMs: { min: 1000, max: 300000 },
} as const;

/**
 * Returns browser connection metadata from the standard and vendor-prefixed
 * Network Information APIs, if available.
 */
export function getBrowserConnectionInfo(navigatorObj: Navigator = navigator): BrowserConnectionInfo | null {
  const nav = navigatorObj as Navigator & {
    connection?: BrowserConnectionInfo;
    mozConnection?: BrowserConnectionInfo;
    webkitConnection?: BrowserConnectionInfo;
  };

  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

/**
 * Resolves the active network profile (`default` or `slow`) from browser hints.
 */
export function resolveNetworkProfile(connectionInfo: BrowserConnectionInfo | null = getBrowserConnectionInfo()): NetworkProfile {
  if (!connectionInfo) {
    return 'default';
  }

  const effectiveType = connectionInfo.effectiveType;
  const rtt = connectionInfo.rtt;
  const downlink = connectionInfo.downlink;
  const saveData = connectionInfo.saveData === true;

  if (saveData) {
    return 'slow';
  }

  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    return 'slow';
  }

  if ((typeof rtt === 'number' && rtt >= 300) || (typeof downlink === 'number' && downlink <= 1)) {
    return 'slow';
  }

  return 'default';
}

/**
 * Returns baseline config defaults for the selected network profile.
 */
export function resolveNetworkConfig(profile: NetworkProfile = resolveNetworkProfile()): NetworkConfig {
  if (profile === 'slow') {
    return {
      profile,
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
  }

  return {
    profile,
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
}

/**
 * Clamps a numeric runtime config value to its safe min/max interval.
 */
function clampConfigNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Sanitizes runtime profile overrides by filtering invalid values and applying
 * per-field safety bounds.
 */
export function sanitizeNetworkConfigOverrides(overrides: NetworkConfigOverrides): NetworkConfigOverrides {
  const sanitized: NetworkConfigOverrides = {};

  (Object.keys(NETWORK_CONFIG_BOUNDS) as Array<keyof typeof NETWORK_CONFIG_BOUNDS>).forEach((key) => {
    const value = overrides[key as keyof NetworkConfigOverrides];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return;
    }

    const { min, max } = NETWORK_CONFIG_BOUNDS[key];
    sanitized[key as keyof NetworkConfigOverrides] = clampConfigNumber(value, min, max);
  });

  return sanitized;
}

/**
 * Applies sanitized runtime profile overrides on top of baseline profile config.
 */
export function applyProfileOverrides(
  baseConfig: NetworkConfig,
  runtimeProfileOverrides: Partial<Record<NetworkProfile, NetworkConfigOverrides>>,
): NetworkConfig {
  const overrides = runtimeProfileOverrides[baseConfig.profile];
  if (!overrides) {
    return baseConfig;
  }

  const sanitizedOverrides = sanitizeNetworkConfigOverrides(overrides);

  return {
    ...baseConfig,
    ...sanitizedOverrides,
    profile: baseConfig.profile,
  };
}

/**
 * Resolves final effective config in one step: detect profile -> defaults -> runtime overrides.
 */
export function resolveEffectiveNetworkConfig(
  runtimeProfileOverrides: Partial<Record<NetworkProfile, NetworkConfigOverrides>>,
): NetworkConfig {
  const baseConfig = resolveNetworkConfig();
  return applyProfileOverrides(baseConfig, runtimeProfileOverrides);
}
