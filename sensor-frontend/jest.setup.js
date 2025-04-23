// jest.setup.js
// Polyfills and global setup for Jest

// Check if TextEncoder and TextDecoder are already defined globally
if (typeof global.TextEncoder === 'undefined') {
    const { TextEncoder, TextDecoder } = require('util');
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
  }
  
  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // Deprecated
      removeListener: jest.fn(), // Deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }))
  });

// Mock ResizeObserver as well
Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    })),
  });
  // Mock browser APIs that might be missing in test environment
  if (typeof window.scrollTo === 'undefined') {
    window.scrollTo = jest.fn();
  }
  
  // Optional: Suppress specific console warnings
  const originalError = console.error;
  console.error = (...args) => {
    const suppressedWarnings = [
      'Warning: [antd:',
      'Tabs.TabPane is deprecated',
      'bodyStyle is deprecated',
      'headStyle is deprecated'
    ];
  
    if (!suppressedWarnings.some(warning => String(args[0]).includes(warning))) {
      originalError.call(console, ...args);
    }
  };
  
  // Optional: Add any additional global mocks or setup here