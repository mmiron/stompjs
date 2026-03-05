import { Client } from '@stomp/stompjs';

import {
  evaluateSocketHealth,
  getSocketHealthSnapshot,
  getWebSocketStateName,
  isSocketHealthy,
} from './socket-health.helper';

describe('socket-health.helper', () => {
  function createClient(partial: Partial<Client>): Client {
    return partial as Client;
  }

  it('builds snapshot from client and ui state', () => {
    const client = createClient({
      connected: true,
      webSocket: { readyState: 1 } as WebSocket,
    });

    const snapshot = getSocketHealthSnapshot(client, true);

    expect(snapshot).toEqual({
      isStompConnected: true,
      webSocketState: 1,
      isWebSocketOpen: true,
      uiThinkIsConnected: true,
    });
  });

  it('evaluates mismatch and failure conditions correctly', () => {
    const evaluation = evaluateSocketHealth({
      isStompConnected: false,
      webSocketState: 3,
      isWebSocketOpen: false,
      uiThinkIsConnected: true,
    });

    expect(evaluation.hasStateMismatch).toBeTrue();
    expect(evaluation.stompDownWhileUiConnected).toBeTrue();
    expect(evaluation.webSocketNotOpenWhileUiConnected).toBeTrue();
  });

  it('reports healthy only when stomp connected and websocket open', () => {
    const healthyClient = createClient({
      connected: true,
      webSocket: { readyState: 1 } as WebSocket,
    });
    const unhealthyClient = createClient({
      connected: true,
      webSocket: { readyState: 3 } as WebSocket,
    });

    expect(isSocketHealthy(healthyClient)).toBeTrue();
    expect(isSocketHealthy(unhealthyClient)).toBeFalse();
    expect(isSocketHealthy(undefined)).toBeFalse();
  });

  it('maps websocket state names with unknown fallback', () => {
    expect(getWebSocketStateName(0)).toBe('CONNECTING');
    expect(getWebSocketStateName(1)).toBe('OPEN');
    expect(getWebSocketStateName(2)).toBe('CLOSING');
    expect(getWebSocketStateName(3)).toBe('CLOSED');
    expect(getWebSocketStateName(undefined)).toBe('UNKNOWN');
    expect(getWebSocketStateName(99)).toBe('UNKNOWN');
  });
});
