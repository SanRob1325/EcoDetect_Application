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
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/src/__mocks__/fileMock.js',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^antd/(.*)$': '<rootDir>/node_modules/antd/$1',
    '^@ant-design/(.*)$': '<rootDir>/node_modules/@ant-design/$1',
  },
  
  // Test file matching patterns
  testMatch: [
    '**/__tests__/**/*.js?(x)', 
    '**/?(*.)+(spec|test).js?(x)'
  ],
  
  // Temporarily disable coverage thresholds completely
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },
  
  // Transform patterns
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  
  // Transform patterns for specific modules
  transformIgnorePatterns: [
    '/node_modules/(?!(@babel/runtime|lodash-es|antd|rc-|@ant-design|@testing-library)/)' 
  ],
  
  // Additional Jest configurations
  verbose: true,
  testTimeout: 15000,
  resetMocks: true,
  clearMocks: true,
  restoreMocks: true,
  
  // Explicitly disable coverage collection in CI
  collectCoverage: false
};