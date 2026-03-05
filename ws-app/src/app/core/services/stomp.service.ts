import { Injectable, OnDestroy, signal } from '@angular/core';
import { Client, IMessage, IFrame } from '@stomp/stompjs';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DataRecordPayload } from '../../shared/models/data.model';
import {
  NetworkConfig,
  NetworkConfigOverrides,
  NetworkProfile,
} from '../models/socket-network-config.model';
import {
  getBrowserConnectionInfo,
  resolveEffectiveNetworkConfig,
} from './socket-helpers/network-config.helper';
import {
  evaluateWakeRecovery,
  TabLifecycleState,
} from './socket-helpers/tab-lifecycle.helper';
import {
  evaluateSocketHealth,
  getSocketHealthSnapshot,
  getWebSocketStateName,
  isSocketHealthy,
} from './socket-helpers/socket-health.helper';
import { StompRestartCoordinator } from './socket-helpers/stomp-restart.helper';
import { StompTopicSubscriptionManager } from './socket-helpers/topic-subscription.helper';
import {
  CircuitBreakerState,
  CircuitBreakerTracker,
} from './socket-helpers/circuit-breaker.helper';
import {
  extractRuntimeProfileOverrides,
  fetchRuntimeSocketConfig,
  RuntimeSocketConfigCoordinator,
} from './socket-helpers/runtime-config.helper';

type SocketConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'reconnecting'
  | 'connected';
export type SocketTopicEvent = 'dataUpdate' | 'recordChanged';
export interface SocketTopicRequest {
  event: SocketTopicEvent;
  topicParam: number;
}

const TELEMETRY_EVENTS = {
  STOMP_DEACTIVATE_ERROR: 'stomp_deactivate_error',
  CIRCUIT_BREAKER_OPEN: 'circuit_breaker_open',
  MAX_RECONNECT_ATTEMPTS: 'max_reconnect_attempts',
  STOMP_ERROR: 'stomp_error',
  WEBSOCKET_ERROR: 'websocket_error',
  BROWSER_OFFLINE: 'browser_offline',
  STOMP_FORCE_CLOSE_OFFLINE: 'stomp_force_close_offline',
  STOMP_OFFLINE_DEACTIVATE_ERROR: 'stomp_offline_deactivate_error',
  BROWSER_ONLINE: 'browser_online',
  HEALTH_CHECK_STOMP_DOWN: 'health_check_stomp_down',
  HEALTH_CHECK_WS_DOWN: 'health_check_ws_down',
  RUNTIME_CONFIG_FETCH_FAILED: 'runtime_config_fetch_failed',
  RUNTIME_CONFIG_LOADED: 'runtime_config_loaded',
  NETWORK_PROFILE_CHANGED: 'network_profile_changed',
  CIRCUIT_BREAKER_OPENED: 'circuit_breaker_opened',
  CIRCUIT_BREAKER_RESET: 'circuit_breaker_reset',
  TAB_BACKGROUND: 'tab_background',
  TAB_FOREGROUND: 'tab_foreground',
  TAB_WAKE_RECOVERY: 'tab_wake_recovery',
  TAB_WAKE_HEALTHY_SKIP_RECONNECT: 'tab_wake_healthy_skip_reconnect',
  RESTART_SUPPRESSED_IN_FLIGHT: 'restart_suppressed_in_flight',
  RESTART_SKIPPED_STATE: 'restart_skipped_state',
} as const;

/**
 * StompService State Diagram (high-level)
 *
 * Connection lifecycle
 * --------------------
 * [disconnected]
 *      |
 *      | connectToEvents()
 *      v
 * [connecting] --(success)----------------------------> [connected]
 *      |                                                  |
 *      | (failure / ws close / ws error)                 | (offline / ws close / health check mismatch)
 *      v                                                  v
 * [reconnecting] --(retry + backoff + success)--------> [connected]
 *      |
 *      | (manual disconnect)
 *      v
 * [disconnected]
 *
 * Browser network events
 * ----------------------
 * offline  -> mark reconnecting, debounce, optional force STOMP deactivate
 * online   -> refresh network profile, reset reconnect attempts, reactivate/restart client
 *
 * Tab lifecycle / sleep signals
 * -----------------------------
 * background (hidden/blur/pagehide/freeze) -> mark tab as potentially sleeping
 * foreground (visible/focus/pageshow/resume) -> run immediate health check and recovery
 *   - if socket is healthy, reconnect is skipped (prevents unnecessary re-sync/merge)
 *   - if unhealthy, reconnect is attempted and downstream reconnected handlers can re-sync
 *
 * Circuit breaker lifecycle
 * -------------------------
 * [closed] --(failures >= threshold)------------------> [open]
 *    ^                                                   |
 *    |                                                   | (timeout elapsed)
 *    |                                                   v
 *    +------------(successful connect)------------ [half-open]
 *                                                     |
 *                                                     | (failure during probe)
 *                                                     v
 *                                                   [open]
 *
 * Notes
 * -----
 * - connectToEvents() is idempotent and lazy: creates/activates client only when needed.
 * - Topic subscriptions are re-established on connect and replaced safely per destination.
 * - Runtime network config can override defaults and is clamped to safe bounds.
 */

@Injectable({
  providedIn: 'root',
})
export class StompService implements OnDestroy {
  private stompClient!: Client;
  private dataUpdateSubject = new Subject<DataRecordPayload>();
  private recordChangedSubject = new Subject<DataRecordPayload>();
  private errorSubject = new Subject<unknown>();
  private reconnectedSubject = new Subject<void>();
  private connectionStateSubject = new BehaviorSubject<SocketConnectionState>(
    'disconnected',
  );
  private topicSubscriptionManager =
    new StompTopicSubscriptionManager<SocketTopicEvent>();

  // Connection state signals for UI
  public online = signal<boolean>(false);
  public isReconnecting = signal<boolean>(false);
  public circuitBreakerState = signal<CircuitBreakerState>('closed');

  // Circuit breaker state
  private circuitBreaker = new CircuitBreakerTracker();

  private reconnectAttempt = 0;
  private manualDisconnect = false;
  private networkOffline = false;
  private restartCoordinator = new StompRestartCoordinator();

  // Resource cleanup tracking
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private offlineDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private offlineHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;
  private visibilityChangeHandler: (() => void) | null = null;
  private focusHandler: (() => void) | null = null;
  private blurHandler: (() => void) | null = null;
  private pageShowHandler: (() => void) | null = null;
  private pageHideHandler: (() => void) | null = null;
  private freezeHandler: (() => void) | null = null;
  private resumeHandler: (() => void) | null = null;
  private connectionChangeHandler: (() => void) | null = null;
  private tabLifecycleState = new TabLifecycleState();
  private runtimeProfileOverrides: Partial<
    Record<NetworkProfile, NetworkConfigOverrides>
  > = {};
  private runtimeConfigCoordinator = new RuntimeSocketConfigCoordinator();

  /**
   * Active runtime network config selected from browser network hints.
   * Falls back to 'default' when hints are unavailable.
   */
  private networkConfig: NetworkConfig = resolveEffectiveNetworkConfig(
    this.runtimeProfileOverrides,
  );

  public dataUpdate$ = this.dataUpdateSubject.asObservable();
  public recordChanged$ = this.recordChangedSubject.asObservable();
  public error$ = this.errorSubject.asObservable();
  public reconnected$ = this.reconnectedSubject.asObservable();
  public connectionState$ = this.connectionStateSubject.asObservable();

  constructor() {
    // Connection is established lazily via connectToEvents().
    this.refreshNetworkConfig();
    this.prefetchRuntimeSocketConfig();
  }

  /**
   * Enables one or more STOMP event streams and ensures the socket is connected.
   * Parent components call this to opt in only to the subscriptions they need.
   */
  public connectToEvents(events: SocketTopicRequest[]): void {
    this.validateTopicRequests(events);
    this.topicSubscriptionManager.requestBindings(events);

    if (!this.stompClient) {
      const inFlightRuntimeConfig =
        this.runtimeConfigCoordinator.getInFlightPromise();
      if (inFlightRuntimeConfig) {
        inFlightRuntimeConfig.finally(() => {
          if (!this.stompClient) {
            this.connect();
          }
        });
      } else {
        this.connect();
      }
      return;
    }

    if (!this.stompClient.active) {
      this.stompClient.activate();
      return;
    }

    if (this.stompClient.connected) {
      this.subscribeToRequestedTopics();
    }
  }

  private validateTopicRequests(events: SocketTopicRequest[]): void {
    if (!Array.isArray(events) || events.length === 0) {
      throw new Error(
        'connectToEvents requires a non-empty array of topic requests',
      );
    }

    events.forEach((request, index) => {
      if (!request || typeof request !== 'object') {
        throw new Error(
          `connectToEvents request at index ${index} must be an object`,
        );
      }

      if (request.event !== 'dataUpdate' && request.event !== 'recordChanged') {
        throw new Error(
          `connectToEvents request at index ${index} has an unsupported event`,
        );
      }

      if (!Number.isInteger(request.topicParam) || request.topicParam < 0) {
        throw new Error(
          `connectToEvents request at index ${index} must include a non-negative integer topicParam`,
        );
      }
    });
  }

  /**
   * Updates public connection signals when transport is considered disconnected.
   */
  private setDisconnectedState(isReconnecting: boolean): void {
    this.online.set(false);
    this.isReconnecting.set(isReconnecting);
  }

  /**
   * Clears the delayed offline timer used to force-close a stuck client after network loss.
   * Called whenever connectivity state changes to avoid duplicate timers.
   */
  private clearOfflineDebounceTimer(): void {
    if (this.offlineDebounceTimer) {
      clearTimeout(this.offlineDebounceTimer);
      this.offlineDebounceTimer = null;
    }
  }

  /**
   * Performs a guarded client restart (`deactivate` -> `activate`) as a single-flight operation.
   * Suppresses overlapping restarts and skips reactivation when state changes to offline or manual disconnect.
   */
  private restartActiveClient(): void {
    this.restartCoordinator.restart(
      this.stompClient,
      {
        manualDisconnect: this.manualDisconnect,
        networkOffline: this.networkOffline,
        browserOnline: navigator.onLine,
      },
      {
        onSuppressedInFlight: () => {
          this.logConnectionEvent(
            TELEMETRY_EVENTS.RESTART_SUPPRESSED_IN_FLIGHT,
            {
              reason: 'restart_already_in_flight',
            },
          );
        },
        onSkippedState: (reason) => {
          this.logConnectionEvent(TELEMETRY_EVENTS.RESTART_SKIPPED_STATE, {
            reason,
          });
        },
        onDeactivateError: (error) => {
          console.error('Error deactivating STOMP:', error);
          this.logConnectionEvent(TELEMETRY_EVENTS.STOMP_DEACTIVATE_ERROR, {
            error: error.message,
          });
        },
        onReactivate: () => {
          console.log('STOMP deactivated, reactivating...');
          this.stompClient.activate();
        },
      },
    );
  }

  /**
   * Initializes the STOMP client, lifecycle handlers, and auto-reconnect behavior.
   */
  private connect(): void {
    this.stompClient = new Client({
      brokerURL: environment.wsUrl,
      reconnectDelay: this.networkConfig.baseReconnectDelayMs,
      // Force-close hanging handshakes so stale pending sockets don't accumulate.
      connectionTimeout: this.networkConfig.connectionTimeoutMs,
      // Enable STOMP heartbeat (keepalive ping/pong) to detect stalled connections
      heartbeatIncoming: this.networkConfig.stompHeartbeatMs,
      heartbeatOutgoing: this.networkConfig.stompHeartbeatMs,
      beforeConnect: async () => this.handleBeforeConnect(),

      // debug: (str) => console.log('[STOMP debug]', str),
    });

    this.stompClient.onConnect = () => this.handleConnectSuccess();
    this.stompClient.onStompError = (frame: IFrame) =>
      this.handleStompError(frame);
    this.stompClient.onWebSocketClose = () => this.handleWebSocketClose();
    this.stompClient.onWebSocketError = (event: Event) =>
      this.handleWebSocketError(event);

    this.stompClient.activate();
    this.startConnectionHealthCheck();
    this.monitorNetworkStatus();
  }

  /**
   * Listens for browser network online/offline events (including dev tools offline mode).
   * Stores handlers for cleanup on destroy.
   */
  private monitorNetworkStatus(): void {
    if (
      this.offlineHandler &&
      this.onlineHandler &&
      this.visibilityChangeHandler
    ) {
      return;
    }

    this.offlineHandler = () => this.handleOffline();
    this.onlineHandler = () => this.handleOnline();
    this.visibilityChangeHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.handleTabBackground('visibilitychange:hidden');
      } else {
        this.handleTabForeground('visibilitychange:visible');
      }
    };
    this.focusHandler = () => this.handleTabForeground('focus');
    this.blurHandler = () => this.handleTabBackground('blur');
    this.pageShowHandler = () => this.handleTabForeground('pageshow');
    this.pageHideHandler = () => this.handleTabBackground('pagehide');
    this.freezeHandler = () => this.handleTabBackground('freeze');
    this.resumeHandler = () => this.handleTabForeground('resume');

    const connectionInfo = getBrowserConnectionInfo();
    if (connectionInfo?.addEventListener) {
      this.connectionChangeHandler = () => {
        this.refreshNetworkConfig();
      };
      connectionInfo.addEventListener('change', this.connectionChangeHandler);
    }

    window.addEventListener('offline', this.offlineHandler);
    window.addEventListener('online', this.onlineHandler);
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    window.addEventListener('focus', this.focusHandler);
    window.addEventListener('blur', this.blurHandler);
    window.addEventListener('pageshow', this.pageShowHandler);
    window.addEventListener('pagehide', this.pageHideHandler);

    // Freeze/resume are Chromium lifecycle events; register defensively.
    (window as unknown as EventTarget).addEventListener(
      'freeze',
      this.freezeHandler,
    );
    (window as unknown as EventTarget).addEventListener(
      'resume',
      this.resumeHandler,
    );
  }

  /**
   * Marks the tab as backgrounded/sleeping once per transition and logs telemetry.
   */
  private handleTabBackground(source: string): void {
    const transitionedToSleeping = this.tabLifecycleState.markBackground();
    if (!transitionedToSleeping) {
      return;
    }

    this.logConnectionEvent(TELEMETRY_EVENTS.TAB_BACKGROUND, { source });
  }

  /**
   * Marks the tab as foreground and triggers wake recovery only when it was previously backgrounded.
   */
  private handleTabForeground(source: string): void {
    const wasSleeping = this.tabLifecycleState.markForeground();
    this.logConnectionEvent(TELEMETRY_EVENTS.TAB_FOREGROUND, {
      source,
      wasSleeping,
    });

    if (wasSleeping) {
      this.handleTabWakeRecovery(source);
    }
  }

  /**
   * Re-evaluates socket health after tab wake and applies exactly one recovery action.
   */
  private handleTabWakeRecovery(source: string): void {
    this.logConnectionEvent(TELEMETRY_EVENTS.TAB_WAKE_RECOVERY, { source });

    this.refreshNetworkConfig();

    if (this.stompClient) {
      this.runConnectionHealthCheck('wake');
    }

    const decision = evaluateWakeRecovery({
      hasClient: !!this.stompClient,
      isOnline: navigator.onLine,
      isSocketHealthy: isSocketHealthy(this.stompClient),
      clientActive: !!this.stompClient?.active,
      clientConnected: !!this.stompClient?.connected,
    });

    switch (decision) {
      case 'skip-no-client':
        return;
      case 'skip-offline':
        this.setDisconnectedState(true);
        return;
      case 'skip-healthy':
        this.logConnectionEvent(
          TELEMETRY_EVENTS.TAB_WAKE_HEALTHY_SKIP_RECONNECT,
          {
            source,
            reason: 'socket_healthy',
          },
        );
        return;
      case 'activate-client':
        this.stompClient.activate();
        return;
      case 'restart-client':
        this.restartActiveClient();
        return;
      default:
        return;
    }
  }

  /**
   * Runs before each STOMP connect attempt and enforces offline/circuit-breaker/retry limits.
   */
  private async handleBeforeConnect(): Promise<void> {
    if (!navigator.onLine || this.networkOffline) {
      this.connectionStateSubject.next('reconnecting');
      this.setDisconnectedState(true);
      throw new Error('Browser offline, skipping STOMP connect attempt');
    }

    const cbState = this.getCircuitBreakerState();
    if (cbState === 'open') {
      console.warn('Circuit breaker is OPEN - preventing connection attempt');
      this.logConnectionEvent(TELEMETRY_EVENTS.CIRCUIT_BREAKER_OPEN, {
        failureCount: this.circuitBreaker.getFailureCount(),
      });
      return;
    }

    if (this.reconnectAttempt >= this.networkConfig.maxReconnectAttempts) {
      console.error(
        `Max reconnection attempts (${this.networkConfig.maxReconnectAttempts}) reached. Giving up.`,
      );
      this.logConnectionEvent(TELEMETRY_EVENTS.MAX_RECONNECT_ATTEMPTS, {
        attempt: this.reconnectAttempt,
      });
      this.setDisconnectedState(false);
      return;
    }

    if (this.reconnectAttempt === 0) {
      this.connectionStateSubject.next('connecting');
      return;
    }

    this.connectionStateSubject.next('reconnecting');
    const reconnectDelay = this.calculateReconnectDelayMs(
      this.reconnectAttempt,
    );
    console.log(
      `Reconnect attempt ${this.reconnectAttempt} (waiting ${reconnectDelay}ms)`,
    );
    await this.delay(reconnectDelay);
  }

  /**
   * Handles successful STOMP connect, resets failure state, emits reconnection events,
   * and re-establishes requested topic subscriptions.
   */
  private handleConnectSuccess(): void {
    const isReconnection = this.reconnectAttempt > 0;
    this.reconnectAttempt = 0;
    this.resetCircuitBreaker();
    this.connectionStateSubject.next('connected');
    this.online.set(true);
    this.isReconnecting.set(false);
    console.log('Connected to STOMP server');

    if (isReconnection) {
      console.log('Reconnected to STOMP server - refreshing data');
      this.reconnectedSubject.next();
    }

    this.subscribeToRequestedTopics();
  }

  /**
   * Handles broker-level STOMP protocol errors and feeds telemetry + circuit breaker.
   */
  private handleStompError(frame: IFrame): void {
    console.error('STOMP error:', frame);
    this.logConnectionEvent(TELEMETRY_EVENTS.STOMP_ERROR, { frame });
    this.recordCircuitBreakerFailure();
    this.errorSubject.next(frame);
  }

  /**
   * Handles WebSocket close transitions, distinguishing manual disconnect from unexpected drops.
   * Unexpected closes increment reconnect/circuit-breaker state and clear topic subscriptions.
   */
  private handleWebSocketClose(): void {
    if (this.manualDisconnect) {
      this.manualDisconnect = false;
      this.connectionStateSubject.next('disconnected');
      this.setDisconnectedState(false);
      this.clearTopicSubscriptions();
      return;
    }

    this.reconnectAttempt += 1;
    this.recordCircuitBreakerFailure();
    this.connectionStateSubject.next('reconnecting');
    this.setDisconnectedState(true);
    this.clearTopicSubscriptions();
    console.log('Disconnected from STOMP server');
  }

  /**
   * Handles low-level WebSocket transport errors and transitions UI/state to reconnecting mode.
   */
  private handleWebSocketError(event: Event): void {
    console.error('WebSocket error:', event);
    this.logConnectionEvent(TELEMETRY_EVENTS.WEBSOCKET_ERROR, {
      message: event.toString(),
    });
    this.recordCircuitBreakerFailure();
    this.setDisconnectedState(true);
    this.errorSubject.next(event);
  }

  /**
   * Handles browser offline events by marking the connection unavailable and scheduling
   * a delayed force-deactivate to clean up hanging sockets while offline.
   */
  private handleOffline(): void {
    console.warn('Browser detected offline (network unavailable)');
    this.logConnectionEvent(TELEMETRY_EVENTS.BROWSER_OFFLINE, {});
    this.networkOffline = true;
    this.setDisconnectedState(true);
    this.clearOfflineDebounceTimer();

    this.offlineDebounceTimer = setTimeout(() => {
      if (navigator.onLine || !this.networkOffline || !this.stompClient) {
        return;
      }

      if (this.stompClient.active) {
        console.warn(
          'Force-closing STOMP client due to confirmed offline state',
        );
        this.logConnectionEvent(TELEMETRY_EVENTS.STOMP_FORCE_CLOSE_OFFLINE, {});
        this.clearTopicSubscriptions();
        this.stompClient.deactivate().catch((err) => {
          console.error('Error while deactivating STOMP during offline:', err);
          this.logConnectionEvent(
            TELEMETRY_EVENTS.STOMP_OFFLINE_DEACTIVATE_ERROR,
            { error: err.message },
          );
        });
      }
    }, this.networkConfig.offlineDebounceMs);
  }

  /**
   * Handles browser online events by refreshing profile config and safely reactivating
   * the client (or restarting if active but disconnected).
   */
  private handleOnline(): void {
    console.log(
      'Browser detected online (network available) - triggering STOMP reconnection',
    );
    this.logConnectionEvent(TELEMETRY_EVENTS.BROWSER_ONLINE, {});
    this.refreshNetworkConfig();
    this.networkOffline = false;
    this.clearOfflineDebounceTimer();
    this.isReconnecting.set(true);
    this.reconnectAttempt = 0;

    if (!this.stompClient) {
      return;
    }

    if (!this.stompClient.active) {
      this.stompClient.activate();
      return;
    }

    if (!this.stompClient.connected) {
      this.restartActiveClient();
    }
  }

  /**
   * Starts periodic connection health checks and replaces any existing timer.
   */
  private startConnectionHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.healthCheckInterval = setInterval(() => {
      this.runConnectionHealthCheck('interval');
    }, this.networkConfig.healthCheckIntervalMs);
  }

  /**
   * Runs an immediate consistency check between UI state, STOMP connection state,
   * and raw WebSocket readyState.
   */
  private runConnectionHealthCheck(source: 'interval' | 'wake'): void {
    const snapshot = getSocketHealthSnapshot(this.stompClient, this.online());
    const evaluation = evaluateSocketHealth(snapshot);

    if (evaluation.hasStateMismatch) {
      console.debug(
        `Health check (${source}) mismatch - STOMP: ${snapshot.isStompConnected}, WS State: ${getWebSocketStateName(snapshot.webSocketState)}, UI: ${snapshot.uiThinkIsConnected}`,
      );
    }

    if (evaluation.stompDownWhileUiConnected) {
      console.warn(
        `Connection health check (${source}): UI thought we were connected but STOMP is down`,
      );
      this.logConnectionEvent(TELEMETRY_EVENTS.HEALTH_CHECK_STOMP_DOWN, {
        source,
      });
      this.setDisconnectedState(true);
    }

    if (evaluation.webSocketNotOpenWhileUiConnected) {
      console.warn(
        `Connection health check (${source}): WebSocket is not OPEN (state=${snapshot.webSocketState})`,
      );
      this.logConnectionEvent(TELEMETRY_EVENTS.HEALTH_CHECK_WS_DOWN, {
        state: snapshot.webSocketState,
        source,
      });
      this.setDisconnectedState(true);
    }
  }

  /**
   * Starts a single runtime-config fetch request and shares it across callers.
   */
  private prefetchRuntimeSocketConfig(): Promise<void> {
    return this.runtimeConfigCoordinator.prefetch(() =>
      this.fetchRuntimeSocketConfig().catch((error) => {
        this.logConnectionEvent(TELEMETRY_EVENTS.RUNTIME_CONFIG_FETCH_FAILED, {
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      }),
    );
  }

  /**
   * Fetches runtime socket config overrides from the backend and applies them.
   */
  private async fetchRuntimeSocketConfig(): Promise<void> {
    const payload = await fetchRuntimeSocketConfig(fetch);
    const profileOverrides = extractRuntimeProfileOverrides(payload);
    if (!profileOverrides) {
      return;
    }

    this.runtimeProfileOverrides = profileOverrides;
    this.refreshNetworkConfig();

    this.logConnectionEvent(TELEMETRY_EVENTS.RUNTIME_CONFIG_LOADED, {
      version: payload.version ?? 'unknown',
      activeProfile: payload.activeProfile ?? 'dynamic',
      loadedProfiles: Object.keys(profileOverrides),
    });
  }

  /**
   * Recomputes and stores the active network config from detected profile + runtime overrides.
   */
  private refreshNetworkConfig(): void {
    const previousProfile = this.networkConfig.profile;
    const nextConfig = resolveEffectiveNetworkConfig(
      this.runtimeProfileOverrides,
    );
    const profileChanged = nextConfig.profile !== previousProfile;
    this.networkConfig = nextConfig;

    if (profileChanged) {
      console.info(
        `Network profile changed: ${previousProfile} -> ${nextConfig.profile} ` +
          `(heartbeat=${nextConfig.stompHeartbeatMs}ms, healthCheck=${nextConfig.healthCheckIntervalMs}ms, ` +
          `maxAttempts=${nextConfig.maxReconnectAttempts})`,
      );

      this.logConnectionEvent(TELEMETRY_EVENTS.NETWORK_PROFILE_CHANGED, {
        previousProfile,
        profile: nextConfig.profile,
        heartbeatMs: nextConfig.stompHeartbeatMs,
        healthCheckMs: nextConfig.healthCheckIntervalMs,
        maxReconnectAttempts: nextConfig.maxReconnectAttempts,
        baseReconnectDelayMs: nextConfig.baseReconnectDelayMs,
      });
    }
  }

  /**
   * Logs connection events for monitoring and debugging.
   * In production, replace console logging with a telemetry service.
   */
  private logConnectionEvent(
    event: string,
    details: Record<string, any>,
  ): void {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      event,
      details,
      userAgent: navigator.userAgent,
    };

    // TODO: In production, send to monitoring service
    // Example: this.telemetryService.log('socket_event', logData);
    console.debug('[TELEMETRY]', logData);
  }

  /**
   * Implements circuit-breaker transitions to prevent reconnect thrashing.
   *
   * States:
   * - `closed`: normal operation; attempts are allowed.
   * - `open`: failures exceeded threshold; attempts are blocked.
   * - `half-open`: cooldown elapsed; a probe attempt is allowed.
   *
   * Transition flow:
   * 1) `closed` -> `open` when failures reach threshold.
   * 2) `open` -> `half-open` when cooldown timeout elapses.
   * 3) `half-open` -> `closed` on successful connect.
   * 4) `half-open` -> `open` on failure during probe.
   */

  /**
   * Returns the current circuit-breaker state and performs `open` -> `half-open`
   * transition when cooldown has elapsed.
   */
  private getCircuitBreakerState(): CircuitBreakerState {
    const result = this.circuitBreaker.getState({
      failureThreshold: this.networkConfig.circuitBreakerFailureThreshold,
      timeoutMs: this.networkConfig.circuitBreakerTimeoutMs,
    });

    if (result.transitionedToHalfOpen) {
      console.log(
        'Circuit breaker transitioning to HALF-OPEN for recovery attempt',
      );
    }

    this.circuitBreakerState.set(result.state);
    return result.state;
  }

  /**
   * Records a connection failure and opens the circuit breaker when thresholds require it.
   */
  private recordCircuitBreakerFailure(): void {
    const result = this.circuitBreaker.recordFailure({
      failureThreshold: this.networkConfig.circuitBreakerFailureThreshold,
      timeoutMs: this.networkConfig.circuitBreakerTimeoutMs,
    });

    this.circuitBreakerState.set(result.state);

    if (result.opened) {
      console.warn(
        `Circuit breaker OPENED after ${result.failureCount} failures`,
      );
      this.logConnectionEvent(TELEMETRY_EVENTS.CIRCUIT_BREAKER_OPENED, {
        failureCount: result.failureCount,
      });
    }
  }

  /**
   * Resets circuit-breaker state after a successful connection.
   */
  private resetCircuitBreaker(): void {
    const result = this.circuitBreaker.reset();
    this.circuitBreakerState.set(result.state);

    if (result.wasReset) {
      console.log(
        'Circuit breaker RESET to closed state after successful connection',
      );
      this.logConnectionEvent(TELEMETRY_EVENTS.CIRCUIT_BREAKER_RESET, {});
    }
  }

  public requestData(page: number = 0, limit: number = 8): void {
    // No longer needed - data is pushed from server automatically
    console.log('Data is pushed from server every 5 seconds');
  }

  /**
   * Publishes a record update to the backend STOMP endpoint.
   */
  public updateRecord(record: DataRecordPayload): void {
    if (!this.stompClient?.connected) {
      throw new Error('There is no underlying STOMP connection');
    }

    // If your backend supports updating records via STOMP, send to an appropriate endpoint
    this.stompClient.publish({
      destination: '/app/record',
      body: JSON.stringify(record),
    });
  }

  /**
   * Parses and validates a STOMP message body into a typed data-record payload.
   */
  private parseRecordMessage(message: IMessage): DataRecordPayload | null {
    try {
      const payload: unknown = JSON.parse(message.body);
      if (this.isDataRecordPayload(payload)) {
        return payload;
      }

      console.warn('Ignoring STOMP payload with unexpected shape:', payload);
      return null;
    } catch (error) {
      console.error('Failed to parse STOMP message body:', error);
      this.errorSubject.next(error);
      return null;
    }
  }

  /**
   * Runtime type guard for inbound data-record payloads.
   */
  private isDataRecordPayload(payload: unknown): payload is DataRecordPayload {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const candidate = payload as Partial<DataRecordPayload>;
    const hasValidTags =
      Array.isArray(candidate.tags) &&
      candidate.tags.every(
        (tag) =>
          tag && typeof tag.id === 'number' && typeof tag.name === 'string',
      );

    return (
      typeof candidate.id === 'number' &&
      typeof candidate.name === 'string' &&
      typeof candidate.description === 'string' &&
      typeof candidate.createdAt === 'string' &&
      (candidate.updatedAt === undefined ||
        typeof candidate.updatedAt === 'string') &&
      hasValidTags
    );
  }

  /**
   * Gracefully disconnects the active STOMP client, clears subscriptions,
   * and cleans up all event listeners and intervals.
   */
  public disconnect(): void {
    if (this.stompClient && this.stompClient.active) {
      this.manualDisconnect = true;
      this.clearTopicSubscriptions();
      this.stompClient.deactivate();
      this.connectionStateSubject.next('disconnected');
    }
  }

  /**
   * Angular lifecycle hook: cleanup on component/service destroy.
   * Essential for preventing memory leaks in production.
   */
  ngOnDestroy(): void {
    console.log('StompService destroying - cleaning up resources');

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.clearOfflineDebounceTimer();

    // Remove event listeners
    if (this.offlineHandler) {
      window.removeEventListener('offline', this.offlineHandler);
      this.offlineHandler = null;
    }
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }
    if (this.visibilityChangeHandler) {
      document.removeEventListener(
        'visibilitychange',
        this.visibilityChangeHandler,
      );
      this.visibilityChangeHandler = null;
    }
    if (this.focusHandler) {
      window.removeEventListener('focus', this.focusHandler);
      this.focusHandler = null;
    }
    if (this.blurHandler) {
      window.removeEventListener('blur', this.blurHandler);
      this.blurHandler = null;
    }
    if (this.pageShowHandler) {
      window.removeEventListener('pageshow', this.pageShowHandler);
      this.pageShowHandler = null;
    }
    if (this.pageHideHandler) {
      window.removeEventListener('pagehide', this.pageHideHandler);
      this.pageHideHandler = null;
    }
    if (this.freezeHandler) {
      (window as unknown as EventTarget).removeEventListener(
        'freeze',
        this.freezeHandler,
      );
      this.freezeHandler = null;
    }
    if (this.resumeHandler) {
      (window as unknown as EventTarget).removeEventListener(
        'resume',
        this.resumeHandler,
      );
      this.resumeHandler = null;
    }

    const connectionInfo = getBrowserConnectionInfo();
    if (connectionInfo?.removeEventListener && this.connectionChangeHandler) {
      connectionInfo.removeEventListener(
        'change',
        this.connectionChangeHandler,
      );
      this.connectionChangeHandler = null;
    }

    // Disconnect and cleanup STOMP
    this.disconnect();

    // Close all subjects
    this.dataUpdateSubject.complete();
    this.recordChangedSubject.complete();
    this.errorSubject.complete();
    this.reconnectedSubject.complete();
    this.connectionStateSubject.complete();
  }

  /**
   * Returns whether the STOMP client currently has an active connection.
   */
  public isConnected(): boolean {
    return !!this.stompClient?.connected;
  }

  /**
   * Unsubscribes all tracked topic subscriptions and resets the subscription map.
   */
  private clearTopicSubscriptions(): void {
    this.topicSubscriptionManager.clearSubscriptions();
  }

  /**
   * Subscribes only to topics requested by parent components via connectToEvents().
   */
  private subscribeToRequestedTopics(): void {
    const bindings = this.topicSubscriptionManager
      .getRequestedBindings()
      .map((request) => this.buildTopicBinding(request));

    this.topicSubscriptionManager.syncSubscriptions(this.stompClient, bindings);
  }

  private buildTopicBinding(
    request: SocketTopicRequest,
  ): Required<Pick<SocketTopicRequest, 'event'>> & {
    destination: string;
    topicParam: number;
    handler: (message: IMessage) => void;
  } {
    if (request.event === 'dataUpdate') {
      return {
        event: request.event,
        topicParam: request.topicParam,
        destination: this.withTopicParam('/topic/data', request.topicParam),
        handler: (message: IMessage) => {
          const record = this.parseRecordMessage(message);
          if (record) {
            this.dataUpdateSubject.next(record);
          }
        },
      };
    }

    return {
      event: request.event,
      topicParam: request.topicParam,
      destination: this.withTopicParam('/topic/recordChanged', request.topicParam),
      handler: (message: IMessage) => {
        const record = this.parseRecordMessage(message);
        if (record) {
          this.recordChangedSubject.next(record);
        }
      },
    };
  }

  private withTopicParam(destination: string, topicParam?: number): string {
    if (topicParam === undefined || topicParam === null) {
      return destination;
    }

    return `${destination}/${topicParam}`;
  }

  /**
   * Calculates a bounded exponential backoff delay with jitter for reconnect attempts.
   */
  private calculateReconnectDelayMs(attempt: number): number {
    const exponentialBackoff =
      this.networkConfig.baseReconnectDelayMs *
      Math.pow(2, Math.max(attempt - 1, 0));
    const boundedDelay = Math.min(
      exponentialBackoff,
      this.networkConfig.maxReconnectDelayMs,
    );
    const jitter = Math.floor(
      Math.random() * this.networkConfig.reconnectJitterMs,
    );
    return boundedDelay + jitter;
  }

  /**
   * Async timer helper used to pause before reconnect attempts.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
