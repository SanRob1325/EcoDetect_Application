/**
 * Utility service for calculating carbon emissions from vehicle movement data
 * This can be used as a fallback or to enhance frontend calculations
 */

// Standard emission factors by vehicle type (g CO2/km)
const EMISSION_FACTORS = {
    // Petrol/Gasoline vehicles
    SMALL_PETROL: 120,    // Small car
    MEDIUM_PETROL: 150,   // Medium car
    LARGE_PETROL: 180,    // Large car/SUV
    
    // Diesel vehicles
    SMALL_DIESEL: 110,    // Small car
    MEDIUM_DIESEL: 140,   // Medium car
    LARGE_DIESEL: 170,    // Large car/SUV
    
    // Hybrid vehicles
    SMALL_HYBRID: 90,     // Small hybrid
    MEDIUM_HYBRID: 110,   // Medium hybrid
    LARGE_HYBRID: 130,    // Large hybrid/SUV
    
    // Electric vehicles (based on grid mix)
    SMALL_EV: 30,         // Small EV
    MEDIUM_EV: 40,        // Medium EV
    LARGE_EV: 50,         // Large EV/SUV
    
    // Default for unknown vehicle types
    DEFAULT: 150          // Medium petrol car as default
};

/**
 * Calculate emissions from distance traveled
 * @param {number} distance - Distance traveled in kilometers
 * @param {string} vehicleType - Vehicle type from EMISSION_FACTORS keys
 * @returns {number} - CO2 emissions in kg
 */
const calculateEmissionsFromDistance = (distance, vehicleType = 'DEFAULT') => {
    const emissionFactor = EMISSION_FACTORS[vehicleType] || EMISSION_FACTORS.DEFAULT;
    return (distance * emissionFactor) / 1000; // Convert g to kg
};

/**
 * Calculate additional emissions from inefficient driving behaviors
 * @param {object} drivingBehavior - Object with driving behavior metrics
 * @param {number} drivingBehavior.harsh_braking - Count of harsh braking events
 * @param {number} drivingBehavior.rapid_acceleration - Count of rapid acceleration events
 * @param {number} drivingBehavior.idle_time_minutes - Minutes spent idling
 * @returns {number} - Additional CO2 emissions in kg
 */
const calculateBehaviorEmissions = (drivingBehavior) => {
    // Constants for behavior penalties
    const HARSH_BRAKING_PENALTY = 0.05;    // kg CO2 per event
    const RAPID_ACCEL_PENALTY = 0.08;      // kg CO2 per event
    const IDLE_PENALTY = 0.02;             // kg CO2 per minute idling

    let additionalEmissions = 0;
    
    if (drivingBehavior) {
        if (drivingBehavior.harsh_braking) {
            additionalEmissions += drivingBehavior.harsh_braking * HARSH_BRAKING_PENALTY;
        }
        
        if (drivingBehavior.rapid_acceleration) {
            additionalEmissions += drivingBehavior.rapid_acceleration * RAPID_ACCEL_PENALTY;
        }
        
        if (drivingBehavior.idle_time_minutes) {
            additionalEmissions += drivingBehavior.idle_time_minutes * IDLE_PENALTY;
        }
    }
    
    return additionalEmissions;
};

/**
 * Calculate driving efficiency score (0-100)
 * @param {object} drivingBehavior - Object with driving behavior metrics
 * @param {number} distance - Distance traveled in km
 * @returns {number} - Score from 0-100
 */
const calculateDrivingScore = (drivingBehavior, distance) => {
    if (!drivingBehavior || !distance || distance < 0.1) {
        return 50; // Default neutral score
    }

    // Base score
    let score = 80;
    
    // Per-km penalties (scaled by distance)
    const perKmEvents = {
        harsh_braking: (drivingBehavior.harsh_braking || 0) / distance,
        rapid_acceleration: (drivingBehavior.rapid_acceleration || 0) / distance,
        idle_ratio: (drivingBehavior.idle_time_minutes || 0) / (distance * 2) // Assuming 30km/h average speed
    };
    
    // Penalty points
    if (perKmEvents.harsh_braking > 0.5) score -= 15;
    else if (perKmEvents.harsh_braking > 0.2) score -= 7;
    
    if (perKmEvents.rapid_acceleration > 0.5) score -= 20;
    else if (perKmEvents.rapid_acceleration > 0.2) score -= 10;
    
    if (perKmEvents.idle_ratio > 0.3) score -= 10;
    else if (perKmEvents.idle_ratio > 0.1) score -= 5;
    
    // Ensure score is within range
    return Math.max(0, Math.min(100, score));
};

/**
 * Estimate idle time from movement data
 * @param {Array} movementData - Array of movement data points
 * @returns {number} - Estimated idle time in minutes
 */
const estimateIdleTime = (movementData) => {
    if (!movementData || !Array.isArray(movementData) || movementData.length === 0) {
        return 0;
    }
    
    // Count stationary events and convert to minutes
    // Assuming data points are collected approximately every few seconds
    const stationaryEvents = movementData.filter(d => 
        d.movement_type === 'stationary' || 
        (d.accel_magnitude < 0.05 && d.rotation_rate < 0.1)
    ).length;
    
    // Assuming each data point represents about 5 seconds
    return Math.round((stationaryEvents * 5) / 60);
};

/**
 * Comprehensive method to calculate all emissions metrics from movement data
 * @param {object} movementData - Vehicle movement data
 * @param {number} distance - Distance traveled in km
 * @param {string} vehicleType - Vehicle type
 * @returns {object} - Complete emissions data object
 */
const calculateEmissionsData = (movementData, distance, vehicleType = 'DEFAULT') => {
    // Extract driving behavior from movement data
    const drivingBehavior = {
        harsh_braking: movementData.filter(d => d.movement_type === 'braking' && d.accel_magnitude > 0.5).length,
        rapid_acceleration: movementData.filter(d => d.movement_type === 'accelerating' && d.accel_magnitude > 0.5).length,
        idle_time_minutes: estimateIdleTime(movementData)
    };
    
    // Calculate base emissions from distance
    const distanceEmissions = calculateEmissionsFromDistance(distance, vehicleType);
    
    // Calculate additional emissions from behavior
    const behaviorEmissions = calculateBehaviorEmissions(drivingBehavior);
    
    // Calculate total emissions
    const totalEmissions = distanceEmissions + behaviorEmissions;
    
    // Calculate efficiency score
    const drivingScore = calculateDrivingScore(drivingBehavior, distance);
    
    // Prepare and return the complete emissions data object
    return {
        total_co2: totalEmissions,
        distance_traveled: distance,
        average_co2_per_km: (totalEmissions * 1000) / distance, // Convert back to g/km
        driving_efficiency_score: drivingScore,
        eco_driving_events: drivingBehavior,
        emission_breakdown: {
            base_emissions: distanceEmissions,
            behavior_penalties: behaviorEmissions
        }
    };
};


const emissionsCalculator = {
    calculateEmissionsFromDistance,
    calculateBehaviorEmissions,
    calculateDrivingScore,
    calculateEmissionsData,
    EMISSION_FACTORS
};

export default emissionsCalculator;