import axios, { AxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';

// Define base URL based on platform
const BASE_URL = Platform.select({
    // ios: 'http://108.128.180.154:5000',
    // android: 'http://108.128.180.154:5000',
    // default: 'http://108.128.180.154:5000'
    ios: 'http://localhost:5000',
    android: 'http://192.168.116.123:5000',
    default: 'http://192.168.116.123:5000'
})

// Create axios instance with base URL configuration
const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 10000 // 10 second timeout
});

const apiService = {
    // Config helpers
    getBaseUrl: () => BASE_URL,

    // Sensor data
    getSensorData: () => api.get('/api/sensor-data'),
    getTemperatureTrends: (range = '24h') => api.get(`/api/temperature-trends?range=${range}`),
    getWaterUsage: () => api.get('/api/water-usage'),
    getCarbonFootprint: () => api.get('/api/carbon-footprint'),

    // Alerts and thresholds
    getAlerts: () => api.get('/api/alerts'),
    getThresholds: () => api.get('/api/get-thresholds'),
    setThresholds: (thresholds: any) => api.post('/api/set-thresholds', thresholds),
    getNotificationPreferences: () => api.get('/api/notification-preferences'),
    setNotificationPreferences: (preferences: any) => api.post('/api/notification-preferences', preferences),

    // AI assistant
    queryAIAssistant: (payload: any) => api.post('/api/ai-assistant', payload),

    // Predictive analysis
    getPredictiveAnalysis: (dataType = 'temperature', days = 7) =>
        api.get(`/api/predictive-analysis?data_type=${dataType}&days=${days}`),

    // Vehicle monitoring
    getVehicleMovement: () => api.get('/api/vehicle-movement'),
    getVehicleMovementHistory: (hours = 1) => api.get(`/api/vehicle-movement-history?hours=${hours}`),

    // Reports
    generateReport: (payload: any) => api.post('/api/reports', payload),
    previewReport: (payload: any) => api.post('/api/reports/preview', payload),

    // Room monitoring
    getRooms: () => api.get('/api/rooms'),
    getRoomSensorData: (room: string) => api.get(`/api/sensor-data/${room}`),

    // Historical data
    getHistoricalData: (dataType: string, days: number) =>
        api.get(`/api/historical-data?data_type=${dataType}&days=${days}`)
};

export default apiService;