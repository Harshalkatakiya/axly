import { SocketIO } from './SocketIO.js';
export class SocketManager {
  defaultConfig;
  instances = new Map();
  constructor(defaultConfig) {
    this.defaultConfig = defaultConfig;
  }
  create(name, config) {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const instance = new SocketIO(mergedConfig);
    this.instances.set(name, instance);
    return instance;
  }
  get(name) {
    return this.instances.get(name);
  }
  remove(name) {
    const instance = this.instances.get(name);
    instance?.disconnect();
    this.instances.delete(name);
  }
  connectAll() {
    return Promise.all(
      Array.from(this.instances.values()).map((instance) => instance.connect())
    );
  }
  disconnectAll() {
    this.instances.forEach((instance) => instance.disconnect());
  }
}
