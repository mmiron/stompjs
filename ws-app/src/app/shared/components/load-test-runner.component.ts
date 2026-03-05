import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadTestService, LoadTestMetrics, LoadTestConfig } from '../../core/services/load-test.service';

@Component({
  selector: 'app-load-test-runner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './load-test-runner.component.html',
  styleUrl: './load-test-runner.component.css',
})
export class LoadTestRunnerComponent {
  private loadTestService = inject(LoadTestService);

  @Output() metricsCompleted = new EventEmitter<LoadTestMetrics>();

  isRunning = signal<boolean>(false);
  currentTest = signal<LoadTestConfig | null>(null);
  currentMetrics = signal<LoadTestMetrics | null>(null);
  lastMetrics = signal<LoadTestMetrics | null>(null);
  progressPercent = signal<number>(0);

  scenarios = Object.values(LoadTestService.TEST_SCENARIOS);

  async runTest(scenario: LoadTestConfig): Promise<void> {
    this.isRunning.set(true);
    this.currentTest.set(scenario);
    this.currentMetrics.set(null);
    this.progressPercent.set(0);

    const startTime = Date.now();
    const durationMs = scenario.durationSeconds * 1000;

    // Update progress every 100ms
    const progressInterval = setInterval(() => {
      if (this.isRunning()) {
        const elapsed = Date.now() - startTime;
        this.progressPercent.set(Math.min(100, (elapsed / durationMs) * 100));
      } else {
        clearInterval(progressInterval);
      }
    }, 100);

    try {
      const metrics = await this.loadTestService.runLoadTest(scenario);
      this.lastMetrics.set(metrics);
      this.metricsCompleted.emit(metrics);
      this.progressPercent.set(100);
    } catch (error) {
      console.error('Load test failed:', error);
    } finally {
      this.isRunning.set(false);
      this.currentTest.set(null);
      clearInterval(progressInterval);
    }
  }
}
