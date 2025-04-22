import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock dependencies comprehensively
jest.mock('antd', () => ({
  Dropdown: ({ children }) => <div data-testid="mock-dropdown">{children}</div>,
  Layout: {
    Header: ({ children }) => <header data-testid="mock-header">{children}</header>,
    Content: ({ children }) => <main data-testid="mock-content">{children}</main>
  },
  Menu: {
    Item: ({ children }) => <div data-testid="mock-menu-item">{children}</div>,
    Divider: () => null
  },
  Typography: {
    Title: ({ children }) => <h1>{children}</h1>,
    Paragraph: ({ children }) => <p>{children}</p>
  },
  Avatar: () => <div data-testid="mock-avatar" />,
  Spin: () => <div data-testid="mock-spinner">Loading...</div>,
  Button: ({ children, onClick }) => (
    <button data-testid="mock-button" onClick={onClick}>{children}</button>
  ),
  message: {
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn()
  },
  DatePicker: {
    RangePicker: () => <div data-testid="range-picker" />
  },
  Card: ({ children, title }) => (
    <div data-testid="mock-card">
      {title && <div>{title}</div>}
      {children}
    </div>
  ),
  Modal: ({ children, title, open, onOk, onCancel }) => (
    open ? (
      <div data-testid="mock-modal">
        {title && <div>{title}</div>}
        {children}
        <button onClick={onOk} data-testid="modal-ok">OK</button>
        <button onClick={onCancel} data-testid="modal-cancel">Cancel</button>
      </div>
    ) : null
  ),
  Space: ({ children }) => <div data-testid="mock-space">{children}</div>,
  Tag: ({ children }) => <div data-testid="mock-tag">{children}</div>,
  Select: Object.assign(
    ({ children, options, onChange, defaultValue }) => (
      <select 
        data-testid="mock-select" 
        onChange={e => onChange && onChange(e.target.value)} 
        defaultValue={defaultValue}
      >
        {options && options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
        {children}
      </select>
    ),
    { Option: ({ value, children }) => <option value={value}>{children}</option> }
  )
}));

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div data-testid="mock-browser-router">{children}</div>,
  Routes: ({ children }) => <div data-testid="mock-routes">{children}</div>,
  Route: ({ element }) => element,
  Link: ({ children, to }) => <a href={to} data-testid="mock-link">{children}</a>,
  Navigate: () => null,
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/', state: null })
}));

// Mock icons
jest.mock('@ant-design/icons', () => ({
  UserOutlined: () => <div data-testid="user-icon" />,
  LogoutOutlined: () => <div data-testid="logout-icon" />,
  MenuOutlined: () => <div data-testid="menu-icon" />,
  FileTextOutlined: () => <div data-testid="file-text-icon" />,
  DownloadOutlined: () => <div data-testid="download-icon" />,
  LineChartOutlined: () => <div data-testid="line-chart-icon" />
}));

// Mock AuthContext
jest.mock('./AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    loading: false,
    logout: jest.fn()
  })
}));

// Import App after mocking
import App from './App';

describe('App Component', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders without crashing', () => {
    const { container } = render(<App />);
    
    // Basic rendering checks
    expect(container).toBeTruthy();
    expect(screen.getByTestId('mock-browser-router')).toBeInTheDocument();
  });

  test('shows login page when not authenticated', () => {
    render(<App />);
    
    // Check for login-related elements
    const loginElements = screen.queryAllByText(/login/i);
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

    render(<App />);
    
    // Check for loading spinner
    expect(screen.getByTestId('mock-spinner')).toBeInTheDocument();
  });

  test('shows navigation menu when authenticated', async () => {
    // Mock authenticated state
    jest.spyOn(require('./AuthContext'), 'useAuth').mockImplementation(() => ({
      user: { username: 'testuser' },
      isAuthenticated: true,
      loading: false,
      logout: jest.fn()
    }));

    render(<App />);
    
    // Wait for potential async operations
    await waitFor(() => {
      // Check for key authenticated elements
      expect(screen.getByTestId('mock-header')).toBeInTheDocument();
      expect(screen.getByTestId('mock-content')).toBeInTheDocument();
      expect(screen.getByTestId('mock-avatar')).toBeInTheDocument();
    });
  });

  test('provides logout functionality', async () => {
    const mockLogout = jest.fn();
    
    // Mock authenticated state with logout function
    jest.spyOn(require('./AuthContext'), 'useAuth').mockImplementation(() => ({
      user: { username: 'testuser' },
      isAuthenticated: true,
      loading: false,
      logout: mockLogout
    }));

    render(<App />);
    
    // Find and interact with logout element
    await waitFor(() => {
      const logoutIcon = screen.getByTestId('logout-icon');
      expect(logoutIcon).toBeInTheDocument();
    });
  });
});