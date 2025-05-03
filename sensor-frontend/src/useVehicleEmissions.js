import { useState, useEffect } from 'react';
import apiService from './apiService';
import emissionsCalculator from './emissionsCalculator';

/**
 * Custom hook to fetch and process vehicle emissions data
 * @param {string} timeRange - Time range for data ('day', 'week', 'month')
 * @param {string} vehicleType - Vehicle type from emissionsCalculator.EMISSION_FACTORS
 * @returns {object} - Emissions data and loading state
 */
const useVehicleEmissions = (timeRange = 'day', vehicleType = 'DEFAULT') => {
    const [emissionsData, setEmissionsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchEmissionsData = async () => {
            setLoading(true);
            try {
                // Try to fetch from API first
                const response = await apiService.getVehicleEmissions(timeRange);
                setEmissionsData(response.data);
                setError(null);
            } catch (apiError) {
                console.error('Error fetching vehicle emissions from API:', apiError);
                setError('Using locally calculated emissions data');
                
                try {
                    // Fallback: Calculate emissions locally using movement data
                    const movementResponse = await apiService.getVehicleMovementHistory(
                        timeRange === 'day' ? 24 : 
                        timeRange === 'week' ? 168 : 
                        timeRange === 'month' ? 720 : 24
                    );
                    
                    // Extract distance from movement data or use a default
                    // This is simplified and would need actual distance calculation in production
                    const movementData = movementResponse.data;
                    const estimatedDistance = calculateDistanceFromMovementData(movementData);
                    
                    // Calculate emissions using our utility
                    const calculatedData = emissionsCalculator.calculateEmissionsData(
                        movementData,
                        estimatedDistance,
                        vehicleType
                    );
                    
                    // Add emission trend data (simplified version)
                    calculatedData.emission_trend = generateEmissionTrendData(timeRange);
                    
                    setEmissionsData(calculatedData);
                } catch (fallbackError) {
                    console.error('Error calculating emissions locally:', fallbackError);
                    setError('Could not calculate emissions data');
                    
                    // Last resort: use mock data
                    setEmissionsData(getMockEmissionsData(timeRange));
                }
            } finally {
                setLoading(false);
            }
        };

        fetchEmissionsData();
        // Update data regularly
        const interval = setInterval(fetchEmissionsData, 60000); // every minute
        return () => clearInterval(interval);
    }, [timeRange, vehicleType]);

    return { emissionsData, loading, error };
};

/**
 * Helper to estimate distance from movement data
 * This is a simplified placeholder - in a real implementation, 
 * you would need to use GPS data or a more sophisticated algorithm
 */
const calculateDistanceFromMovementData = (movementData) => {
    if (!movementData || !Array.isArray(movementData) || movementData.length === 0) {
        return 10; // Default fallback value
    }
    
    // Simple heuristic - this would be replaced by actual distance calculation
    // using GPS coordinates in a real implementation
    const movementPoints = movementData.length;
    const activeMovements = movementData.filter(d => 
        d.movement_type !== 'stationary' && d.accel_magnitude > 0.1
    ).length;
    
    // Rough estimate based on number of active movement points
    // Assuming average speed of 30 km/h and data points every 5 seconds
    const estimatedHours = (movementPoints * 5) / 3600; // convert seconds to hours
    const estimatedActiveRatio = activeMovements / movementPoints || 0.5;
    return Math.round(estimatedHours * 30 * estimatedActiveRatio * 10) / 10; // Round to 1 decimal
};

/**
 * Generate mock emission trend data for UI display
 */
const generateEmissionTrendData = (timeRange) => {
    const today = new Date();
    const trendData = [];
    
    const daysToGenerate = 
        timeRange === 'day' ? 7 :
        timeRange === 'week' ? 7 :
        timeRange === 'month' ? 30 : 7;
    
    for (let i = daysToGenerate - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        
        trendData.push({
            date: date.toISOString().split('T')[0],
            co2: (1.5 + Math.random() * 2).toFixed(1) * 1 // Generate random CO2 value between 1.5-3.5
        });
    }
    
    return trendData;
};

/**
 * Get mock emissions data for development/testing
 */
const getMockEmissionsData = (timeRange) => {
    return {
        total_co2: timeRange === 'day' ? 2.8 : timeRange === 'week' ? 19.6 : 84.2,
        average_co2_per_km: 142,
        distance_traveled: timeRange === 'day' ? 19.7 : timeRange === 'week' ? 138 : 593,
        fuel_efficiency: 8.2, 
        driving_efficiency_score: 72,
        eco_driving_events: {
            harsh_braking: timeRange === 'day' ? 3 : timeRange === 'week' ? 21 : 89,
            rapid_acceleration: timeRange === 'day' ? 5 : timeRange === 'week' ? 35 : 147,
            idle_time_minutes: timeRange === 'day' ? 12 : timeRange === 'week' ? 84 : 348
        },
        emission_trend: generateEmissionTrendData(timeRange)
    };
};

export default useVehicleEmissions;