// src/__tests__/CarbonFootprintCard.test.js
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import CarbonFootprintCard from '../CarbonFootprint';
import apiService from '../apiService';

// Mock the apiService
jest.mock('../apiService');

describe('CarbonFootprintCard Component', () => {
  const mockSensorData = {
    temperature: 24,
    humidity: 45,
    pressure: 1015,
    altitude: 100
  };
  
  const mockWaterFlow = 5.5;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  test('renders with loading state initially', () => {
    // Mock the API call to delay resolution
    apiService.getCarbonFootprint.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => {
        resolve({ data: { carbon_footprint: 65 } });
      }, 100);
    }));

    const { container } = render(<CarbonFootprintCard sensorData={mockSensorData} waterFlow={mockWaterFlow} />);
    
    // Check for title instead of specific text to avoid ambiguity
    const headings = container.querySelectorAll('.ant-card-head-title');
    const titles = Array.from(headings).map(h => h.textContent);
    
    // Check for any heading containing "CarbonFootprint"
    expect(titles.some(title => title.includes('CarbonFootprint'))).toBe(true);
    
    // Check if loading spinner is present
    expect(container.querySelector('.ant-spin')).toBeInTheDocument();
  });

  test('displays carbon footprint from API', async () => {
    // Mock a successful API response
    apiService.getCarbonFootprint.mockResolvedValue({
      data: { carbon_footprint: 65 }
    });

    render(<CarbonFootprintCard sensorData={mockSensorData} waterFlow={mockWaterFlow} />);
    
    // Wait for the API call to complete
    await waitFor(() => {
      expect(apiService.getCarbonFootprint).toHaveBeenCalled();
    });

    // Look for percentage text - use a more flexible approach
    await waitFor(() => {
      const percentTexts = screen.getAllByText(/\d+\.\d+%/, { exact: false });
      const hasExpectedValue = percentTexts.some(element => 
        element.textContent.includes('65') || element.textContent.includes('65.00')
      );
      expect(hasExpectedValue).toBe(true);
    });
    
    // Check for source text
    await waitFor(() => {
      const sourceTexts = screen.getAllByText(/Data from/i, { exact: false });
      const hasServerText = sourceTexts.some(element => 
        element.textContent.includes('server')
      );
      expect(hasServerText).toBe(true);
    });
  });

  test('calculates local footprint when API fails', async () => {
    // Mock a failed API response
    apiService.getCarbonFootprint.mockRejectedValue(new Error('API error'));

    render(<CarbonFootprintCard sensorData={mockSensorData} waterFlow={mockWaterFlow} />);
    
    // Wait for the component to update after the API error
    await waitFor(() => {
      expect(apiService.getCarbonFootprint).toHaveBeenCalled();
    });

    // Look for percentage text from local calculation (approximately 68.3%)
    await waitFor(() => {
      const percentTexts = screen.getAllByText(/\d+\.\d+%/, { exact: false });
      const hasExpectedValue = percentTexts.some(element => 
        element.textContent.includes('68.3') || 
        element.textContent.includes('68.30')
      );
      expect(hasExpectedValue).toBe(true);
    });
    
    // Check for local calculation text
    await waitFor(() => {
      const sourceTexts = screen.getAllByText(/Data from/i, { exact: false });
      const hasLocalText = sourceTexts.some(element => 
        element.textContent.includes('local')
      );
      expect(hasLocalText).toBe(true);
    });
  });

  test('handles case where API returns invalid data', async () => {
    // Mock an API response with missing carbon_footprint
    apiService.getCarbonFootprint.mockResolvedValue({
      data: { /* missing carbon_footprint */ }
    });

    render(<CarbonFootprintCard sensorData={mockSensorData} waterFlow={mockWaterFlow} />);
    
    // Wait for the component to update
    await waitFor(() => {
      expect(apiService.getCarbonFootprint).toHaveBeenCalled();
    });

    // Should fall back to local calculation
    await waitFor(() => {
      const sourceTexts = screen.getAllByText(/Data from/i, { exact: false });
      const hasLocalText = sourceTexts.some(element => 
        element.textContent.includes('local')
      );
      expect(hasLocalText).toBe(true);
    });
  });

  test('handles null sensor data or water flow', async () => {
    // Test with null sensor data
    const { rerender } = render(<CarbonFootprintCard sensorData={null} waterFlow={mockWaterFlow} />);
    
    // Should not crash and should render something
    expect(document.body.textContent).toBeTruthy();
    
    // Test with null water flow
    rerender(<CarbonFootprintCard sensorData={mockSensorData} waterFlow={null} />);
    
    // Should not crash and should render something
    expect(document.body.textContent).toBeTruthy();
  });
});