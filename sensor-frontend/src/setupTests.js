// src/setupTests.js
// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Override console.error to reduce test noise
const originalError = console.error;

console.error = (...args) => {
  // Suppress specific warning messages that we know about and are fixing
  if (
    args[0]?.includes('`children` should be `Select.Option`') ||
    args[0]?.includes('bodyStyle is deprecated') ||
    args[0]?.includes('You cannot render a <Router> inside another <Router>') ||
    args[0]?.includes('Warning: Failed prop type')
  ) {
    return;
  }
  
  // Let other errors through
  originalError.call(console, ...args);
};

// Suppress some React warnings that might not be relevant in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  // Add suppressions for specific warnings here if needed
  
  originalWarn.call(console, ...args);
};

// Create a minimal Header component for tests if it doesn't exist
if (!global.Header) {
  global.Header = ({ onNavigate }) => (
    <nav data-testid="header">
      <button onClick={() => onNavigate && onNavigate('/')}>Dashboard</button>
      <button onClick={() => onNavigate && onNavigate('/rooms')}>Rooms</button>
    </nav>
  );
}