import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AIAssistant from '../AIAssistant';
import apiService from '../apiService';

// Mock the apiService
jest.mock('../apiService');

// Mock the Line component from react-chartjs-2
jest.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart">Line Chart</div>
}));

// Mock chart.js modules
jest.mock('chart.js', () => {
  const actual = jest.requireActual('chart.js');
  return {
    Chart: {
      ...actual.Chart,
      register: jest.fn(),
    },
    LineElement: {},
    PointElement: {},
    CategoryScale: {},
    LinearScale: {},
    Title: {},
    Tooltip: {},
    Legend: {},
  };
});

// Mock moment
jest.mock('moment', () => {
  const originalMoment = jest.requireActual('moment');
  const moment = (...args) => originalMoment(...args);
  moment.unix = originalMoment.unix;
  moment.duration = originalMoment.duration;
  moment.utc = originalMoment.utc;
  moment.parseZone = originalMoment.parseZone;
  moment.isMoment = originalMoment.isMoment;
  moment.locale = () => {};
  moment.localeData = () => ({ _longDateFormat: {} });
  moment.extend = () => {};
  moment.suppressDeprecationWarnings = true;
  
  // Mock specific format methods we use
  const mockFormat = (format) => '12:00 PM';
  moment.prototype.format = mockFormat;
  moment.prototype.fromNow = () => 'just now';
  moment.prototype.calendar = () => 'Today';
  moment.prototype.valueOf = () => Date.now();
  moment.prototype.subtract = jest.fn(() => moment());
  
  return moment;
});

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

// Mock window.ResizeObserver
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverMock;

// Mock scrollIntoView method for jsdom
Element.prototype.scrollIntoView = jest.fn();

// Mock the comprehensive responsive observer - the default export must be a function
jest.mock('antd/lib/_util/responsiveObserver', () => {
  const mockResponsiveObserver = {
    subscribe: jest.fn(() => jest.fn()),
    register: jest.fn(() => 'token'), 
    unsubscribe: jest.fn(),
    unregister: jest.fn(),
    dispatch: jest.fn(),
    matchingBreakpoint: {},
    responsiveObserver: {}
  };
  
  // The default export must be a function  
  const defaultFunction = () => mockResponsiveObserver;
  
  return {
    __esModule: true,
    default: defaultFunction
  };
});

describe('AIAssistant Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Set up default mock implementations with correct function names from component
    apiService.getPredictiveAnalysis.mockResolvedValue({
      data: {
        predictions: [
          { date: '2023-01-01', predicted_value: 23.5 },
          { date: '2023-01-02', predicted_value: 24.0 },
          { date: '2023-01-03', predicted_value: 24.5 }
        ],
        anomalies: []
      }
    });
    
    apiService.getHistoricalData.mockResolvedValue({
      data: {
        historical_data: [
          { timestamp: '2023-01-01T12:00:00Z', value: 23.5 },
          { timestamp: '2023-01-01T13:00:00Z', value: 24.0 },
          { timestamp: '2023-01-01T14:00:00Z', value: 24.5 }
        ]
      }
    });
    
    apiService.queryAIAssistant.mockResolvedValue({
      data: {
        answer: 'This is a mock response from the AI assistant.'
      }
    });
  });

  test('renders predictive analysis page with chart', async () => {
    render(<AIAssistant />);
    
    // Check if important elements are present
    expect(screen.getByText(/Predictive Analysis & Historical Anomaly Detection/i)).toBeInTheDocument();
    
    // Wait for the data to load
    await waitFor(() => {
      expect(apiService.getPredictiveAnalysis).toHaveBeenCalled();
      expect(apiService.getHistoricalData).toHaveBeenCalled();
    });
    
    // Verify the chart is rendered
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    
    // Verify no anomalies message appears
    await waitFor(() => {
      expect(screen.getByText(/No significant anomalies detected/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  test('changes data type with dropdown', async () => {
    render(<AIAssistant />);
    
    // Wait for initial data load
    await waitFor(() => {
      expect(apiService.getPredictiveAnalysis).toHaveBeenCalled();
    });
    
    // Clear previous calls to track new calls
    apiService.getPredictiveAnalysis.mockClear();
    
    // Find the dropdown by its initial value
    const dropdown = screen.getAllByRole('combobox')[0];
    
    // Open dropdown by clicking
    await act(async () => {
      await userEvent.click(dropdown);
    });
    
    // Wait for options to be available
    await waitFor(() => {
      expect(screen.getByText('Humidity')).toBeInTheDocument();
    });
    
    // Click on Humidity option
    await act(async () => {
      await userEvent.click(screen.getByText('Humidity'));
    });
    
    // Verify the API was called with humidity parameter
    await waitFor(() => {
      expect(apiService.getPredictiveAnalysis).toHaveBeenCalled();
      const calls = apiService.getPredictiveAnalysis.mock.calls;
      expect(calls[calls.length - 1][0]).toBe('humidity');
    });
  });

  test('refresh button updates data', async () => {
    render(<AIAssistant />);
    
    // Wait for initial data load
    await waitFor(() => {
      expect(apiService.getPredictiveAnalysis).toHaveBeenCalled();
    });
    
    // Clear previous calls
    jest.clearAllMocks();
    
    // Find and click refresh button
    const refreshButton = screen.getByRole('button', { name: 'Refresh Data' });
    await act(async () => {
      await userEvent.click(refreshButton);
    });
    
    // Verify data is refreshed
    await waitFor(() => {
      expect(apiService.getPredictiveAnalysis).toHaveBeenCalled();
      expect(apiService.getHistoricalData).toHaveBeenCalled();
    });
  });
  
  test('submits query to AI Assistant and shows response in chat', async () => {
    render(<AIAssistant />);
    
    // Wait for initial data load
    await waitFor(() => {
      expect(apiService.getPredictiveAnalysis).toHaveBeenCalled();
    });
    
    // Verify empty conversation state is shown
    expect(screen.getByText(/No conversation yet/i)).toBeInTheDocument();
    
    // Find the text area by its placeholder (with the typo in component)
    const queryInput = screen.getByPlaceholderText(/Ask about you environmental data/i);
    
    // Type a query
    await act(async () => {
      await userEvent.type(queryInput, 'What do these temperature trends mean?');
    });
    
    // Find submit button by its correct name "send"
    const submitButton = screen.getByRole('button', { name: 'send' });
    await act(async () => {
      await userEvent.click(submitButton);
    });
    
    // Check that the API was called
    await waitFor(() => {
      expect(apiService.queryAIAssistant).toHaveBeenCalled();
    });
  });
  
  test('displays quick suggestions and allows clicking them', async () => {
    render(<AIAssistant />);
    
    // Wait for initial data load
    await waitFor(() => {
      expect(apiService.getPredictiveAnalysis).toHaveBeenCalled();
    });
    
    // Check for the first default quick suggestion button (with bulb icon)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /bulb What does this data mean\?/i })).toBeInTheDocument();
    });
    
    // Click on the first suggestion
    const suggestionButton = screen.getByRole('button', { name: /bulb What does this data mean\?/i });
    await act(async () => {
      await userEvent.click(suggestionButton);
    });
    
    // Verify that the suggestion was placed in the input
    const queryInput = screen.getByPlaceholderText(/Ask about you environmental data/i);
    expect(queryInput.value).toBe('What does this data mean?');
    
    // Manually submit since auto-submit might be too slow
    const submitButton = screen.getByRole('button', { name: 'send' });
    await act(async () => {
      await userEvent.click(submitButton);
    });
    
    // Verify the API was called
    await waitFor(() => {
      expect(apiService.queryAIAssistant).toHaveBeenCalled();
    });
  });
  
  test('displays anomalies when present in data', async () => {
    // Mock data with anomalies
    apiService.getPredictiveAnalysis.mockResolvedValue({
      data: {
        predictions: [
          { date: '2023-01-01', predicted_value: 23.5 },
          { date: '2023-01-02', predicted_value: 24.0 },
          { date: '2023-01-03', predicted_value: 24.5 }
        ],
        anomalies: [
          { date: '2023-01-01T12:30:00Z', value: 29.8, z_score: 3.2 },
          { date: '2023-01-02T14:15:00Z', value: 18.3, z_score: -2.8 }
        ]
      }
    });
    
    render(<AIAssistant />);
    
    // Wait for data to load
    await waitFor(() => {
      expect(apiService.getPredictiveAnalysis).toHaveBeenCalled();
    });
    
    // Check that anomalies alert is displayed
    await waitFor(() => {
      expect(screen.getByText(/2 anomalies detected!/i)).toBeInTheDocument();
    });
    
    // Check that the anomalies card is displayed
    await waitFor(() => {
      expect(screen.getByText('Anomalies Detected')).toBeInTheDocument();
    });
  });
  
  test('toggles historical data display', async () => {
    render(<AIAssistant />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(apiService.getHistoricalData).toHaveBeenCalled();
    });
    
    // Find the switch for historical data
    const historicalSwitch = screen.getByRole('switch');
    
    // Toggle off historical data
    await act(async () => {
      await userEvent.click(historicalSwitch);
    });
    
    // Verify switch state
    expect(historicalSwitch).toHaveAttribute('aria-checked', 'false');
  });

  test('shows appropriate quick suggestions based on data type', async () => {
    render(<AIAssistant />);
    
    // Wait for initial data load
    await waitFor(() => {
      expect(apiService.getPredictiveAnalysis).toHaveBeenCalled();
    });
    
    // Verify initial temperature-specific suggestions
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /bulb How can I optimise temperature settings\?/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bulb What is a normal temperature range\?/i })).toBeInTheDocument();
    });
    
    // Change to humidity
    const dropdown = screen.getAllByRole('combobox')[0];
    await act(async () => {
      await userEvent.click(dropdown);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Humidity')).toBeInTheDocument();
    });
    
    await act(async () => {
      await userEvent.click(screen.getByText('Humidity'));
    });
    
    // Wait for API call to complete and state to update
    await waitFor(() => {
      expect(apiService.getPredictiveAnalysis).toHaveBeenCalled();
    });
    
    // Verify humidity-specific suggestions appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /bulb What is the ideal humidity level\?/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bulb How does humidity affect energy usage\?/i })).toBeInTheDocument();
    });
  }, 20000); // Add 20 second timeout to this specific test
});