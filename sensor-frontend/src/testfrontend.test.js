import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import '@testing-library/jest-dom/expect-expect';
import CarbonFootprintCard from './CarbonFootprint';
import {formatNumber} from './Dashboard';
import SettingsPage from './SettingsPage';
import RoomMonitor from './RoomMonitor';
import apiService from './apiService';
import ReportCard from './ReportCard';

// Mocking the API service
jest.mock('./apiService')
// Testing the number formatting function
test('formatNumber formats correctly with default numbering', () => {
    expect(formatNumber(10.123)).toBe('10.1')
    expect(formatNumber(null).toBe(null))
});

test('formatNumber formats correctly with custom precision', () => {
    expect(formatNumber(10.123, 2)).toBe('10.12');
});

// Test CarbonFootprintCard components
test('CarbonFootprintCard renders loading state', () => {
    const { getByText } = render(<CarbonFootprintCard sensorData={{}} waterFlow={null} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

test('CarbonFootprinCard calculates local footprint when API fails', () => {
    const mockSensorData = {
        temperature: 25,
        altitude: 100,
        pressure: 1010,
    };
    const mockWaterFlow = 5;

    render(<CarbonFootprintCard sensorData={mockSensorData} waterFlow={mockWaterFlow} />);

    //After calculation completes
    setTimeout(() => {
        expect(screen.getByText(/local calcuation/i)).toBeInTheDocument();
        // Expected result: (24 * 0.2) + (5 * 0.5) + (100 * 0.1) + (1010 * 0.05)
        const expectedValue = Math.min(Math.max(25*0.2 + 5*0.5 + 100*0.1 + 1010*0.05, 0), 100)
        expect(screen.getByText(new RegExp(`${expectedValue.toFixed(2)}%`, 'i'))).toBeInTheDocument()
    })
})

// Test Settings page
test('SettingsPage renders and updates correctly', async () => {
    // Mock the initial settings data
    apiService.getThresholds.mockResolvedValue({
        data: {
            temperature_range: [20, 25],
            humidity_range: [30, 60],
            flow_rate_threshold: 10
        }
    });

    apiService.getNotificationPreferences.mockResolvedValue({
        data: {
            email_enabled: true,
            sms_enabled: false,
            critical_only: true
        }
    });

    // Mock successful update
    apiService.setThresholds.mockResolvedValue({ data: {message: 'Success' }});
    apiService.setNotificationPreferences.mockResolvedValue({data: { message: 'Success' }});


    const { getByText, getByLabelText }  = render(<SettingsPage />);

    // Wait for data to load
    await waitFor(() => {
        expect(apiService.getThresholds).toHaveBeenCalled();
        expect(apiService.getNotificationPreferences).toHaveBeenCalled();
    });

    // Check initial values
    await waitFor(() => {
        expect(getByLabelText('Low Threshold (°C)')).toHaveBeenCalled('20');
        expect(getByLabelText('High Threshold (°C)')).toHaveBeenCalled('25');
    })

    // Change a setting and submit 
    fireEvent.change(getByLabelText('Low Threshold (°C)'), { target: { value: '18'}});
    fireEvent.click(getByText('Save Settings'));

    // Check that the API was called with updated values
    await waitFor(() => {
        expect(apiService.setThresholds).toHaveBeenCalledWith({
            temperature_range: [18, 25],
            humidity_range: [30, 60],
            flow_rate_threshold: 10
        });
    });
});

// Test RoomMonitor component
test('RoomMonitor fetches and displays room data', async () => {
    // Mock room list
    apiService.getRooms.mockResolvedValue({
        data: ['living_room', 'bedroom', 'kitchen']
    });

    // Mock room data
    apiService.getRoomSensorData.mockResolvedValue({
        data: {
            _id: 'abc123',
            temperature: 22.5,
            humidity: 45,
            flow_rate: 0,
            timestamp: '2025-01-01T12:00:00'
        }
    });

    const { getByText } = render(<RoomMonitor />);

    // Check that rooms are loaded
    await waitFor(() => {
        expect(apiService.getRooms).toHaveBeenCalled();
        expect(getByText('Living Room')).toBeInTheDocument();
        expect(getByText('Bedroom')).toBeInTheDocument();
        expect(getByText('Kitchen')).toBeInTheDocument();
    });

    // Check that room data is displayed
    await waitFor(() => {
        expect(apiService.getRoomSensorData).toHaveBeenCalled();
        expect(getByText('22.5°C')).toBeInTheDocument();
        expect(getByText('45%')).toBeInTheDocument();
    });

    // Test room switching
    fireEvent.click(getByText('Bedroom'));

    // Verify second room data is fetched
    await waitFor(() => {
        expect(apiService.getRoomSensorData).toHaveBeenCalledWith('bedroom')
    });
});

// Test Report Generator
test('ReportGenerator submits correct report request', async () => {
    // Mock API responses
    apiService.previewReport.mockResolvedValue({
        data: {
            success: true,
            data: {
                metadata: { data_points: 100},
                summary: {
                    temperature: { min: 20, max: 25, avg: 22.5, count: 50}
                }
            }
        }
    })

    apiService.generateReport.mockResolvedValue({
        data: {
            success: true,
            download_url: 'https://example.com/report.pdf'
        }
    });

    const {getByText, getByLabelText, getAllByRole } = render(<ReportCard />);

    // Select options
    const timeRangeSelect = getAllByRole('combobox')[0];
    fireEvent.change(timeRangeSelect, {target: {value: 'weekly'}});

    // Select data types
    const checkboxes = getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Temperature
    fireEvent.click(checkboxes[1]); // Humidity

    // Format selection
    const formatSelect = getAllByRole('combobox')[1];
    fireEvent.change(formatSelect, { target: { value: 'pdf'}});

    // Preview report
    const previewButton = getByText('Preview Report');
    fireEvent.click(previewButton);

    // Check preview API call
    await waitFor(() => {
        expect(apiService.previewReport).toHaveBeenCalledWith({
            time_range: 'weekly',
            data_types: ['temperature', 'humidity'],
            format: 'json'
        });
    });

    // Generate report
    const generateButton = getByText('Generate Report')
    fireEvent.click(generateButton);

    // Check generate API call
    await waitFor(() => {
        expect(apiService.generateReport).toHaveBeenCalledWith({
            time_range: 'weekly',
            data_types: ['temperature', 'humidity'],
            format: 'pdf',
            email: ''
        });
    });

    // Check download button appears
    await waitFor(() => {
        expect(getByText('Download Report')).toBeInTheDocument();
    })
})