import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import apiService from '../services/apiService';

// Define sensor data interface
export interface SensorData {
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  altitude: number | null;
  flow_rate?: number | null;
  imu?: {
    acceleration: number[];
    gyroscope: number[];
    magnetometer: number[];
  };
  timestamp?: string;
  location?: string;
  _id?: string;
}

// Define threshold interfaces
export interface Thresholds {
  temperature_range: number[];
  humidity_range: number[];
  flow_rate_threshold?: number;
}

// Define API context type
interface APIContextType {
  sensorData: SensorData | null;
  waterFlowData: { flow_rate: number; unit: string } | null;
  thresholds: Thresholds;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  updateThresholds: (newThresholds: Thresholds) => Promise<void>;
  lastUpdated: Date | null;
}

// Create the context
const APIContext = createContext<APIContextType | undefined>(undefined);

// API provider component
function APIProvider({ children }: { children: ReactNode }){
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [waterFlowData, setWaterFlowData] = useState<{ flow_rate: number; unit: string } | null>(null);
  const [thresholds, setThresholds] = useState<Thresholds>({
    temperature_range: [20, 25],
    humidity_range: [30, 60],
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch initial data
  useEffect(() => {
    refreshData();
    
    // Set up polling interval
    const interval = setInterval(() => {
      refreshData();
    }, 90000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Function to refresh all data
  const refreshData = async () => {
    setIsLoading(true);
    try {
      // Fetch sensor data
      const sensorResponse = await apiService.getSensorData();
      setSensorData(sensorResponse.data);
      
      // Fetch water usage data
      const waterResponse = await apiService.getWaterUsage();
      setWaterFlowData(waterResponse.data);
      
      // Fetch thresholds
      const thresholdResponse = await apiService.getThresholds();
      setThresholds(thresholdResponse.data);
      
      // Update last updated timestamp
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to update thresholds
  const updateThresholds = async (newThresholds: Thresholds) => {
    try {
      await apiService.setThresholds(newThresholds);
      setThresholds(newThresholds);
      return Promise.resolve();
    } catch (error) {
      console.error('Error updating thresholds:', error);
      return Promise.reject(error);
    }
  };

  return (
    <APIContext.Provider value={{
      sensorData,
      waterFlowData,
      thresholds,
      isLoading,
      refreshData,
      updateThresholds,
      lastUpdated
    }}>
      {children}
    </APIContext.Provider>
  );
};

// Custom hook to use the API context
export const useAPI = () => {
  const context = useContext(APIContext);
  if (context === undefined) {
    throw new Error('useAPI must be used within an APIProvider');
  }
  return context;
};

export default APIProvider;