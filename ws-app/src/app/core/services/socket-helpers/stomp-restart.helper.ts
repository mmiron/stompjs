import { Client } from '@stomp/stompjs';

export interface RestartSkipContext {
  manualDisconnect: boolean;
  networkOffline: boolean;
  browserOnline: boolean;
}

export interface RestartCallbacks {
  onSuppressedInFlight: () => void;
  onSkippedState: (reason: 'no_client' | 'manual_disconnect' | 'network_offline' | 'browser_offline') => void;
  onDeactivateError: (error: Error) => void;
  onReactivate: () => void;
}

/**
 * Coordinates guarded STOMP restart operations as a single-flight workflow.
 */
export class StompRestartCoordinator {
  private restartInFlight = false;

  /**
   * Executes `deactivate` -> `activate` once at a time, with skip/suppression callbacks.
   */
  public restart(client: Client | undefined, context: RestartSkipContext, callbacks: RestartCallbacks): Promise<void> {
    if (!client) {
      callbacks.onSkippedState('no_client');
      return Promise.resolve();
    }

    if (this.restartInFlight) {
      callbacks.onSuppressedInFlight();
      return Promise.resolve();
    }

    this.restartInFlight = true;

    return client.deactivate()
      .then(() => {
        if (context.manualDisconnect) {
          callbacks.onSkippedState('manual_disconnect');
          return;
        }

        if (context.networkOffline) {
          callbacks.onSkippedState('network_offline');
          return;
        }

        if (!context.browserOnline) {
          callbacks.onSkippedState('browser_offline');
          return;
        }

        callbacks.onReactivate();
      })
      .catch((error) => {
        callbacks.onDeactivateError(error instanceof Error ? error : new Error(String(error)));
      })
      .finally(() => {
        this.restartInFlight = false;
      });
  }
}
