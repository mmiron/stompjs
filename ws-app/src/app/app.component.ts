
import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  computed,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { LoadTestMetrics } from './core/services/load-test.service';
import { StompService } from './core/services/stomp.service';
import { ConnectionStatusComponent } from './shared/components/connection-status.component';
import { LoadTestRunnerComponent } from './shared/components/load-test-runner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ConnectionStatusComponent,
    LoadTestRunnerComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnDestroy {
  private router = inject(Router);
  private stompService = inject(StompService);

  title = 'ws-app';
  isDevelopment = isDevMode();
  private currentUrl = signal(this.router.url);

  showGlobalLoadTest = computed(
    () => this.isDevelopment && !this.currentUrl().startsWith('/performance-dashboard'),
  );

  constructor() {
    this.stompService.connectSocket();

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl.set((event as NavigationEnd).urlAfterRedirects);
      });
  }

  onGlobalLoadTestCompleted(metrics: LoadTestMetrics): void {
    console.log('Global load test completed:', metrics);
  }

  ngOnDestroy(): void {
    this.stompService.disconnect();
  }
}
