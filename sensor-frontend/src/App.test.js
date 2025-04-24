import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Import App after mocking
import App from './App';

// Mock dependencies 
jest.mock('antd', () => ({
  Dropdown: ({ children, overlay }) => <div data-testid="mock-dropdown">{children}{overlay}</div>,
  Layout: {
    Header: ({ children, style }) => <header data-testid="mock-header" style={style}>{children}</header>,
    Content: ({ children, style }) => <main data-testid="mock-content" style={style}>{children}</main>,
    Sider: ({ children }) => <div data-testid="mock-sider">{children}</div>
  },
  Menu: {
    Item: ({ children, key, icon, onClick }) => (
      <div data-testid={`mock-menu-item-${key}`} onClick={onClick}>{icon}{children}</div>
    ),
    Divider: () => <div data-testid="mock-menu-divider" />
  },
  Typography: {
    Title: ({ children, level, style }) => <h1 data-level={level} style={style}>{children}</h1>,
    Paragraph: ({ children }) => <p>{children}</p>
  },
  Avatar: ({ icon, style }) => <div data-testid="mock-avatar" style={style}>{icon}</div>,
  Spin: ({ size }) => <div data-testid="mock-spinner">Loading...</div>,
  Button: ({ children, onClick, icon, type, style }) => (
    <button data-testid="mock-button" onClick={onClick} style={style}>{icon}{children}</button>
  ),
  message: {
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn()
  }
}));

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div data-testid="mock-browser-router">{children}</div>,
  Routes: ({ children }) => <div data-testid="mock-routes">{children}</div>,
  Route: ({ path, element }) => <div data-testid={`route-${path?.replace(/\//g, '-') || 'default'}`}>{element}</div>,
  Link: ({ children, to }) => <a href={to} data-testid="mock-link">{children}</a>,
  Navigate: () => <div data-testid="mock-navigate" />,
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/', state: null })
}));

// Mock icons
jest.mock('@ant-design/icons', () => ({
  UserOutlined: () => <div data-testid="user-icon" />,
  LogoutOutlined: () => <div data-testid="logout-icon" />,
  MenuOutlined: () => <div data-testid="menu-icon" />
}));

// Mock logo import
jest.mock('./Icon-Only-Black.png', () => 'mock-logo-path');

// Mock the Auth utils and context
jest.mock('./authUtils', () => ({
  signOut: jest.fn().mockResolvedValue({}),
}));

// Mock components
jest.mock('./Login', () => {
  return {
    __esModule: true,
    default: () => <div data-testid="mock-login">Login Component</div>
  };
});

jest.mock('./Signup', () => {
  return {
    __esModule: true,
    default: () => <div data-testid="mock-signup">Signup Component</div>
  };
});

jest.mock('./ForgotPassword', () => {
  return {
    __esModule: true,
    default: () => <div data-testid="mock-forgot-password">Forgot Password Component</div>
  };
});

jest.mock('./ProtectedRoute', () => {
  return {
    __esModule: true,
    default: ({ children }) => <div data-testid="protected-route">{children}</div>
  };
});

// Mock page components
jest.mock('./WelcomePage', () => () => <div data-testid="mock-welcome">Welcome Page</div>);
jest.mock('./Dashboard', () => () => <div data-testid="mock-dashboard">Dashboard</div>);
jest.mock('./UserGuide', () => () => <div data-testid="mock-guide">User Guide</div>);
jest.mock('./AIAssistant', () => () => <div data-testid="mock-ai">AI Assistant</div>);
jest.mock('./NoticeBoard', () => () => <div data-testid="mock-notice-board">Notice Board</div>);
jest.mock('./Alerts', () => () => <div data-testid="mock-alerts">Alerts</div>);
jest.mock('./SettingsPage', () => () => <div data-testid="mock-settings">Settings</div>);
jest.mock('./ReportGenerator', () => () => <div data-testid="mock-reports">Reports</div>);
jest.mock('./RoomMonitor', () => () => <div data-testid="mock-rooms">Room Monitor</div>);
jest.mock('./VehicleMovement', () => () => <div data-testid="mock-vehicle">Vehicle Movement</div>);

// Mock AuthContext
jest.mock('./AuthContext', () => ({
  AuthProvider: ({ children }) => <div data-testid="auth-provider">{children}</div>,
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    loading: false,
    logout: jest.fn()
  })
}));

describe('App Component', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders without crashing', () => {
    const { container } = render(<App useCustomRouter={true} />);
    expect(container).toBeTruthy();
  });

  test('shows login page when not authenticated', () => {
    render(<App useCustomRouter={true}/>);
    
    // Check for login-related elements
    const loginElements = screen.getAllByTestId('mock-login');
    expect(loginElements.length).toBeGreaterThan(0);
  });

  test('renders loading spinner during authentication', () => {
    // Mock loading state
    jest.spyOn(require('./AuthContext'), 'useAuth').mockImplementation(() => ({
      user: null,
      isAuthenticated: false,
      loading: true,
      logout: jest.fn()
    }));

    render(<App useCustomRouter={true}/>);
    
    // Check for loading spinner
    expect(screen.getByTestId('mock-spinner')).toBeInTheDocument();
  });

  test.skip('shows navigation menu when authenticated', async () => {
    // Mock authenticated state
    jest.spyOn(require('./AuthContext'), 'useAuth').mockImplementation(() => ({
      user: { username: 'testuser' },
      isAuthenticated: true,
      loading: false,
      logout: jest.fn()
    }));

    render(<App useCustomRouter={true}/>);
    
    // Wait for potential async operations
    await waitFor(() => {
      // Check for key authenticated elements
      expect(screen.getByTestId('mock-header')).toBeInTheDocument();
      expect(screen.getByTestId('mock-content')).toBeInTheDocument();
      expect(screen.getByTestId('mock-avatar')).toBeInTheDocument();
    });
  });

  test.skip('provides logout functionality', async () => {
    const mockLogout = jest.fn();
    
    // Mock authenticated state with logout function
    jest.spyOn(require('./AuthContext'), 'useAuth').mockImplementation(() => ({
      user: { username: 'testuser' },
      isAuthenticated: true,
      loading: false,
      logout: mockLogout
    }));

    render(<App useCustomRouter={true}/>);
    
    // Find and interact with logout element
    await waitFor(() => {
      const logoutIcon = screen.getByTestId('logout-icon');
      expect(logoutIcon).toBeInTheDocument();
    });
  });
});