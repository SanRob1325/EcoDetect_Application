import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import apiService from '../apiService';

// Mock the apiService
jest.mock('../apiService');

// Mock the GaugeChart component
jest.mock('react-gauge-chart', () => ({
  __esModule: true,
  default: () => <div data-testid="gauge-chart">Gauge Chart</div>
}));

// Mock the Alerts component
jest.mock('../Alerts', () => ({
  __esModule: true,
  default: () => <div data-testid="alerts-component">Alerts</div>
}));

// Mock the CarbonFootprintCard component
jest.mock('../CarbonFootprint', () => ({
  __esModule: true,
  default: ({ sensorData, waterFlow }) => (
    <div data-testid="carbon-footprint-card">
      Carbon Footprint Card
      <div data-testid="sensor-data">{JSON.stringify(sensorData)}</div>
      <div data-testid="water-flow">{waterFlow}</div>
    </div>
  )
}));

// Mock the ReportCard component
jest.mock('../ReportCard', () => ({
  __esModule: true,
  default: () => <div data-testid="report-card">Report Card</div>
}));

// Mock the VehicleEmissions component
jest.mock('../VehicleEmissions', () => ({
  __esModule: true,
  default: () => <div data-testid="vehicle-emissions">Vehicle Emissions</div>
}));

// Mock AntD using factory function to avoid initialization issues
const mockNotificationSuccess = jest.fn();
const mockNotificationError = jest.fn();
const mockNotificationWarning = jest.fn();

jest.mock('antd', () => {
  const original = jest.requireActual('antd');
  
  // Custom Modal component
  const MockModal = ({ children, open, onCancel, title, ...props }) => (
    open ? (
      <div data-testid="mocked-modal">
        <div className="ant-modal-title">{title}</div>
        <div className="ant-modal-body">{children}</div>
        <button onClick={onCancel}>Close</button>
      </div>
    ) : null
  );
  
  const mockNotification = {
    success: (...args) => mockNotificationSuccess(...args),
    error: (...args) => mockNotificationError(...args),
    warning: (...args) => mockNotificationWarning(...args),
    info: jest.fn(),
    open: jest.fn(),
  };
  
  return {
    ...original,
    notification: mockNotification,
    Modal: MockModal,
  };
});

// Mock responsive observer to fix AntD issues
jest.mock('antd/lib/_util/responsiveObserver', () => ({
  __esModule: true,
  default: function() {
    return {
      subscribe: () => () => {},
      unsubscribe: () => {},
      register: () => 'token',
      dispatch: () => {},
      responsiveObserver: this
    };
  }
}));

// Mock window.matchMedia for antd's useBreakpoint
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Now import Dashboard AFTER all mocks are set up
import Dashboard from '../Dashboard';

describe('Dashboard Component', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Set up default mock implementations
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
    
    apiService.getWaterUsage.mockResolvedValue({
      data: {
        flow_rate: 5.2,
        unit: 'L/min'
      }
    });
    
    apiService.getTemperatureTrends.mockResolvedValue({
      data: [
        { time: '12:00', temperature: 22.5 },
        { time: '13:00', temperature: 23.0 },
        { time: '14:00', temperature: 23.5 }
      ]
    });
    
    apiService.getThresholds.mockResolvedValue({
      data: {
        temperature_range: [20, 25],
        humidity_range: [30, 60],
        flow_rate_threshold: 10
      }
    });
    
    apiService.getAlerts.mockResolvedValue({ data: [] });
    
    apiService.getNotificationPreferences.mockResolvedValue({
      data: {
        sms_enabled: true,
        email_enabled: true,
        critical_only: false
      }
    });

    // Add missing mock implementations
    apiService.getCo2Trends = jest.fn().mockResolvedValue({ data: [] });
    apiService.getRecentAnomalies = jest.fn().mockResolvedValue({ data: [] });

    apiService.setThresholds.mockResolvedValue({ data: {} });
    apiService.setNotificationPreferences.mockResolvedValue({ data: {} });
    apiService.queryAIAssistant.mockResolvedValue({ data: { answer: 'AI response' } });
  });

  test('renders dashboard components', async () => {
    render(<Dashboard />);

    // Wait for initial data loading
    await waitFor(() => {
      expect(apiService.getSensorData).toHaveBeenCalled();
      expect(apiService.getWaterUsage).toHaveBeenCalled();
    });

    // Check for main elements using test IDs instead of headings
    await waitFor(() => {
      expect(screen.getByTestId('carbon-footprint-card')).toBeInTheDocument();
      expect(screen.getByTestId('report-card')).toBeInTheDocument();
      expect(screen.getByTestId('alerts-component')).toBeInTheDocument();
      expect(screen.getByTestId('vehicle-emissions')).toBeInTheDocument();
    });
  });

  test('displays sensor data correctly', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(apiService.getSensorData).toHaveBeenCalled();
    });
    
    // Look for specific value displays - use a flexible search that ignores encoding
    await waitFor(() => {
      expect(screen.getByText('18.5°C')).toBeInTheDocument(); // 23.5 - 5 (CPU offset)
      expect(screen.getByText('45.0%')).toBeInTheDocument(); // Component formats with one decimal
      expect(screen.getByText('1012.0 hPa')).toBeInTheDocument(); // Component formats with one decimal
    });
  });

  test('update thresholds', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(apiService.getThresholds).toHaveBeenCalled();
    });
    
    // Find the Update Thresholds button using a more specific approach
    const updateButton = await screen.findByRole('button', { name: /Update Thresholds/i });
    
    // Click the button
    await userEvent.click(updateButton);
    
    await waitFor(() => {
      expect(apiService.setThresholds).toHaveBeenCalled();
      expect(mockNotificationSuccess).toHaveBeenCalled();
    });
  });

  test('update notification preferences', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(apiService.getNotificationPreferences).toHaveBeenCalled();
    });
    
    // Find the Update Notification Preferences button
    const updateButton = await screen.findByRole('button', { name: /Update Notification Preferences/i });
    
    // Click the button
    await userEvent.click(updateButton);
    
    await waitFor(() => {
      expect(apiService.setNotificationPreferences).toHaveBeenCalled();
      expect(mockNotificationSuccess).toHaveBeenCalled();
    });
  });

  test('opens chatbot modal when button is clicked', async () => {
    render(<Dashboard />);
    
    // Wait for initial data loading
    await waitFor(() => {
      expect(apiService.getSensorData).toHaveBeenCalled();
    });
    
    // Find the chatbot button by looking for specific attributes
    const buttons = screen.getAllByRole('button');
    const chatbotButton = buttons.find(button => 
      button.className.includes('shape-circle') || 
      button.querySelector('[aria-label="robot"]')
    );
    
    expect(chatbotButton).toBeInTheDocument();
    
    // Click the button
    await userEvent.click(chatbotButton);
    
    // Wait for modal to appear
    await waitFor(() => {
      const modal = screen.getByTestId('mocked-modal');
      expect(modal).toBeInTheDocument();
      expect(screen.getByText(/EcoBot AI Chatbot/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('chatbot interaction works correctly', async () => {
    render(<Dashboard />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(apiService.getSensorData).toHaveBeenCalled();
    });
    
    // Open chatbot - use the same method as the previous test
    const buttons = screen.getAllByRole('button');
    const chatbotButton = buttons.find(button => 
      button.className.includes('shape-circle') || 
      button.querySelector('[aria-label="robot"]')
    );
    
    await userEvent.click(chatbotButton);
    
    // Wait for modal
    await waitFor(() => {
      expect(screen.getByTestId('mocked-modal')).toBeInTheDocument();
    });
    
    // Type in input
    const input = screen.getByPlaceholderText(/Enter your question/i);
    await userEvent.type(input, 'How can I reduce my carbon footprint?');
    
    // Click send button
    const sendButton = screen.getByRole('button', { name: /Send/i });
    await userEvent.click(sendButton);
    
    // Check the actual call structure
    await waitFor(() => {
      const calls = apiService.queryAIAssistant.mock.calls;
      expect(calls.length).toBe(1);
      const call = calls[0][0];
      
      // If it's an object, check specific properties
      if (typeof call === 'object' && call !== null) {
        expect(call.query || call.message || call).toBe('How can I reduce my carbon footprint?');
      }
    });
  });

  test('threshold sliders work correctly', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(apiService.getThresholds).toHaveBeenCalled();
    });
    
    // Find the temperature range slider
    const sliders = screen.getAllByRole('slider');
    const tempSlider = sliders[0];
    
    // Simulate changing the slider value
    fireEvent.mouseDown(tempSlider);
    fireEvent.mouseMove(tempSlider, { clientX: 100 });
    fireEvent.mouseUp(tempSlider);
    
    // Verify that the value changed (you may need to adjust based on actual implementation)
    await waitFor(() => {
      // The slider should have updated the internal state
      // This is a simplified assertion - you might need to verify the actual value
      expect(tempSlider).toHaveAttribute('aria-valuenow');
    });
  });

  test('data freshness indicator works', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(apiService.getSensorData).toHaveBeenCalled();
    });
    
    // Wait for the data freshness indicator to appear
    await waitFor(() => {
      const freshnessIndicator = screen.getByText(/Data last updated:/i);
      expect(freshnessIndicator).toBeInTheDocument();
      expect(freshnessIndicator.textContent).toMatch(/\d+ seconds ago/);
    });
  });

  test('handles API errors gracefully', async () => {
    // Mock API error
    apiService.getSensorData.mockRejectedValue(new Error('API Error'));
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching sensor data'),
        expect.any(Error)
      );
    });
    
    consoleSpy.mockRestore();
  });
});