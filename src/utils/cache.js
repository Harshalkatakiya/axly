export class CacheStorage {
  storage;
  constructor() {
    this.storage = new Map();
  }
  get(key) {
    const entry = this.storage.get(key);
    if (!entry) return null;
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return null;
    }
    return entry.value;
  }
  set(key, value, ttl) {
    this.storage.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });
  }
  delete(key) {
    this.storage.delete(key);
  }
  clear() {
    this.storage.clear();
  }
  has(key) {
    return this.storage.has(key);
  }
  keys() {
    return Array.from(this.storage.keys());
  }
}
