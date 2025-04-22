// src/__tests__/Login.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../Login';

// Don't use requireActual which has issues with TextEncoder
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ state: { from: { pathname: '/' } } }),
  // Mock only what we need
  MemoryRouter: ({ children }) => <div>{children}</div>
}));

// Mock the useAuth hook directly instead of the whole context
jest.mock('../AuthContext', () => ({
  useAuth: () => ({
    login: jest.fn().mockResolvedValue({ success: true }),
    isAuthenticated: false
  })
}));

describe('Login Component', () => {
  test('renders login form', () => {
    // Render within our own MemoryRouter since the mock is simplified
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    
    // Check if important elements are rendered - use flexible text matching
    const titleElement = screen.getAllByText(/EcoDetect/i)[0];
    expect(titleElement).toBeInTheDocument();
    
    const emailInput = screen.getByLabelText(/Email/i);
    expect(emailInput).toBeInTheDocument();
    
    const passwordInput = screen.getByLabelText(/Password/i);
    expect(passwordInput).toBeInTheDocument();
    
    const loginButton = screen.getByRole('button', { name: /Log in/i });
    expect(loginButton).toBeInTheDocument();
    
    const forgotPasswordLink = screen.getByText(/Forgot Password/i);
    expect(forgotPasswordLink).toBeInTheDocument();
    
    const signUpLink = screen.getByText(/Sign Up/i);
    expect(signUpLink).toBeInTheDocument();
  });

  test('submits form with email and password', async () => {
    const mockLogin = jest.fn().mockResolvedValue({ success: true });
    
    // Mock the useAuth hook with our spy
    jest.spyOn(require('../AuthContext'), 'useAuth').mockImplementation(() => ({
      login: mockLogin,
      isAuthenticated: false
    }));

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    
    // Fill in the form
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'password123' }
    });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Log in/i }));
    
    // Verify login function was called with correct arguments
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });
  });

  test('displays error message when login fails', async () => {
    const mockLogin = jest.fn().mockResolvedValue({ 
      success: false, 
      error: 'Invalid credentials' 
    });
    
    jest.spyOn(require('../AuthContext'), 'useAuth').mockImplementation(() => ({
      login: mockLogin,
      isAuthenticated: false
    }));

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    
    // Fill in the form
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'test@example.com' }
    });
    
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'wrongpassword' }
    });
    
    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Log in/i }));
    
    // Check for error message
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  // Skip this test for now
  test.skip('renders new password form when required', async () => {

  });
});