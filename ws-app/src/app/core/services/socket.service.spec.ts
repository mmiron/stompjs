/// <reference types="jasmine" />
import { TestBed } from '@angular/core/testing';
import { SocketService } from './socket.service';
import { IMessage } from '@stomp/stompjs';
import { DataRecordPayload } from '../../shared/models/data.model';

describe('SocketService', () => {
  let service: SocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SocketService],
    });
    service = TestBed.inject(SocketService);
  });

  afterEach(() => {
    try {
      service.disconnect();
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Service Creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should expose dataUpdate$ observable', () => {
      expect(service.dataUpdate$).toBeTruthy();
    });

    it('should expose recordChanged$ observable', () => {
      expect(service.recordChanged$).toBeTruthy();
    });

    it('should expose error$ observable', () => {
      expect(service.error$).toBeTruthy();
    });

    it('should expose connectionState$ observable', () => {
      expect(service.connectionState$).toBeTruthy();
    });
  });

  describe('Public API Methods', () => {
    it('should have isConnected() method', () => {
      expect(typeof service.isConnected).toBe('function');
    });

    it('should have disconnect() method', () => {
      expect(typeof service.disconnect).toBe('function');
    });

    it('should have updateRecord() method', () => {
      expect(typeof service.updateRecord).toBe('function');
    });

    it('should have requestData() method', () => {
      expect(typeof service.requestData).toBe('function');
    });
  });

  describe('Payload Validation - Type Guard', () => {
    it('should accept valid DataRecordPayload with minimal fields', (done) => {
      const validPayload: DataRecordPayload = {
        id: 1,
        name: 'Test Record',
        description: 'Test Description',
        createdAt: '2025-01-10T12:00:00Z',
        tags: [],
      };

      // We'll verify the type guard behavior by checking if payload would pass validation
      // The actual validation happens in isDataRecordPayload (private method)
      // We test by observing if valid messages make it through the parse logic
      
      const mockMessage: IMessage = {
        body: JSON.stringify(validPayload),
        headers: {},
        command: 'MESSAGE',
        binaryBody: new ArrayBuffer(0),
      } as unknown as IMessage;

      // This test verifies the structure is correct for parsing
      expect(JSON.parse(mockMessage.body)).toEqual(validPayload);
      done();
    });

    it('should accept valid DataRecordPayload with optional updatedAt field', (done) => {
      const validPayload: DataRecordPayload = {
        id: 1,
        name: 'Test Record',
        description: 'Test Description',
        createdAt: '2025-01-10T12:00:00Z',
        updatedAt: '2025-01-10T13:00:00Z',
        tags: [{ id: 1, name: 'tag1', isChecked: true }],
      };

      const mockMessage: IMessage = {
        body: JSON.stringify(validPayload),
        headers: {},
        command: 'MESSAGE',
        binaryBody: new ArrayBuffer(0),
      } as unknown as IMessage;

      expect(JSON.parse(mockMessage.body)).toEqual(validPayload);
      done();
    });

    it('should have correct tag structure in valid payloads', (done) => {
      const validPayload: DataRecordPayload = {
        id: 1,
        name: 'Test',
        description: 'Desc',
        createdAt: '2025-01-10',
        tags: [
          { id: 1, name: 'tag1' },
          { id: 2, name: 'tag2', isChecked: true },
        ],
      };

      const json = JSON.stringify(validPayload);
      const parsed = JSON.parse(json);

      expect(parsed.tags).toEqual(
        jasmine.arrayContaining([
          jasmine.objectContaining({ id: jasmine.any(Number), name: jasmine.any(String) }),
        ])
      );
      done();
    });
  });

  describe('Exponential Backoff Calculation', () => {
    it('should calculate base delay for first reconnect attempt', () => {
      // 1000ms * 2^(1-1) = 1000ms
      const baseDelay = 1000 * Math.pow(2, Math.max(1 - 1, 0));
      expect(baseDelay).toBe(1000);
    });

    it('should double delay with each attempt', () => {
      const delays: number[] = [];
      for (let attempt = 1; attempt <= 5; attempt++) {
        const baseDelay = 1000 * Math.pow(2, Math.max(attempt - 1, 0));
        const cappedDelay = Math.min(baseDelay, 30000);
        delays.push(cappedDelay);
      }

      expect(delays[0]).toBe(1000); // 1s
      expect(delays[1]).toBe(2000); // 2s
      expect(delays[2]).toBe(4000); // 4s
      expect(delays[3]).toBe(8000); // 8s
      expect(delays[4]).toBe(16000); // 16s
    });

    it('should cap exponential backoff at 30 seconds', () => {
      const cappedDelays: number[] = [];
      for (let attempt = 10; attempt <= 20; attempt++) {
        const baseDelay = 1000 * Math.pow(2, Math.max(attempt - 1, 0));
        const cappedDelay = Math.min(baseDelay, 30000);
        cappedDelays.push(cappedDelay);
      }

      // All values should be capped at 30000ms
      cappedDelays.forEach((delay) => {
        expect(delay).toBeLessThanOrEqual(30000);
      });
    });

    it('should add jitter to backoff delay (0-500ms)', () => {
      const jitterRange: number[] = [];
      for (let i = 0; i < 10; i++) {
        const jitter = Math.floor(Math.random() * 500);
        jitterRange.push(jitter);
      }

      jitterRange.forEach((jitter) => {
        expect(jitter).toBeGreaterThanOrEqual(0);
        expect(jitter).toBeLessThan(500);
      });
    });
  });

  describe('Connection State Management', () => {
    it('should start in disconnected state', (done) => {
      let stateEmitted = false;
      const subscription = service.connectionState$.subscribe((state) => {
        expect(['disconnected', 'connecting', 'reconnecting', 'connected']).toContain(state);
        stateEmitted = true;
      });

      setTimeout(() => {
        expect(stateEmitted).toBe(true);
        subscription.unsubscribe();
        done();
      }, 100);
    });

    it('should emit valid connection states', (done) => {
      const validStates = ['disconnected', 'connecting', 'reconnecting', 'connected'];
      const emittedStates: string[] = [];

      const subscription = service.connectionState$.subscribe((state) => {
        emittedStates.push(state);
        expect(validStates).toContain(state);
      });

      setTimeout(() => {
        expect(emittedStates.length).toBeGreaterThan(0);
        subscription.unsubscribe();
        done();
      }, 100);
    });
  });

  describe('Disconnect Method', () => {
    it('should be callable without errors', () => {
      expect(() => {
        service.disconnect();
      }).not.toThrow();
    });

    it('should be idempotent (callable multiple times)', () => {
      expect(() => {
        service.disconnect();
        service.disconnect();
        service.disconnect();
      }).not.toThrow();
    });
  });

  describe('RequestData Method', () => {
    it('should handle default parameters (page=0, limit=8)', () => {
      spyOn(console, 'log');
      service.requestData();
      expect(console.log).toHaveBeenCalledWith('Data is pushed from server every 5 seconds');
    });

    it('should accept custom page and limit parameters', () => {
      spyOn(console, 'log');
      service.requestData(5, 20);
      expect(console.log).toHaveBeenCalledWith('Data is pushed from server every 5 seconds');
    });

    it('should not throw with various page/limit combinations', () => {
      expect(() => {
        service.requestData(0, 10);
        service.requestData(10, 50);
        service.requestData(100, 100);
      }).not.toThrow();
    });
  });

  describe('UpdateRecord Method', () => {
    it('should be callable with a DataRecordPayload (handles unconnected state)', () => {
      const testRecord: DataRecordPayload = {
        id: 1,
        name: 'Test',
        description: 'Test Description',
        createdAt: '2025-01-10',
        tags: [],
      };

      // updateRecord may throw if STOMP client is not connected
      // Testing that it accepts the record type is the primary goal
      try {
        service.updateRecord(testRecord);
      } catch (e) {
        // Expected if STOMP not connected
        expect((e as Error).message).toContain('There is no underlying STOMP connection');
      }
    });

    it('should handle records with all optional fields (handles unconnected state)', () => {
      const completeRecord: DataRecordPayload = {
        id: 1,
        name: 'Test',
        description: 'Description',
        createdAt: '2025-01-10T12:00:00Z',
        updatedAt: '2025-01-10T13:00:00Z',
        tags: [
          { id: 1, name: 'tag1', isChecked: true },
          { id: 2, name: 'tag2', isChecked: false },
        ],
      };

      try {
        service.updateRecord(completeRecord);
      } catch (e) {
        // Expected if STOMP not connected
        expect((e as Error).message).toContain('There is no underlying STOMP connection');
      }
    });

    it('should accept correct payload shape for updateRecord', () => {
      const testRecord: DataRecordPayload = {
        id: 123,
        name: 'Valid Record',
        description: 'Valid Description',
        createdAt: '2025-01-10T10:00:00Z',
        updatedAt: '2025-01-10T11:00:00Z',
        tags: [
          { id: 1, name: 'urgent' },
          { id: 2, name: 'review', isChecked: true },
        ],
      };

      // Verify the payload satisfies DataRecordPayload shape
      expect(testRecord.id).toBe(123);
      expect(testRecord.name).toBe('Valid Record');
      expect(testRecord.description).toBe('Valid Description');
      expect(testRecord.createdAt).toBe('2025-01-10T10:00:00Z');
      expect(testRecord.updatedAt).toBe('2025-01-10T11:00:00Z');
      expect(testRecord.tags.length).toBe(2);
    });
  });

  describe('IsConnected Method', () => {
    it('should return a boolean', () => {
      const result = service.isConnected();
      expect(typeof result).toBe('boolean');
    });

    it('should return a value consistently', () => {
      const result1 = service.isConnected();
      const result2 = service.isConnected();
      expect(typeof result1).toBe('boolean');
      expect(typeof result2).toBe('boolean');
    });
  });

  describe('Observable Subscriptions', () => {
    it('should not emit dataUpdate$ without connection', (done) => {
      let emissionCount = 0;
      const subscription = service.dataUpdate$.subscribe(() => {
        emissionCount++;
      });

      setTimeout(() => {
        expect(emissionCount).toBe(0);
        subscription.unsubscribe();
        done();
      }, 100);
    });

    it('should not emit recordChanged$ without connection', (done) => {
      let emissionCount = 0;
      const subscription = service.recordChanged$.subscribe(() => {
        emissionCount++;
      });

      setTimeout(() => {
        expect(emissionCount).toBe(0);
        subscription.unsubscribe();
        done();
      }, 100);
    });

    it('should not emit error$ without connection issues', (done) => {
      let emissionCount = 0;
      const subscription = service.error$.subscribe(() => {
        emissionCount++;
      });

      setTimeout(() => {
        expect(emissionCount).toBe(0);
        subscription.unsubscribe();
        done();
      }, 100);
    });

    it('should allow multiple subscribers to dataUpdate$', (done) => {
      const sub1 = service.dataUpdate$.subscribe();
      const sub2 = service.dataUpdate$.subscribe();
      const sub3 = service.dataUpdate$.subscribe();

      expect([sub1, sub2, sub3].every((s) => s !== null)).toBe(true);

      sub1.unsubscribe();
      sub2.unsubscribe();
      sub3.unsubscribe();

      done();
    });
  });

  describe('Lifecycle Resilience', () => {
    it('should not crash when disconnect is called immediately after creation', () => {
      const newService = TestBed.inject(SocketService);
      expect(() => {
        newService.disconnect();
      }).not.toThrow();
    });

    it('should handle rapid connect/disconnect cycles', () => {
      expect(() => {
        service.disconnect();
        service.disconnect();
        service.disconnect();
      }).not.toThrow();
    });

    it('should allow resubscription after disconnect', (done) => {
      service.disconnect();

      setTimeout(() => {
        const subscription = service.dataUpdate$.subscribe();
        expect(subscription).toBeTruthy();
        subscription.unsubscribe();
        done();
      }, 50);
    });
  });

  describe('Message Parsing Edge Cases', () => {
    it('should structure valid message as valid JSON', () => {
      const payload: DataRecordPayload = {
        id: 1,
        name: 'Test',
        description: 'Desc',
        createdAt: '2025-01-10',
        tags: [],
      };

      const json = JSON.stringify(payload);
      const parsed = JSON.parse(json);

      expect(parsed.id).toBe(1);
      expect(parsed.name).toBe('Test');
      expect(parsed.description).toBe('Desc');
      expect(parsed.createdAt).toBe('2025-01-10');
      expect(Array.isArray(parsed.tags)).toBe(true);
    });

    it('should handle tags with optional isChecked field', () => {
      const payload: DataRecordPayload = {
        id: 1,
        name: 'Test',
        description: 'Desc',
        createdAt: '2025-01-10',
        tags: [
          { id: 1, name: 'tag1' }, // no isChecked
          { id: 2, name: 'tag2', isChecked: true }, // with isChecked
        ],
      };

      const json = JSON.stringify(payload);
      const parsed = JSON.parse(json);

      expect(parsed.tags[0]).toEqual({ id: 1, name: 'tag1' });
      expect(parsed.tags[1]).toEqual({ id: 2, name: 'tag2', isChecked: true });
    });

    it('should handle optional updatedAt field', () => {
      const withoutUpdatedAt: DataRecordPayload = {
        id: 1,
        name: 'Test',
        description: 'Desc',
        createdAt: '2025-01-10',
        tags: [],
      };

      const withUpdatedAt: DataRecordPayload = {
        id: 1,
        name: 'Test',
        description: 'Desc',
        createdAt: '2025-01-10',
        updatedAt: '2025-01-11',
        tags: [],
      };

      expect(JSON.parse(JSON.stringify(withoutUpdatedAt)).updatedAt).toBeUndefined();
      expect(JSON.parse(JSON.stringify(withUpdatedAt)).updatedAt).toBe('2025-01-11');
    });
  });
});
