import { Client, IMessage, StompSubscription } from '@stomp/stompjs';

export interface TopicBinding<TEvent extends string> {
  event: TEvent;
  destination: string;
  topicParam?: number;
  handler: (message: IMessage) => void;
}

export interface RequestedTopicBinding<TEvent extends string> {
  event: TEvent;
  topicParam?: number;
}

/**
 * Tracks requested logical events and maintains one active STOMP subscription per destination.
 */
export class StompTopicSubscriptionManager<TEvent extends string> {
  private topicSubscriptions = new Map<string, StompSubscription>();
  private requestedTopicBindings = new Map<
    string,
    RequestedTopicBinding<TEvent>
  >();

  public requestBindings(bindings: RequestedTopicBinding<TEvent>[]): void {
    bindings.forEach((binding) => {
      this.requestedTopicBindings.set(binding.event, binding);
    });
  }

  public getRequestedBindings(): RequestedTopicBinding<TEvent>[] {
    return Array.from(this.requestedTopicBindings.values());
  }

  public removeBindings(bindings: RequestedTopicBinding<TEvent>[]): void {
    bindings.forEach((binding) => {
      this.requestedTopicBindings.delete(binding.event);
    });
  }

  public syncSubscriptions(client: Client, bindings: TopicBinding<TEvent>[]): void {
    const desiredDestinations = new Set(
      bindings.map((binding) => binding.destination),
    );

    this.topicSubscriptions.forEach((subscription, destination) => {
      if (!desiredDestinations.has(destination)) {
        subscription.unsubscribe();
        this.topicSubscriptions.delete(destination);
      }
    });

    bindings.forEach((binding) => {
      if (!this.requestedTopicBindings.has(binding.event)) {
        return;
      }

      const existingSubscription = this.topicSubscriptions.get(binding.destination);
      if (existingSubscription) {
        existingSubscription.unsubscribe();
      }

      const subscription = client.subscribe(binding.destination, binding.handler);
      this.topicSubscriptions.set(binding.destination, subscription);
    });
  }

  public unsubscribeDestination(destination: string): void {
    const existingSubscription = this.topicSubscriptions.get(destination);
    if (!existingSubscription) {
      return;
    }

    existingSubscription.unsubscribe();
    this.topicSubscriptions.delete(destination);
  }

  public clearSubscriptions(): void {
    this.topicSubscriptions.forEach((subscription) => subscription.unsubscribe());
    this.topicSubscriptions.clear();
  }

  public clearRequestedBindings(): void {
    this.requestedTopicBindings.clear();
  }
}
