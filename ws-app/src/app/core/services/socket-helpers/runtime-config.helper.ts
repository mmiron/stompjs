import { environment } from '../../../../environments/environment';
import {
  NetworkConfigOverrides,
  NetworkProfile,
  RuntimeSocketConfigResponse,
} from '../../models/socket-network-config.model';

export class RuntimeSocketConfigCoordinator {
  private runtimeConfigLoadPromise: Promise<void> | null = null;

  public getInFlightPromise(): Promise<void> | null {
    return this.runtimeConfigLoadPromise;
  }

  public prefetch(loader: () => Promise<void>): Promise<void> {
    if (this.runtimeConfigLoadPromise) {
      return this.runtimeConfigLoadPromise;
    }

    this.runtimeConfigLoadPromise = loader().finally(() => {
      this.runtimeConfigLoadPromise = null;
    });

    return this.runtimeConfigLoadPromise;
  }
}

export async function fetchRuntimeSocketConfig(
  fetchImpl: typeof fetch,
): Promise<RuntimeSocketConfigResponse> {
  const response = await fetchImpl(`${environment.apiBaseUrl}/api/runtime/socket-config`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Runtime socket config request failed (${response.status})`);
  }

  return (await response.json()) as RuntimeSocketConfigResponse;
}

export function extractRuntimeProfileOverrides(
  payload: RuntimeSocketConfigResponse,
): Partial<Record<NetworkProfile, NetworkConfigOverrides>> | null {
  if (!payload.profiles || Object.keys(payload.profiles).length === 0) {
    return null;
  }

  return payload.profiles;
}
