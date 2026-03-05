import { Injectable } from '@angular/core';
import { Client, IMessage, IFrame, StompSubscription } from '@stomp/stompjs';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DataRecordPayload } from '../../shared/models/data.model';

type SocketConnectionState = 'disconnected' | 'connecting' | 'reconnecting' | 'connected';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private stompClient!: Client;
  private dataUpdateSubject = new Subject<DataRecordPayload>();
  private recordChangedSubject = new Subject<DataRecordPayload>();
  private errorSubject = new Subject<unknown>();
  private connectionStateSubject = new BehaviorSubject<SocketConnectionState>('disconnected');
  private topicSubscriptions = new Map<string, StompSubscription>();

  private reconnectAttempt = 0;
  private manualDisconnect = false;

  private readonly baseReconnectDelayMs = 1000;
  private readonly maxReconnectDelayMs = 30000;
  private readonly reconnectJitterMs = 500;

  public dataUpdate$ = this.dataUpdateSubject.asObservable();
  public recordChanged$ = this.recordChangedSubject.asObservable();
  public error$ = this.errorSubject.asObservable();
  public connectionState$ = this.connectionStateSubject.asObservable();

  constructor() {
    this.connect();
  }

  /**
   * Initializes the STOMP client, lifecycle handlers, and auto-reconnect behavior.
   */
  private connect(): void {
    this.stompClient = new Client({
      brokerURL: environment.wsUrl,
      reconnectDelay: this.baseReconnectDelayMs,
      beforeConnect: async () => {
        if (this.reconnectAttempt === 0) {
          this.connectionStateSubject.next('connecting');
          return;
        }

        this.connectionStateSubject.next('reconnecting');
        const reconnectDelay = this.calculateReconnectDelayMs(this.reconnectAttempt);
        await this.delay(reconnectDelay);
      },
      
      // debug: (str) => console.log('[STOMP debug]', str),
    });

    this.stompClient.onConnect = () => {
      this.reconnectAttempt = 0;
      this.connectionStateSubject.next('connected');
      console.log('Connected to STOMP server');
      this.ensureTopicSubscription('/topic/data', (message: IMessage) => {
        const record = this.parseRecordMessage(message);
        if (record) {
          this.dataUpdateSubject.next(record);
        }
      });

      this.ensureTopicSubscription('/topic/recordChanged', (message: IMessage) => {
        const record = this.parseRecordMessage(message);
        if (record) {
          this.recordChangedSubject.next(record);
        }
      });
    };

    this.stompClient.onStompError = (frame: IFrame) => {
      console.error('STOMP error:', frame);
      this.errorSubject.next(frame);
    };

    this.stompClient.onWebSocketClose = () => {
      if (this.manualDisconnect) {
        this.manualDisconnect = false;
        this.connectionStateSubject.next('disconnected');
        this.clearTopicSubscriptions();
        return;
      }

      this.reconnectAttempt += 1;
      this.connectionStateSubject.next('reconnecting');
      this.clearTopicSubscriptions();
      console.log('Disconnected from STOMP server');
    };

    this.stompClient.onWebSocketError = (event: Event) => {
      this.errorSubject.next(event);
    };

    this.stompClient.activate();
  }

  public requestData(page: number = 0, limit: number = 8): void {
    // No longer needed - data is pushed from server automatically
    console.log('Data is pushed from server every 5 seconds');
  }

  /**
   * Publishes a record update to the backend STOMP endpoint.
   */
  public updateRecord(record: DataRecordPayload): void {
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
    const hasValidTags = Array.isArray(candidate.tags)
      && candidate.tags.every((tag) => tag && typeof tag.id === 'number' && typeof tag.name === 'string');

    return typeof candidate.id === 'number'
      && typeof candidate.name === 'string'
      && typeof candidate.description === 'string'
      && typeof candidate.createdAt === 'string'
      && (candidate.updatedAt === undefined || typeof candidate.updatedAt === 'string')
      && hasValidTags;
  }

  /**
   * Gracefully disconnects the active STOMP client and clears subscriptions.
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
   * Returns whether the STOMP client currently has an active connection.
   */
  public isConnected(): boolean {
    return this.stompClient?.connected;
  }

  /**
   * Ensures a single active subscription per destination and replaces stale handlers.
   */
  private ensureTopicSubscription(destination: string, handler: (message: IMessage) => void): void {
    const existingSubscription = this.topicSubscriptions.get(destination);
    if (existingSubscription) {
      existingSubscription.unsubscribe();
    }

    const subscription = this.stompClient.subscribe(destination, handler);
    this.topicSubscriptions.set(destination, subscription);
  }

  /**
   * Unsubscribes all tracked topic subscriptions and resets the subscription map.
   */
  private clearTopicSubscriptions(): void {
    this.topicSubscriptions.forEach((subscription) => subscription.unsubscribe());
    this.topicSubscriptions.clear();
  }

  /**
   * Calculates a bounded exponential backoff delay with jitter for reconnect attempts.
   */
  private calculateReconnectDelayMs(attempt: number): number {
    const exponentialBackoff = this.baseReconnectDelayMs * Math.pow(2, Math.max(attempt - 1, 0));
    const boundedDelay = Math.min(exponentialBackoff, this.maxReconnectDelayMs);
    const jitter = Math.floor(Math.random() * this.reconnectJitterMs);
    return boundedDelay + jitter;
  }

  /**
   * Async timer helper used to pause before reconnect attempts.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
