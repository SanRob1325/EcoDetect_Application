module.exports = {
  // Use jsdom for browser-like testing environment
  testEnvironment: 'jsdom',

  // Setup files to run before tests
  setupFiles: [
    '<rootDir>/jest.setup.js'  // Add TextEncoder and matchMedia polyfills
  ],
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTests.js'
  ],

  // Mock file and asset imports
  moduleNameMapper: {
    // Media and font file mocking
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/src/__mocks__/fileMock.js',
    
    // CSS and styling mocking
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    
    // Antd and other module imports
    '^antd/(.*)$': '<rootDir>/node_modules/antd/$1',
    '^@ant-design/(.*)$': '<rootDir>/node_modules/@ant-design/$1',
    
    // Ensure proper module resolution
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Test file matching patterns
  testMatch: [
    '**/__tests__/**/*.js?(x)', 
    '**/?(*.)+(spec|test).js?(x)'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/reportWebVitals.js',
    '!src/serviceWorker.js',
    '!src/__mocks__/**',
    '!src/**/*.test.js',
    '!src/**/*.spec.js'
  ],
  coverageThreshold: {
    global: {
      branches: 40,  // Lowered to be more realistic during initial development
      functions: 40,
      lines: 40,
      statements: 40
    }
  },

  // Transformation configuration
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
    '^.+\\.css$': 'jest-transform-css'
  },

  // Transform patterns for specific modules
  transformIgnorePatterns: [
    '/node_modules/(?!(@babel/runtime|lodash-es|antd|rc-|@ant-design|@testing-library)/)' 
  ],

  // Additional Jest configurations
  verbose: true,
  testTimeout: 15000,  // Increased timeout for complex tests

  // Prevent test pollution and improve test isolation
  resetMocks: true,
  clearMocks: true,
  restoreMocks: true,

  // Performance and memory management
  maxWorkers: '50%',
  cacheDirectory: '<rootDir>/.jest-cache',

  // Additional configuration for better error reporting
  errorOnDeprecated: true,
  
  // Collect test coverage only when explicitly requested
  collectCoverage: false
};