class LocalStorageMock {
    constructor() {
      this.store = {};
    }
  
    clear() {
      this.store = {};
    }
  
    getItem(key) {
      return this.store[key] || null;
    }
  
    setItem(key, value) {
      this.store[key] = value.toString();
    }
  
    removeItem(key) {
      delete this.store[key];
    }
  }
  
  const localStorageMock = new LocalStorageMock();
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  });
  
  module.exports = localStorageMock;