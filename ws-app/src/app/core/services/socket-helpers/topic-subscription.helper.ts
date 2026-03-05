import { Client, IMessage, StompSubscription } from '@stomp/stompjs';

export interface TopicBinding<TEvent extends string> {
  event: TEvent;
  destination: string;
  topicParam: number;
  handler: (message: IMessage) => void;
}

export interface RequestedTopicBinding<TEvent extends string> {
  event: TEvent;
  topicParam: number;
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
      this.requestedTopicBindings.set(
        this.createBindingKey(binding.event, binding.topicParam),
        binding,
      );
    });
  }

  public getRequestedBindings(): RequestedTopicBinding<TEvent>[] {
    return Array.from(this.requestedTopicBindings.values());
  }

  public syncSubscriptions(client: Client, bindings: TopicBinding<TEvent>[]): void {
    bindings.forEach((binding) => {
      if (
        !this.requestedTopicBindings.has(
          this.createBindingKey(binding.event, binding.topicParam),
        )
      ) {
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

  public clearSubscriptions(): void {
    this.topicSubscriptions.forEach((subscription) => subscription.unsubscribe());
    this.topicSubscriptions.clear();
  }

  private createBindingKey(event: TEvent, topicParam: number): string {
    return `${event}:${topicParam}`;
  }
}
