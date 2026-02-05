export class EventEmitter<T extends Record<string, any>> {
  private listeners: { [K in keyof T]?: Set<(data: T[K]) => void> } = {};

  /** * Subscribe to an event. 
   * @returns A function that removes this listener.
   */
  on<K extends keyof T>(event: K, callback: (data: T[K]) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event]!.add(callback);

    // Return the unsubscribe function
    return () => this.off(event, callback);
  }

  protected emit<K extends keyof T>(event: K, data: T[K]): void {
    this.listeners[event]?.forEach((cb) => cb(data));
  }

  off<K extends keyof T>(event: K, callback: (data: T[K]) => void): void {
    this.listeners[event]?.delete(callback);
  }
}
