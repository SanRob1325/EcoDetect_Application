import { rest } from 'msw';

export const handlers = [
  // Authentication
  rest.post('/api/login', (req, res, ctx) => {
    return res(
      ctx.json({
        accessToken: 'mock-token',
        user: { username: 'testuser', email: 'test@example.com' }
      })
    );
  }),

  // Sensor Data
  rest.get('/api/sensor-data', (req, res, ctx) => {
    return res(
      ctx.json({
        temperature: 22.5,
        humidity: 45.0,
        pressure: 1013.2,
        altitude: 50,
        imu: {
          acceleration: [0.1, 0.2, 0.3],
          gyroscope: [0.0, 0.0, 0.0],
          magnetometer: [20.5, 30.0, 40.0]
        },
        timestamp: new Date().toISOString()
      })
    );
  }),

  // Water Usage
  rest.get('/api/water-usage', (req, res, ctx) => {
    return res(
      ctx.json({
        flow_rate: 5.0,
        unit: 'L/min',
        timestamp: new Date().toISOString()
      })
    );
  }),

  // Alerts
  rest.get('/api/alerts', (req, res, ctx) => {
    return res(
      ctx.json([
        {
          id: 'alert-1',
          timestamp: new Date().toISOString(),
          severity: 'warning',
          exceeded_thresholds: ['temperature_high'],
          message: 'Temperature exceeded threshold'
        }
      ])
    );
  }),

  // Thresholds
  rest.get('/api/get-thresholds', (req, res, ctx) => {
    return res(
      ctx.json({
        temperature_range: [20, 25],
        humidity_range: [30, 60],
        flow_rate_threshold: 10
      })
    );
  }),

  // AI Assistant
  rest.post('/api/ai-assistant', (req, res, ctx) => {
    return res(
      ctx.json({
        answer: 'Based on your data, your temperature is within optimal range.'
      })
    );
  }),

  // Vehicle Movement
  rest.get('/api/vehicle-movement', (req, res, ctx) => {
    return res(
      ctx.json({
        movement_type: 'steady_movement',
        accel_magnitude: 0.3,
        rotation_rate: 0.1,
        orientation: {
          pitch: 0.5,
          roll: 0.2,
          heading: 45
        }
      })
    );
  }),

  // Predictive Analysis
  rest.get('/api/predictive-analysis', (req, res, ctx) => {
    return res(
      ctx.json({
        predictions: [
          { date: '2025-01-01', predicted_value: 23.0 }
        ],
        anomalies: []
      })
    );
  })
];