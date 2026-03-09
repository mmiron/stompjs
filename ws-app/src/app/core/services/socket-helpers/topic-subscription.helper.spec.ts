import { Client, IMessage, StompSubscription } from '@stomp/stompjs';

import { StompTopicSubscriptionManager, TopicBinding } from './topic-subscription.helper';

describe('StompTopicSubscriptionManager', () => {
  type EventName = 'dataUpdate' | 'recordChanged';

  function createMockClient(subscribeSpy: jasmine.Spy): Client {
    return {
      subscribe: subscribeSpy,
    } as unknown as Client;
  }

  function createBinding(event: EventName, destination: string, handler?: (message: IMessage) => void): TopicBinding<EventName> {
    return {
      event,
      destination,
      handler: handler ?? (() => undefined),
    };
  }

  it('subscribes only requested events', () => {
    const manager = new StompTopicSubscriptionManager<EventName>();
    const subscription = {
      id: 'sub-1',
      unsubscribe: jasmine.createSpy('unsubscribe'),
    } as StompSubscription;
    const subscribeSpy = jasmine.createSpy('subscribe').and.returnValue(subscription);
    const client = createMockClient(subscribeSpy);

    manager.requestBindings([{ event: 'dataUpdate' }]);
    manager.syncSubscriptions(client, [
      createBinding('dataUpdate', '/topic/data'),
      createBinding('recordChanged', '/topic/recordChanged'),
    ]);

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith('/topic/data', jasmine.any(Function));
  });

  it('replaces existing subscription for same destination', () => {
    const manager = new StompTopicSubscriptionManager<EventName>();
    const firstSubscription = {
      id: 'sub-1',
      unsubscribe: jasmine.createSpy('firstUnsubscribe'),
    } as StompSubscription;
    const secondSubscription = {
      id: 'sub-2',
      unsubscribe: jasmine.createSpy('secondUnsubscribe'),
    } as StompSubscription;

    const subscribeSpy = jasmine.createSpy('subscribe')
      .and.returnValues(firstSubscription, secondSubscription);
    const client = createMockClient(subscribeSpy);

    manager.requestBindings([{ event: 'dataUpdate' }]);

    manager.syncSubscriptions(client, [createBinding('dataUpdate', '/topic/data')]);
    manager.syncSubscriptions(client, [createBinding('dataUpdate', '/topic/data')]);

    expect(subscribeSpy).toHaveBeenCalledTimes(2);
    expect(firstSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(secondSubscription.unsubscribe).not.toHaveBeenCalled();
  });

  it('unsubscribes all tracked subscriptions on clear', () => {
    const manager = new StompTopicSubscriptionManager<EventName>();
    const dataSubscription = {
      id: 'sub-data',
      unsubscribe: jasmine.createSpy('dataUnsubscribe'),
    } as StompSubscription;
    const recordSubscription = {
      id: 'sub-record',
      unsubscribe: jasmine.createSpy('recordUnsubscribe'),
    } as StompSubscription;

    const subscribeSpy = jasmine.createSpy('subscribe')
      .and.returnValues(dataSubscription, recordSubscription);
    const client = createMockClient(subscribeSpy);

    manager.requestBindings([
      { event: 'dataUpdate' },
      { event: 'recordChanged' },
    ]);
    manager.syncSubscriptions(client, [
      createBinding('dataUpdate', '/topic/data'),
      createBinding('recordChanged', '/topic/recordChanged'),
    ]);

    manager.clearSubscriptions();

    expect(dataSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(recordSubscription.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
