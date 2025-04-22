// src/__tests__/integration.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App'; // You'll need to create/modify the App component to include routing
import apiService from '../apiService';

// Mock the apiService
jest.mock('../apiService');

// Mock the components to simplify testing
jest.mock('../Dashboard', () => () => <div data-testid="dashboard">Dashboard</div>);
jest.mock('../RoomMonitor', () => () => <div data-testid="room-monitor">Room Monitor</div>);
jest.mock('../AIAssistant', () => () => <div data-testid="ai-assistant">AI Assistant</div>);
jest.mock('../SettingsPage', () => () => <div data-testid="settings-page">Settings</div>);
jest.mock('../ReportGenerator', () => () => <div data-testid="report-generator">Report Generator</div>);

// Mock react-router-dom's hooks
jest.mock('react-router-dom', () => {
  const originalModule = jest.requireActual('react-router-dom');
  
  // Create a safe mock that doesn't use window
  return {
    ...originalModule,
    useNavigate: () => jest.fn(),
    useLocation: () => ({ state: { from: { pathname: '/' } } })
  };
});

// Create a stub Header component that doesn't use window.location
jest.mock('../Header', () => {
  return function MockHeader({ onNavigate }) {
    // Use onNavigate callback instead of window.location
    return (
      <nav data-testid="header">
        <button onClick={() => onNavigate && onNavigate('/')}>Dashboard</button>
        <button onClick={() => onNavigate && onNavigate('/rooms')}>Rooms</button>
        <button onClick={() => onNavigate && onNavigate('/ai-assistant')}>AI Assistant</button>
        <button onClick={() => onNavigate && onNavigate('/settings')}>Settings</button>
        <button onClick={() => onNavigate && onNavigate('/reports')}>Reports</button>
        <button onClick={() => onNavigate && onNavigate('/logout')}>Logout</button>
      </nav>
    );
  };
});

// Mock AuthContext
jest.mock('../AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    isAuthenticated: true,
    login: jest.fn().mockResolvedValue({ success: true }),
    logout: jest.fn()
  })
}));

describe('User Flow Integration Tests', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Set up default mock implementations
    apiService.login.mockResolvedValue({ data: { success: true } });
    apiService.getSensorData.mockResolvedValue({
      data: {
        temperature: 23.5,
        humidity: 45,
        pressure: 1012,
        altitude: 50,
        imu: {
          acceleration: [0.1, 0.2, 0.3],
          gyroscope: [1, 2, 3],
          magnetometer: [4, 5, 6]
        }
      }
    });
  });

  test('dashboard is rendered by default', () => {
    // For this simple test, just check if App renders the Dashboard component
    // Pass useCustomRouter=true to avoid Router nesting
    render(
      <MemoryRouter initialEntries={['/']}>
        <App useCustomRouter={true} />
      </MemoryRouter>
    );
    
    // Dashboard should be shown
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });
  
  test('can navigate to different routes using MemoryRouter', () => {
    // Test navigation using MemoryRouter states instead of clicking
    const { rerender } = render(
      <MemoryRouter initialEntries={['/']}>
        <App useCustomRouter={true} />
      </MemoryRouter>
    );
    
    // Dashboard should be shown initially
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    
    // Rerender with rooms route
    rerender(
      <MemoryRouter initialEntries={['/rooms']}>
        <App useCustomRouter={true} />
      </MemoryRouter>
    );
    
    // Room monitor should be shown
    expect(screen.getByTestId('room-monitor')).toBeInTheDocument();
    
    // Rerender with AI assistant route
    rerender(
      <MemoryRouter initialEntries={['/ai-assistant']}>
        <App useCustomRouter={true} />
      </MemoryRouter>
    );
    
    // AI assistant should be shown
    expect(screen.getByTestId('ai-assistant')).toBeInTheDocument();
  });

  test('unauthenticated user is redirected to login page', async () => {
    // Mock the auth context to return unauthenticated
    jest.spyOn(require('../AuthContext'), 'useAuth').mockImplementation(() => ({
      isAuthenticated: false,
      login: jest.fn().mockResolvedValue({ success: true }),
      logout: jest.fn()
    }));
    
    render(
      <MemoryRouter initialEntries={['/']}>
        <App useCustomRouter={true} />
      </MemoryRouter>
    );
    
    // User should see the login page
    await waitFor(() => {
      const loginElements = screen.queryAllByText(/login/i, { exact: false });
      expect(loginElements.length).toBeGreaterThan(0);
      expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
    });
  });
});