import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { StompService } from '../../core/services/stomp.service';
import { LoadTestMetrics } from '../../core/services/load-test.service';
import { LoadTestRunnerComponent } from '../../shared/components/load-test-runner.component';

interface PerformanceMetric {
  label: string;
  value: string | number;
  status: 'healthy' | 'warning' | 'critical';
  icon: string;
}

interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  metric?: number;
  threshold?: { warn: number; critical: number };
}

@Component({
  selector: 'app-performance-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadTestRunnerComponent],
  templateUrl: './performance-dashboard.component.html',
  styleUrl: './performance-dashboard.component.css',
})
export class PerformanceDashboardComponent implements OnInit {
  private stompService = inject(StompService);
  // Connection state
  online = this.stompService.online;
  isReconnecting = this.stompService.isReconnecting;
  circuitBreakerState = this.stompService.circuitBreakerState;

  // Performance tracking
  lastTestMetrics = signal<LoadTestMetrics | null>(null);
  testHistory = signal<LoadTestMetrics[]>([]);
  currentMetrics = signal<PerformanceMetric[]>([]);
  healthChecks = signal<HealthCheck[]>([]);

  messageCount = signal<number>(0);
  errorCount = signal<number>(0);
  lastUpdateTime = signal<string>('Never');

  // UI state
  selectedTimeRange = signal<'1h' | '24h' | '7d'>('24h');
  showRawData = signal<boolean>(false);
  readonly timeRanges = ['1h', '24h', '7d'] as const;

  ngOnInit(): void {
    this.initializeMetrics();
    this.subscribeToSocketEvents();
    this.startMetricsUpdate();
  }

  protected readonly filteredTestHistory = computed(() => {
    const history = this.testHistory();
    if (!history.length) {
      return [];
    }

    const now = Date.now();
    const timeRange = this.selectedTimeRange();
    const cutoff = now - this.getTimeRangeMs(timeRange);

    return history.filter(item => {
      if (!item.timestamp) {
        return true;
      }
      const timestamp = new Date(item.timestamp).getTime();
      return timestamp >= cutoff;
    });
  });

  protected readonly historySummary = computed(() => {
    const history = this.filteredTestHistory();
    if (!history.length) {
      return {
        count: 0,
        avgThroughput: 0,
        avgLatency: 0,
        bestSuccessRate: 0,
      };
    }

    const count = history.length;
    const totalThroughput = history.reduce((sum, item) => sum + item.messagesPerSecond, 0);
    const totalLatency = history.reduce((sum, item) => sum + item.averageLatencyMs, 0);
    const bestSuccessRate = Math.max(
      ...history.map(item => ((item.totalMessages - item.failedMessages) / item.totalMessages) * 100)
    );

    return {
      count,
      avgThroughput: totalThroughput / count,
      avgLatency: totalLatency / count,
      bestSuccessRate,
    };
  });

  protected setTimeRange(range: (typeof this.timeRanges)[number]): void {
    this.selectedTimeRange.set(range);
  }

  private initializeMetrics(): void {
    // Load test data from localStorage if available
    const savedMetrics = localStorage.getItem('loadTestMetrics');
    if (savedMetrics) {
      try {
        const metrics = JSON.parse(savedMetrics) as LoadTestMetrics[];
        this.testHistory.set(metrics);
        if (metrics.length > 0) {
          this.lastTestMetrics.set(metrics[metrics.length - 1]);
        }
      } catch (e) {
        console.error('Failed to load metrics from storage:', e);
      }
    }
  }

  private subscribeToSocketEvents(): void {
    this.stompService.connectSocket();
    this.stompService.subscribeToEvents([
      { event: 'dataUpdate', topicParam: 0 },
    ]);

    // Track data updates
    this.stompService.dataUpdate$.subscribe(() => {
      this.messageCount.update(c => c + 1);
      this.updateLastActivity();
    });

    // Track errors
    this.stompService.error$.subscribe(() => {
      this.errorCount.update(c => c + 1);
      this.updateLastActivity();
    });
  }

  private startMetricsUpdate(): void {
    // Update health checks every 5 seconds
    setInterval(() => {
      this.refreshHealthChecks();
      this.updateCurrentMetrics();
    }, 5000);

    // Initial update
    this.refreshHealthChecks();
    this.updateCurrentMetrics();
  }

  private getTimeRangeMs(timeRange: '1h' | '24h' | '7d'): number {
    switch (timeRange) {
      case '1h':
        return 60 * 60 * 1000;
      case '7d':
        return 7 * 24 * 60 * 60 * 1000;
      case '24h':
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  private updateLastActivity(): void {
    const now = new Date();
    this.lastUpdateTime.set(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
  }

  private refreshHealthChecks(): void {
    const checks: HealthCheck[] = [];

    // Connection health
    if (this.online()) {
      checks.push({
        name: '✓ Connection Status',
        status: 'pass',
        message: 'Connected to STOMP server',
      });
    } else if (this.isReconnecting()) {
      checks.push({
        name: '⟳ Connection Status',
        status: 'warn',
        message: 'Attempting to reconnect',
      });
    } else {
      checks.push({
        name: '✗ Connection Status',
        status: 'fail',
        message: 'Disconnected from server',
      });
    }

    // Circuit breaker health
    const cbState = this.circuitBreakerState();
    if (cbState === 'closed') {
      checks.push({
        name: '✓ Circuit Breaker',
        status: 'pass',
        message: 'System operating normally',
      });
    } else if (cbState === 'half-open') {
      checks.push({
        name: '⟳ Circuit Breaker',
        status: 'warn',
        message: 'Testing recovery from failures',
      });
    } else {
      checks.push({
        name: '! Circuit Breaker',
        status: 'fail',
        message: 'Too many failures - protecting system',
      });
    }

    // Message health
    const errorRate = this.messageCount() > 0 
      ? (this.errorCount() / this.messageCount()) * 100 
      : 0;

    if (errorRate < 1) {
      checks.push({
        name: '✓ Message Processing',
        status: 'pass',
        message: `${this.messageCount()} messages processed`,
        metric: errorRate,
      });
    } else if (errorRate < 5) {
      checks.push({
        name: '⚠ Message Processing',
        status: 'warn',
        message: `${this.errorCount()} errors in ${this.messageCount()} messages`,
        metric: errorRate,
      });
    } else {
      checks.push({
        name: '✗ Message Processing',
        status: 'fail',
        message: `High error rate: ${this.errorCount()}/${this.messageCount()}`,
        metric: errorRate,
      });
    }

    // Memory health (if available from last test)
    const lastMetrics = this.lastTestMetrics();
    if (lastMetrics) {
      const memoryUsed = lastMetrics.memoryUsedMB;
      if (memoryUsed < 20) {
        checks.push({
          name: '✓ Memory Usage',
          status: 'pass',
          message: `${memoryUsed}MB used`,
          metric: memoryUsed,
        });
      } else if (memoryUsed < 50) {
        checks.push({
          name: '⚠ Memory Usage',
          status: 'warn',
          message: `${memoryUsed}MB used (moderate)`,
          metric: memoryUsed,
        });
      } else {
        checks.push({
          name: '! Memory Usage',
          status: 'fail',
          message: `${memoryUsed}MB used (high)`,
          metric: memoryUsed,
        });
      }

      // CPU health
      const cpuUsed = lastMetrics.cpuPercentage;
      if (cpuUsed < 50) {
        checks.push({
          name: '✓ CPU Usage',
          status: 'pass',
          message: `${cpuUsed}% utilization`,
          metric: cpuUsed,
        });
      } else if (cpuUsed < 80) {
        checks.push({
          name: '⚠ CPU Usage',
          status: 'warn',
          message: `${cpuUsed}% utilization`,
          metric: cpuUsed,
        });
      } else {
        checks.push({
          name: '! CPU Usage',
          status: 'fail',
          message: `${cpuUsed}% utilization (high)`,
          metric: cpuUsed,
        });
      }
    }

    this.healthChecks.set(checks);
  }

  private updateCurrentMetrics(): void {
    const lastMetrics = this.lastTestMetrics();
    
    if (!lastMetrics) {
      this.currentMetrics.set([
        {
          label: 'Run a Load Test',
          value: 'Click button below to start',
          status: 'warning',
          icon: '▶️',
        },
      ]);
      return;
    }

    const metrics: PerformanceMetric[] = [
      {
        label: 'Throughput',
        value: `${lastMetrics.messagesPerSecond} msg/s`,
        status: lastMetrics.messagesPerSecond > 500 ? 'healthy' : 'warning',
        icon: '📊',
      },
      {
        label: 'Avg Latency',
        value: `${lastMetrics.averageLatencyMs}ms`,
        status: lastMetrics.averageLatencyMs < 100 ? 'healthy' : 'warning',
        icon: '⏱️',
      },
      {
        label: 'Success Rate',
        value: `${(100 - (lastMetrics.failedMessages / lastMetrics.totalMessages) * 100).toFixed(1)}%`,
        status: (100 - (lastMetrics.failedMessages / lastMetrics.totalMessages) * 100) > 95 ? 'healthy' : 'warning',
        icon: '✓',
      },
      {
        label: 'Memory Used',
        value: `${lastMetrics.memoryUsedMB}MB`,
        status: lastMetrics.memoryUsedMB < 30 ? 'healthy' : 'warning',
        icon: '🧠',
      },
      {
        label: 'CPU Usage',
        value: `${lastMetrics.cpuPercentage}%`,
        status: lastMetrics.cpuPercentage < 70 ? 'healthy' : 'warning',
        icon: '⚙️',
      },
      {
        label: 'Max Latency',
        value: `${lastMetrics.maxLatencyMs}ms`,
        status: lastMetrics.maxLatencyMs < 500 ? 'healthy' : 'warning',
        icon: '📈',
      },
    ];

    this.currentMetrics.set(metrics);
  }

  getHealthColor(status: string): string {
    switch (status) {
      case 'pass': return '#10b981'; // green
      case 'warn': return '#f59e0b'; // amber
      case 'fail': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
  }

  getMetricColor(status: string): string {
    switch (status) {
      case 'healthy': return '#10b981'; // green
      case 'warning': return '#f59e0b'; // amber
      case 'critical': return '#ef4444'; // red
      default: return '#3b82f6'; // blue
    }
  }

  exportMetrics(): void {
    const data = {
      timestamp: new Date().toISOString(),
      lastTest: this.lastTestMetrics(),
      testHistory: this.testHistory(),
      healthChecks: this.healthChecks(),
      connectionState: {
        online: this.online(),
        isReconnecting: this.isReconnecting(),
        circuitBreakerState: this.circuitBreakerState(),
      },
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `performance-metrics-${new Date().getTime()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  onLoadTestCompleted(metrics: LoadTestMetrics): void {
    this.lastTestMetrics.set(metrics);
    const updatedHistory = [...this.testHistory(), metrics];
    this.testHistory.set(updatedHistory);
    localStorage.setItem('loadTestMetrics', JSON.stringify(updatedHistory));
    this.updateCurrentMetrics();
    this.refreshHealthChecks();
  }

  clearHistory(): void {
    if (confirm('Clear all test history? This cannot be undone.')) {
      localStorage.removeItem('loadTestMetrics');
      this.testHistory.set([]);
      this.lastTestMetrics.set(null);
    }
  }

  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const lastMetrics = this.lastTestMetrics();

    if (!lastMetrics) {
      return ['Run a baseline load test to establish performance baseline'];
    }

    // Latency recommendations
    if (lastMetrics.averageLatencyMs > 100) {
      recommendations.push('🔴 High latency detected. Consider optimizing message handlers or checking backend performance.');
    } else if (lastMetrics.averageLatencyMs > 50) {
      recommendations.push('🟡 Monitor latency trends. Consider load balancing if it continues to increase.');
    }

    // Throughput recommendations
    if (lastMetrics.messagesPerSecond < 100) {
      recommendations.push('🟡 Low throughput. May indicate network issues or backend bottlenecks.');
    }

    // Error rate recommendations
    const errorRate = (lastMetrics.failedMessages / lastMetrics.totalMessages) * 100;
    if (errorRate > 5) {
      recommendations.push('🔴 High error rate. Check circuit breaker status and backend logs.');
    }

    // Memory recommendations
    if (lastMetrics.memoryUsedMB > 50) {
      recommendations.push('🟡 High memory usage. Check for potential memory leaks in message handling.');
    }

    // CPU recommendations
    if (lastMetrics.cpuPercentage > 80) {
      recommendations.push('🔴 High CPU usage. Consider reducing message rate or optimizing handlers.');
    } else if (lastMetrics.cpuPercentage < 20) {
      recommendations.push('✅ System has headroom. Can handle additional load.');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All systems operating normally. No recommendations at this time.');
    }

    return recommendations;
  }
}
