// src/setupTests.js
import '@testing-library/jest-dom';

// Mock browser APIs needed for Ant Design components
beforeAll(() => {
  // Mock window.matchMedia - required for Ant Design responsive components
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),    // Deprecated but used by Ant Design
      removeListener: jest.fn(), // Deprecated but used by Ant Design
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock ResizeObserver - used by some Ant Design components
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    })),
  });

  // Capture original console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // Comprehensive warning suppression
  console.error = (...args) => {
    // Normalize args to string for safer checking
    const errorMessage = args[0] ? String(args[0]) : '';
    // Expanded list of warnings to suppress
    const suppressedWarnings = [
      // Antd specific deprecation warnings
      'Tabs.TabPane is deprecated',
      '`Tabs.TabPane` is deprecated',
      'headStyle is deprecated',
      'bodyStyle is deprecated',
      'Warning: \\[antd: (Card|Modal|Tabs|Select)\\]',
      '`children` should be `Select.Option`',
      
      // React Router warnings
      'You cannot render a <Router> inside another <Router>',
      
      // General React warnings
      'Warning: Failed prop type',
      'Warning: An update to .* inside a test was not wrapped in act',
      'Attempted to synchronously unmount a root',
      
      // Possible async/state update warnings
      'Cannot update a component',
      'React does not recognize the .* prop on a DOM element',
      
      // Add known warnings from your tests
      'Error fetching CO2 trends',
    ];
    
    // Check if any suppressed warning matches
    const shouldSuppress = suppressedWarnings.some(warning => 
      new RegExp(warning, 'i').test(errorMessage)
    );
    
    // Only call original error if not a suppressed warning
    if (!shouldSuppress) {
      originalError.call(console, ...args);
    }
  };
  
  // Similar approach for warnings
  console.warn = (...args) => {
    const warnMessage = args[0] ? String(args[0]) : '';
    const suppressedWarnings = [
      'Tabs.TabPane is deprecated',
      '`Tabs.TabPane` is deprecated',
      'React does not recognize the .* prop on a DOM element',
      'Warning: Received `true` for a non-boolean attribute',
      'Warning: Invalid aria',
    ];
    const shouldSuppress = suppressedWarnings.some(warning => 
      new RegExp(warning, 'i').test(warnMessage)
    );
    if (!shouldSuppress) {
      originalWarn.call(console, ...args);
    }
  };
});

// Restore original console methods after tests
afterAll(() => {
  // Note: These will be undefined unless defined in the global scope
  if (typeof originalError !== 'undefined') console.error = originalError;
  if (typeof originalWarn !== 'undefined') console.warn = originalWarn;
});

// Optional: Global test configuration
jest.setTimeout(10000); // Increase timeout for async tests

// Optional: Add global test setup
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});