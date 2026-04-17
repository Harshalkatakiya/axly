import type { EventHandler } from '../types/index.js';

export class Emitter {
  private handlers = new Map<string, EventHandler[]>();

  on(event: string, fn: EventHandler): () => void {
    const list = this.handlers.get(event) ?? [];
    list.push(fn);
    this.handlers.set(event, list);
    return () => this.off(event, fn);
  }

  off(event: string, fn?: EventHandler): void {
    if (!fn) {
      this.handlers.delete(event);
      return;
    }
    const list = (this.handlers.get(event) ?? []).filter((h) => h !== fn);
    if (list.length) this.handlers.set(event, list);
    else this.handlers.delete(event);
  }

  emit(event: string, ...args: unknown[]): void {
    (this.handlers.get(event) ?? []).forEach((h) => {
      try {
        h(...args);
      } catch {
        // swallow handler errors; one bad listener shouldn't break the others
      }
    });
  }
}
