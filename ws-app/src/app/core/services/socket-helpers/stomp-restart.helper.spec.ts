import { Client } from '@stomp/stompjs';

import { StompRestartCoordinator } from './stomp-restart.helper';

describe('StompRestartCoordinator', () => {
  function createClient(deactivateImpl?: () => Promise<void>): Client {
    return {
      deactivate: deactivateImpl ?? (() => Promise.resolve()),
      activate: jasmine.createSpy('activate'),
    } as unknown as Client;
  }

  it('skips when client is missing', async () => {
    const coordinator = new StompRestartCoordinator();
    const onSkippedState = jasmine.createSpy('onSkippedState');

    await coordinator.restart(undefined, {
      manualDisconnect: false,
      networkOffline: false,
      browserOnline: true,
    }, {
      onSkippedState,
      onSuppressedInFlight: () => undefined,
      onDeactivateError: () => undefined,
      onReactivate: () => undefined,
    });

    expect(onSkippedState).toHaveBeenCalledWith('no_client');
  });

  it('suppresses concurrent restart attempts', async () => {
    const coordinator = new StompRestartCoordinator();
    let resolveDeactivate: (() => void) | undefined;
    const deactivatePromise = new Promise<void>((resolve) => {
      resolveDeactivate = resolve;
    });

    const client = createClient(() => deactivatePromise);
    const onSuppressedInFlight = jasmine.createSpy('onSuppressedInFlight');

    const first = coordinator.restart(client, {
      manualDisconnect: false,
      networkOffline: false,
      browserOnline: true,
    }, {
      onSkippedState: () => undefined,
      onSuppressedInFlight,
      onDeactivateError: () => undefined,
      onReactivate: () => undefined,
    });

    await coordinator.restart(client, {
      manualDisconnect: false,
      networkOffline: false,
      browserOnline: true,
    }, {
      onSkippedState: () => undefined,
      onSuppressedInFlight,
      onDeactivateError: () => undefined,
      onReactivate: () => undefined,
    });

    expect(onSuppressedInFlight).toHaveBeenCalled();

    resolveDeactivate?.();
    await first;
  });

  it('skips reactivation when runtime says restart is not allowed', async () => {
    const coordinator = new StompRestartCoordinator();
    const client = createClient();
    const onSkippedState = jasmine.createSpy('onSkippedState');
    const onReactivate = jasmine.createSpy('onReactivate');

    await coordinator.restart(client, {
      manualDisconnect: true,
      networkOffline: false,
      browserOnline: true,
    }, {
      onSkippedState,
      onSuppressedInFlight: () => undefined,
      onDeactivateError: () => undefined,
      onReactivate,
    });

    expect(onSkippedState).toHaveBeenCalledWith('manual_disconnect');
    expect(onReactivate).not.toHaveBeenCalled();
  });

  it('reactivates after successful deactivate when state permits', async () => {
    const coordinator = new StompRestartCoordinator();
    const client = createClient();
    const onReactivate = jasmine.createSpy('onReactivate');

    await coordinator.restart(client, {
      manualDisconnect: false,
      networkOffline: false,
      browserOnline: true,
    }, {
      onSkippedState: () => undefined,
      onSuppressedInFlight: () => undefined,
      onDeactivateError: () => undefined,
      onReactivate,
    });

    expect(onReactivate).toHaveBeenCalled();
  });

  it('reports deactivate errors', async () => {
    const coordinator = new StompRestartCoordinator();
    const error = new Error('deactivate failed');
    const client = createClient(() => Promise.reject(error));
    const onDeactivateError = jasmine.createSpy('onDeactivateError');

    await coordinator.restart(client, {
      manualDisconnect: false,
      networkOffline: false,
      browserOnline: true,
    }, {
      onSkippedState: () => undefined,
      onSuppressedInFlight: () => undefined,
      onDeactivateError,
      onReactivate: () => undefined,
    });

    expect(onDeactivateError).toHaveBeenCalledWith(error);
  });
});
