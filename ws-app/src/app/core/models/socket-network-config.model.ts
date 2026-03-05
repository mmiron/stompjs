export type NetworkProfile = 'default' | 'slow';

export interface NetworkConfig {
  profile: NetworkProfile;
  baseReconnectDelayMs: number;
  maxReconnectDelayMs: number;
  reconnectJitterMs: number;
  maxReconnectAttempts: number;
  healthCheckIntervalMs: number;
  stompHeartbeatMs: number;
  connectionTimeoutMs: number;
  offlineDebounceMs: number;
  circuitBreakerFailureThreshold: number;
  circuitBreakerTimeoutMs: number;
}

export type NetworkConfigOverrides = Partial<Omit<NetworkConfig, 'profile'>>;

export interface RuntimeSocketConfigResponse {
  version?: string;
  activeProfile?: NetworkProfile;
  profiles?: Partial<Record<NetworkProfile, NetworkConfigOverrides>>;
}
