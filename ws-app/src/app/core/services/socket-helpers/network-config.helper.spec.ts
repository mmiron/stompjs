/// <reference types="jasmine" />
import {
  applyProfileOverrides,
  resolveNetworkConfig,
  resolveNetworkProfile,
  sanitizeNetworkConfigOverrides,
} from './network-config.helper';

describe('network-config.helper', () => {
  describe('resolveNetworkProfile', () => {
    it('should return default when browser connection info is unavailable', () => {
      expect(resolveNetworkProfile(null)).toBe('default');
    });

    it('should return slow when saveData is enabled', () => {
      expect(resolveNetworkProfile({ saveData: true })).toBe('slow');
    });

    it('should return slow for high RTT networks', () => {
      expect(resolveNetworkProfile({ rtt: 350 })).toBe('slow');
    });
  });

  describe('resolveNetworkConfig', () => {
    it('should return expected defaults for default profile', () => {
      const config = resolveNetworkConfig('default');

      expect(config.profile).toBe('default');
      expect(config.stompHeartbeatMs).toBe(30000);
      expect(config.healthCheckIntervalMs).toBe(30000);
      expect(config.maxReconnectAttempts).toBe(20);
    });

    it('should return expected defaults for slow profile', () => {
      const config = resolveNetworkConfig('slow');

      expect(config.profile).toBe('slow');
      expect(config.stompHeartbeatMs).toBe(60000);
      expect(config.healthCheckIntervalMs).toBe(45000);
      expect(config.maxReconnectAttempts).toBe(30);
    });
  });

  describe('overrides and bounds', () => {
    it('should clamp out-of-range runtime overrides to safe bounds', () => {
      const baseConfig = resolveNetworkConfig('default');

      const merged = applyProfileOverrides(baseConfig, {
        default: {
          stompHeartbeatMs: 999999,
          healthCheckIntervalMs: -100,
          maxReconnectAttempts: 0,
        },
      });

      expect(merged.stompHeartbeatMs).toBe(300000);
      expect(merged.healthCheckIntervalMs).toBe(5000);
      expect(merged.maxReconnectAttempts).toBe(1);
    });

    it('should ignore non-numeric override values', () => {
      const sanitized = sanitizeNetworkConfigOverrides({
        stompHeartbeatMs: Number.NaN,
        reconnectJitterMs: Infinity,
      });

      expect(sanitized).toEqual({});
    });
  });
});
