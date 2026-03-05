import { Injectable } from '@angular/core';
import { StompService } from './stomp.service';
import { DataRecordPayload, Tag } from '../../shared/models/data.model';

/**
 * Load test configuration
 */
export interface LoadTestConfig {
  name: string;
  messagesPerSecond: number;
  durationSeconds: number;
  messageSize: 'small' | 'medium' | 'large';
  pattern: 'constant' | 'burst' | 'spike' | 'ramp';
}

/**
 * Load test metrics
 */
export interface LoadTestMetrics {
  timestamp: string;
  totalMessages: number;
  successfulMessages: number;
  failedMessages: number;
  averageLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  messagesPerSecond: number;
  duration: number;
  memoryUsedMB: number;
  cpuPercentage: number;
}

/**
 * Service for load testing high-frequency STOMP message handling.
 * Simulates realistic message patterns and measures performance impact.
 */
@Injectable({
  providedIn: 'root',
})
export class LoadTestService {
  private isRunning = false;
  private testStartTime = 0;
  private messageCounter = 0;
  private messageLatencies: number[] = [];
  private initialMemory = 0;

  constructor(private stompService: StompService) {}

  /**
   * Generates fake STOMP messages at configured rate
   */
  async runLoadTest(config: LoadTestConfig): Promise<LoadTestMetrics> {
    console.log(`Starting load test: ${config.name}`);
    console.log(`  Rate: ${config.messagesPerSecond} msg/sec`);
    console.log(`  Duration: ${config.durationSeconds}s`);
    console.log(`  Pattern: ${config.pattern}`);

    this.isRunning = true;
    this.messageCounter = 0;
    this.messageLatencies = [];
    this.testStartTime = performance.now();
    this.initialMemory = this.getMemoryMB();

    const endTime = this.testStartTime + config.durationSeconds * 1000;
    const messageInterval = 1000 / config.messagesPerSecond;
    let nextMessageTime = this.testStartTime;

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const now = performance.now();

        if (now >= endTime) {
          clearInterval(interval);
          this.isRunning = false;
          const metrics = this.generateMetrics(config);
          console.log('Load test completed:', metrics);
          resolve(metrics);
          return;
        }

        // Generate messages based on pattern
        const messagesToSend = this.getMessagesToSend(config.pattern, now, endTime, config);

        for (let i = 0; i < messagesToSend; i++) {
          if (now >= endTime) break;
          this.sendFakeMessage(config);
        }

        nextMessageTime = now + messageInterval;
      }, Math.max(10, messageInterval / 10)); // Sample at 10x message rate or 10ms min
    });
  }

  /**
   * Calculates messages to send based on pattern
   */
  private getMessagesToSend(
    pattern: string,
    currentTime: number,
    endTime: number,
    config: LoadTestConfig
  ): number {
    const elapsed = currentTime - this.testStartTime;
    const progress = elapsed / (config.durationSeconds * 1000);

    switch (pattern) {
      case 'constant':
        return 1; // 1 message per interval
      case 'burst':
        // Every 2 seconds, send 10x burst
        return Math.floor(elapsed / 2000) % 2 === 0 ? 10 : 0;
      case 'spike':
        // Gradual increase then sudden drop
        return Math.floor(config.messagesPerSecond * Math.sin(progress * Math.PI));
      case 'ramp':
        // Gradually increase load
        return Math.ceil(config.messagesPerSecond * progress);
      default:
        return 1;
    }
  }

  /**
   * Sends a simulated fake STOMP message
   */
  private sendFakeMessage(config: LoadTestConfig): void {
    const startTime = performance.now();
    this.messageCounter++;

    try {
      const payload = this.generateFakePayload(this.messageCounter, config.messageSize);
      
      // Simulate message processing delay (0-5ms depending on size)
      const processingDelay = config.messageSize === 'small' ? 0.5 : config.messageSize === 'medium' ? 2 : 5;
      setTimeout(() => {
        const latency = performance.now() - startTime;
        this.messageLatencies.push(latency);
      }, processingDelay);

      // Emit through socket service (would normally come from STOMP)
      // For testing, we directly emit to the subject
      (this.stompService as any).dataUpdateSubject.next(payload);
    } catch (error) {
      console.error('Error sending fake message:', error);
    }
  }

  /**
   * Generates a fake data record payload
   */
  private generateFakePayload(index: number, size: 'small' | 'medium' | 'large'): DataRecordPayload {
    const baseName = `Record-${index}`;
    const baseDesc = `Test record generated during load test #${index}`;
    const tags: Tag[] = [];

    // Add tags based on size
    if (size === 'medium' || size === 'large') {
      for (let i = 0; i < (size === 'large' ? 10 : 3); i++) {
        tags.push({ id: i, name: `tag-${i}` });
      }
    }

    // Pad description for larger sizes
    let description = baseDesc;
    if (size === 'large') {
      description += ' ' + 'x'.repeat(500); // Add padding
    }

    return {
      id: Math.floor(Math.random() * 10000),
      name: baseName,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags,
    };
  }

  /**
   * Generates performance metrics from load test
   */
  private generateMetrics(config: LoadTestConfig): LoadTestMetrics {
    const testDuration = performance.now() - this.testStartTime;
    const successfulMessages = this.messageLatencies.length;
    const failedMessages = this.messageCounter - successfulMessages;

    const latencies = this.messageLatencies.sort((a, b) => a - b);
    const averageLatency = latencies.length > 0 
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    return {
      timestamp: new Date().toISOString(),
      totalMessages: this.messageCounter,
      successfulMessages,
      failedMessages,
      averageLatencyMs: Math.round(averageLatency * 100) / 100,
      minLatencyMs: latencies[0] || 0,
      maxLatencyMs: latencies[latencies.length - 1] || 0,
      messagesPerSecond: Math.round((this.messageCounter / testDuration) * 1000 * 100) / 100,
      duration: Math.round(testDuration),
      memoryUsedMB: Math.round((this.getMemoryMB() - this.initialMemory) * 100) / 100,
      cpuPercentage: this.estimateCpuUsage(),
    };
  }

  /**
   * Gets current memory usage in MB (approximate)
   */
  private getMemoryMB(): number {
    const perfMemory = (performance as any).memory;
    if (perfMemory) {
      return perfMemory.usedJSHeapSize / 1024 / 1024;
    }
    return 0;
  }

  /**
   * Rough estimate of CPU usage (simplified)
   */
  private estimateCpuUsage(): number {
    // This is a very rough estimate based on message rate
    const duration = (performance.now() - this.testStartTime) / 1000;
    const messageRate = this.messageCounter / duration;
    // Assume rough correlation: 1000 msg/sec ≈ 50% CPU
    return Math.min(100, Math.round((messageRate / 1000) * 50));
  }

  /**
   * Predefined test scenarios
   */
  static readonly TEST_SCENARIOS = {
    baseline: {
      name: 'Baseline (10 msg/sec)',
      messagesPerSecond: 10,
      durationSeconds: 10,
      messageSize: 'small' as const,
      pattern: 'constant' as const,
    },
    moderate: {
      name: 'Moderate Load (100 msg/sec)',
      messagesPerSecond: 100,
      durationSeconds: 15,
      messageSize: 'medium' as const,
      pattern: 'constant' as const,
    },
    high: {
      name: 'High Load (500 msg/sec)',
      messagesPerSecond: 500,
      durationSeconds: 20,
      messageSize: 'medium' as const,
      pattern: 'constant' as const,
    },
    extreme: {
      name: 'Extreme Load (1000+ msg/sec with bursts)',
      messagesPerSecond: 1000,
      durationSeconds: 30,
      messageSize: 'large' as const,
      pattern: 'burst' as const,
    },
    spike: {
      name: 'Spike Scenario (sudden traffic spike)',
      messagesPerSecond: 200,
      durationSeconds: 20,
      messageSize: 'small' as const,
      pattern: 'spike' as const,
    },
    ramp: {
      name: 'Ramp Test (gradual load increase)',
      messagesPerSecond: 500,
      durationSeconds: 25,
      messageSize: 'medium' as const,
      pattern: 'ramp' as const,
    },
  };
}
