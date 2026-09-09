import { Injectable, Logger } from '@nestjs/common';

type Handler<T = any> = (payload: T) => void | Promise<void>;

/**
 * Minimal in-process event bus. Handlers run asynchronously and are isolated:
 * a throwing handler is logged and never affects the emitter or other handlers.
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly handlers = new Map<string, Set<Handler>>();

  on<T = any>(event: string, handler: Handler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  emit<T = any>(event: string, payload: T): void {
    const handlers = this.handlers.get(event);
    if (!handlers || handlers.size === 0) return;

    for (const handler of handlers) {
      Promise.resolve()
        .then(() => handler(payload))
        .catch((err) => {
          this.logger.error(`Handler for "${event}" failed: ${err?.message || err}`, err?.stack);
        });
    }
  }

  listenerCount(event: string): number {
    return this.handlers.get(event)?.size || 0;
  }
}
