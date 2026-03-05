/**
 * Tracks coarse tab sleep/awake transitions used by socket wake-recovery logic.
 */
export class TabLifecycleState {
  private tabLikelySleeping = false;

  /**
   * Marks background state and returns true only on first transition.
   */
  public markBackground(): boolean {
    if (this.tabLikelySleeping) {
      return false;
    }

    this.tabLikelySleeping = true;
    return true;
  }

  /**
   * Marks foreground state and returns whether the tab had been sleeping.
   */
  public markForeground(): boolean {
    const wasSleeping = this.tabLikelySleeping;
    this.tabLikelySleeping = false;
    return wasSleeping;
  }
}

/**
 * Enumerates wake-recovery actions evaluated from current socket/browser conditions.
 */
export type WakeRecoveryDecision =
  | 'skip-no-client'
  | 'skip-offline'
  | 'skip-healthy'
  | 'activate-client'
  | 'restart-client'
  | 'no-action';

/**
 * Defines the input facts required to decide post-wake socket recovery behavior.
 */
export interface WakeRecoveryContext {
  hasClient: boolean;
  isOnline: boolean;
  isSocketHealthy: boolean;
  clientActive: boolean;
  clientConnected: boolean;
}

/**
 * Chooses exactly one wake-recovery action using deterministic precedence.
 */
export function evaluateWakeRecovery(context: WakeRecoveryContext): WakeRecoveryDecision {
  if (!context.hasClient) {
    return 'skip-no-client';
  }

  if (!context.isOnline) {
    return 'skip-offline';
  }

  if (context.isSocketHealthy) {
    return 'skip-healthy';
  }

  if (!context.clientActive) {
    return 'activate-client';
  }

  if (!context.clientConnected) {
    return 'restart-client';
  }

  return 'no-action';
}
