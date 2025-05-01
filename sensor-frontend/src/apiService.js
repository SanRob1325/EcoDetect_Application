import axios from 'axios';

// Create axios instance with base URL configuration
const api = axios.create({
    baseURL: 'http://localhost:5000',
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor to add JWT token to every request
api.interceptors.request.use(
    async (config) => {
        // Get the token from localStorage
        const token = localStorage.getItem('accessToken');

        // If token exists, add it to the Authorization header
        if (token) {
            config.headers = {
                ...config.headers,
                'Authorization': `Bearer ${token}`
            };
            console.log('Adding token to request:', config.url);
        } else {
            console.warn('No token available for request:', config.url);
        }

        return config;
    },
    (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor for handling token refresh and authentication errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Check if error is due to authentication (401)
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
            console.log('Received 401 error, attempting to refresh token');
            originalRequest._retry = true;

            // Get refresh token
            const refreshToken = localStorage.getItem('refreshToken');

            if (!refreshToken) {
                console.error('No refresh token available');
                // Force logout
                handleLogout();
                return Promise.reject(error);
            }
            try {
                console.warn('Token refresh not implemented, logging out user');
                handleLogout();
                return Promise.reject(error);

            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                // If token refresh fails, log out
                handleLogout();
                return Promise.reject(refreshError);
            }
        }

        // Network or other errors
        if (!error.response) {
            console.error('Network or CORS error:', error.message);
        } else {
            console.error(`API Error ${error.response.status}:`, error.response.data);
        }

        return Promise.reject(error);
    }
);

// Helper function to handle logout
const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('idToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');

    // Redirect to login page
    window.location.href = '/login';
};

// Define API methods for different endpoints
const apiService = {
    // Authentication
    login: (credentials) => api.post('/api/login', credentials),

    // Sensor data
    getSensorData: () => api.get('/api/sensor-data'),
    getTemperatureTrends: (range = '24h') => api.get(`/api/temperature-trends?range=${range}`),
    getWaterUsage: () => api.get('/api/water-usage'),
    getCarbonFootprint: () => api.get('/api/carbon-footprint'),

    // Alerts and thresholds
    getAlerts: () => api.get('/api/alerts'),
    getThresholds: () => api.get('/api/get-thresholds'),
    setThresholds: (thresholds) => api.post('/api/set-thresholds', thresholds),
    getNotificationPreferences: () => api.get('/api/notification-preferences'),
    setNotificationPreferences: (preferences) => api.post('/api/notification-preferences', preferences),

    // AI assistant
    queryAIAssistant: (payload) => api.post('/api/ai-assistant', payload),

    // Predictive analysis
    getPredictiveAnalysis: (dataType = 'temperature', days = 7) =>
        api.get(`/api/predictive-analysis?data_type=${dataType}&days=${days}`),

    getVehicleMovement: () => api.get('api/vehicle-movement'),
    getVehicleMovementHistory: (hours = 1) => api.get(`/api/vehicle-movement-history?hours=${hours}`),
    generateReport: (payload) => api.post('/api/reports', payload),
    previewReport: (payload) => api.post('/api/reports/preview', payload),
    getRooms: () => api.get('/api/rooms'),
    getRoomSensorData: (room) => api.get(`/api/sensor-data/${room}`),
    getHistoricalData: (dataType, days) => api.get(`/api/historical-data?data_type=${dataType}&days=${days}`),

    // Anomaly Detection
    detectAnomalies: (sensorData) => api.post('/api/anomaly-detection', sensorData),
    getRecentAnomalies: (roomId) => api.get(`/api/recent-anomalies${roomId ? `?room_id=${roomId}` : ''}`),

    // Energy Optimisation
    getEnergyRecommendations: (roomId) => api.get(`/api/energy-optimiser/${roomId}/recommendations`),
    getEnergySavingsSummary: () => api.get('/api/energy-optimiser/savings-summary')
};

export default apiService;