// src/__mocks__/apiService.js
const mockApiService = {
    login: jest.fn().mockResolvedValue({ 
      data: { 
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh-token',
        idToken: 'mock-id-token'
      } 
    }),
    getSensorData: jest.fn().mockResolvedValue({ 
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
    }),
    getWaterUsage: jest.fn().mockResolvedValue({ 
      data: {
        flow_rate: 5.2,
        unit: 'L/min'
      }
    }),
    getCarbonFootprint: jest.fn().mockResolvedValue({ 
      data: {
        carbon_footprint: 45
      }
    }),
    getAlerts: jest.fn().mockResolvedValue({ 
      data: [
        {
          id: 1,
          timestamp: '2023-01-01T12:00:00Z',
          exceeded_thresholds: ['temperature'],
          message: 'Temperature threshold exceeded'
        }
      ]
    }),
    getThresholds: jest.fn().mockResolvedValue({ 
      data: {
        temperature_range: [20, 25],
        humidity_range: [30, 60],
        flow_rate_threshold: 10
      }
    }),
    setThresholds: jest.fn().mockResolvedValue({ data: { success: true } }),
    getNotificationPreferences: jest.fn().mockResolvedValue({ 
      data: {
        email_enabled: true,
        sms_enabled: true,
        critical_only: false
      }
    }),
    setNotificationPreferences: jest.fn().mockResolvedValue({ data: { success: true } }),
    getTemperatureTrends: jest.fn().mockResolvedValue({ 
      data: [
        { time: '12:00', temperature: 22.5 },
        { time: '13:00', temperature: 23.0 },
        { time: '14:00', temperature: 23.5 }
      ]
    }),
    getCo2Trends: jest.fn().mockResolvedValue({ 
      data: [
        { day: 'Monday', co2: 450 },
        { day: 'Tuesday', co2: 460 },
        { day: 'Wednesday', co2: 470 }
      ]
    }),
    queryAIAssistant: jest.fn().mockResolvedValue({ 
      data: {
        answer: 'This is a mock response from the AI assistant.'
      }
    }),
    getPredictiveAnalysis: jest.fn().mockResolvedValue({ 
      data: {
        predictions: [
          { date: '2023-01-01', predicted_value: 23.5 },
          { date: '2023-01-02', predicted_value: 24.0 },
          { date: '2023-01-03', predicted_value: 24.5 }
        ],
        anomalies: []
      }
    }),
    generateReport: jest.fn().mockResolvedValue({ 
      data: {
        success: true,
        download_url: 'http://example.com/report.pdf',
        email_sent: true
      }
    }),
    previewReport: jest.fn().mockResolvedValue({ 
      data: {
        success: true,
        data: {
          metadata: { data_points: 100 },
          summary: {
            temperature: { min: 20, max: 30, avg: 25, count: 24 },
            humidity: { min: 30, max: 70, avg: 50, count: 24 }
          }
        }
      }
    }),
    getRooms: jest.fn().mockResolvedValue({ 
      data: ['living_room', 'bedroom', 'kitchen', 'bathroom']
    }),
    getRoomSensorData: jest.fn().mockResolvedValue({ 
      data: {
        temperature: 23.5,
        humidity: 45,
        flow_rate: 2.5,
        timestamp: '2023-01-01T12:00:00Z'
      }
    }),
    getHistoricalData: jest.fn().mockResolvedValue({ 
      data: {
        historical_data: [
          { timestamp: '2023-01-01T12:00:00Z', value: 23.5 },
          { timestamp: '2023-01-01T13:00:00Z', value: 24.0 },
          { timestamp: '2023-01-01T14:00:00Z', value: 24.5 }
        ]
      }
    }),
    getVehicleMovement: jest.fn().mockResolvedValue({ 
      data: {
        movement_type: 'steady_movement',
        accel_magnitude: 0.2,
        rotation_rate: 1.5,
        orientation: {
          heading: 90,
          pitch: 5,
          roll: 2
        }
      }
    }),
    getVehicleMovementHistory: jest.fn().mockResolvedValue({ 
      data: [
        {
          timestamp: '2023-01-01T12:00:00Z',
          movement_type: 'steady_movement',
          accel_magnitude: 0.2,
          rotation_rate: 1.5
        }
      ]
    })
  };
  
  export default mockApiService;