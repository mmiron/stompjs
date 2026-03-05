import {
  extractRuntimeProfileOverrides,
  fetchRuntimeSocketConfig,
  RuntimeSocketConfigCoordinator,
} from './runtime-config.helper';

describe('runtime-config.helper', () => {
  describe('RuntimeSocketConfigCoordinator', () => {
    it('reuses in-flight promise and clears it after completion', async () => {
      const coordinator = new RuntimeSocketConfigCoordinator();
      let resolveLoader: (() => void) | undefined;
      const loaderPromise = new Promise<void>((resolve) => {
        resolveLoader = resolve;
      });
      const loader = jasmine.createSpy('loader').and.returnValue(loaderPromise);

      const first = coordinator.prefetch(loader);
      const second = coordinator.prefetch(loader);

      expect(first).toBe(second);
      expect(loader).toHaveBeenCalledTimes(1);
      expect(coordinator.getInFlightPromise()).toBe(first);

      resolveLoader?.();
      await first;

      expect(coordinator.getInFlightPromise()).toBeNull();
    });
  });

  describe('fetchRuntimeSocketConfig', () => {
    it('returns payload for successful response', async () => {
      const payload = {
        version: '1.0.0',
        profiles: {
          default: {
            baseReconnectDelayMs: 1000,
          },
        },
      };
      const fetchSpy = jasmine.createSpy('fetch').and.resolveTo({
        ok: true,
        json: async () => payload,
      });

      const result = await fetchRuntimeSocketConfig(fetchSpy as unknown as typeof fetch);

      expect(result).toEqual(payload);
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('throws when response is not ok', async () => {
      const fetchSpy = jasmine.createSpy('fetch').and.resolveTo({
        ok: false,
        status: 503,
      });

      await expectAsync(fetchRuntimeSocketConfig(fetchSpy as unknown as typeof fetch))
        .toBeRejectedWithError('Runtime socket config request failed (503)');
    });
  });

  describe('extractRuntimeProfileOverrides', () => {
    it('returns null when payload has no profiles', () => {
      const result = extractRuntimeProfileOverrides({
        version: '1.0.0',
        profiles: {},
      });

      expect(result).toBeNull();
    });

    it('returns profiles when payload includes overrides', () => {
      const profiles = {
        default: {
          baseReconnectDelayMs: 1000,
        },
        slow: {
          baseReconnectDelayMs: 2000,
        },
      };

      const result = extractRuntimeProfileOverrides({
        version: '1.0.0',
        profiles,
      });

      expect(result).toEqual(profiles);
    });
  });
});
