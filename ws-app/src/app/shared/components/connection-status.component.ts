import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StompService } from '../../core/services/stomp.service';

@Component({
  selector: 'app-connection-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './connection-status.component.html',
  styleUrl: './connection-status.component.css',
})
export class ConnectionStatusComponent {
  private stompService = inject(StompService);

  online = this.stompService.online;
  isReconnecting = this.stompService.isReconnecting;
  circuitBreakerState = this.stompService.circuitBreakerState;

  getStatusClass(): string {
    if (this.isReconnecting()) return 'reconnecting';
    if (this.online()) return 'connected';
    return 'disconnected';
  }

  getIndicatorClass(): string {
    return this.getStatusClass();
  }

  getStatusText(): string {
    if (this.isReconnecting()) return 'Reconnecting...';
    if (this.online()) return 'Connected';
    return 'Disconnected';
  }

  getTooltip(): string {
    const cbState = this.circuitBreakerState();
    let base = '';
    
    if (this.isReconnecting()) base = 'Attempting to reconnect to server';
    else if (this.online()) base = 'Connected to server';
    else base = 'Disconnected from server';

    if (cbState === 'open') return base + ' (⚠️ Circuit breaker OPEN - too many failures)';
    if (cbState === 'half-open') return base + ' (⚙️ Circuit breaker HALF-OPEN - testing recovery)';
    
    return base;
  }
}
