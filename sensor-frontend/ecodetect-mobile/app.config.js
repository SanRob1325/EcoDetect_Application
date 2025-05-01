require('dotenv').config();

module.exports = {
  expo: {
    // Inherit original configuration from app.json
    ...require('./app.json').expo,
    
    // Add plugins
    plugins: [
      ...(require('./app.json').expo.plugins || []),
      'expo-secure-store'
    ],
    
    // Add extra configuration with environment variables
    extra: {
      cognito: {
        region: process.env.EXPO_PUBLIC_COGNITO_REGION || 'eu-west-1',
        userPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID || '',
        appClientId: process.env.EXPO_PUBLIC_COGNITO_APP_CLIENT_ID || ''
      },
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000'
    }
  }
};