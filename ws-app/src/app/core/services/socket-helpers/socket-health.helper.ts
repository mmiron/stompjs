import { Client } from '@stomp/stompjs';

export interface SocketHealthSnapshot {
  isStompConnected: boolean;
  webSocketState: number | undefined;
  isWebSocketOpen: boolean;
  uiThinkIsConnected: boolean;
}

export interface SocketHealthEvaluation {
  hasStateMismatch: boolean;
  stompDownWhileUiConnected: boolean;
  webSocketNotOpenWhileUiConnected: boolean;
}

/**
 * Builds a connection health snapshot from STOMP client state and UI connection state.
 */
export function getSocketHealthSnapshot(client: Client | undefined, uiThinkIsConnected: boolean): SocketHealthSnapshot {
  const isStompConnected = client?.connected ?? false;
  const webSocketState = (client?.webSocket as any)?.readyState as number | undefined;
  const isWebSocketOpen = webSocketState === 1;

  return {
    isStompConnected,
    webSocketState,
    isWebSocketOpen,
    uiThinkIsConnected,
  };
}

/**
 * Evaluates actionable health conditions from a socket health snapshot.
 */
export function evaluateSocketHealth(snapshot: SocketHealthSnapshot): SocketHealthEvaluation {
  return {
    hasStateMismatch: snapshot.uiThinkIsConnected !== snapshot.isStompConnected,
    stompDownWhileUiConnected: snapshot.uiThinkIsConnected && !snapshot.isStompConnected,
    webSocketNotOpenWhileUiConnected: snapshot.uiThinkIsConnected
      && !snapshot.isWebSocketOpen
      && snapshot.webSocketState !== undefined,
  };
}

/**
 * Returns true when STOMP and underlying WebSocket are both healthy.
 */
export function isSocketHealthy(client: Client | undefined): boolean {
  const snapshot = getSocketHealthSnapshot(client, false);
  return snapshot.isStompConnected && snapshot.isWebSocketOpen;
}

/**
 * Converts numeric WebSocket readyState values into readable labels.
 */
export function getWebSocketStateName(state: number | undefined): string {
  switch (state) {
    case 0: return 'CONNECTING';
    case 1: return 'OPEN';
    case 2: return 'CLOSING';
    case 3: return 'CLOSED';
    default: return 'UNKNOWN';
  }
}
