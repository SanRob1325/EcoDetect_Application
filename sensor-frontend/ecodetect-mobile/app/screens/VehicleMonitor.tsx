import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { Picker } from '@react-native-picker/picker';

import Card from '../components/Card';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/apiService';

interface VehicleMovementData {
  accel_magnitude: number;
  rotation_rate: number;
  movement_type: string;
  orientation: {
    pitch: number;
    roll: number;
    heading: number;
  };
  timestamp?: string;
  raw_data?: {
    acceleration: number[];
    gyroscope: number[];
    magnetometer: number[];
  };
}

const VehicleMonitor = () => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [movementData, setMovementData] = useState<VehicleMovementData | null>(null);
  const [historyData, setHistoryData] = useState<VehicleMovementData[]>([]);
  const [timeRange, setTimeRange] = useState<number>(1); // Default to 1 hour
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Fetch current movement data
  const fetchMovementData = useCallback(async () => {
    try {
      const response = await apiService.getVehicleMovement();
      setMovementData(response.data);
    } catch (error) {
      console.error('Error fetching vehicle movement data:', error);
    }
  }, []);

  // Fetch historical data
  const fetchHistoryData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiService.getVehicleMovementHistory(timeRange);
      setHistoryData(response.data);
    } catch (error) {
      console.error('Error fetching movement history:', error);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  // Initial data fetch
  useEffect(() => {
    fetchMovementData();
    fetchHistoryData();

    // Set up polling for current data
    const movementInterval = setInterval(fetchMovementData, 2000);
    
    // Set up polling for history data
    const historyInterval = setInterval(fetchHistoryData, 60000);

    return () => {
      clearInterval(movementInterval);
      clearInterval(historyInterval);
    };
  }, [fetchMovementData, fetchHistoryData]);

  // Refresh data when the screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchMovementData();
      fetchHistoryData();
    }, [fetchMovementData, fetchHistoryData])
  );

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchMovementData(), fetchHistoryData()]);
    setRefreshing(false);
  };

  // Helper function to get color based on movement type
  const getMovementColor = (movementType: string) => {
    const colorMap: Record<string, string> = {
      accelerating: colors.success,
      braking: colors.error,
      turning_left: colors.warning,
      turning_right: colors.warning,
      rough_road: '#722ed1',
      stationary: '#d9d9d9',
      steady_movement: colors.primary,
    };
    return colorMap[movementType] || colors.primary;
  };

  // Get compass direction from heading
  const getCompassDirection = (heading: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(heading / 45) % 8];
  };

  // Format movement type for display
  const formatMovementType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Prepare chart data
  const prepareChartData = () => {
    if (historyData.length === 0) return null;

    return {
      labels: historyData.map(data => {
        if (!data.timestamp) return '';
        const date = new Date(data.timestamp);
        return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
      }).filter((_, i) => i % Math.ceil(historyData.length / 6) === 0), // Show only 6 labels
      datasets: [
        {
          data: historyData.map(data => data.accel_magnitude),
          color: () => colors.primary,
          strokeWidth: 2
        },
        {
          data: historyData.map(data => data.rotation_rate),
          color: () => colors.success,
          strokeWidth: 2
        }
      ],
      legend: ['G-Force', 'Rotation']
    };
  };

  const chartData = prepareChartData();

  // Calculate safety metrics
  const calculateSafetyMetrics = () => {
    if (historyData.length === 0) return null;

    return {
      harshBraking: historyData.filter(d => 
        d.movement_type === 'braking' && d.accel_magnitude > 0.5
      ).length,
      rapidAcceleration: historyData.filter(d => 
        d.movement_type === 'accelerating' && d.accel_magnitude > 0.5
      ).length,
      roughRoad: historyData.filter(d => 
        d.movement_type === 'rough_road'
      ).length,
      totalPoints: historyData.length
    };
  };

  const safetyMetrics = calculateSafetyMetrics();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
      }
    >
      <Card title="Current Movement" style={styles.card}>
        {!movementData ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Waiting for vehicle data...
            </Text>
          </View>
        ) : (
          <View style={styles.currentMovementContainer}>
            <View style={styles.movementTypeContainer}>
              <Ionicons 
                name="car" 
                size={40} 
                color={getMovementColor(movementData.movement_type)} 
              />
              <Text style={[styles.movementTypeText, { color: colors.text }]}>
                {formatMovementType(movementData.movement_type)}
              </Text>
            </View>
            
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: colors.text }]}>G-Force</Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  {movementData.accel_magnitude.toFixed(2)}g
                </Text>
              </View>
              
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: colors.text }]}>Rotation</Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  {movementData.rotation_rate.toFixed(2)}°/s
                </Text>
              </View>
              
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: colors.text }]}>Heading</Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  {getCompassDirection(movementData.orientation.heading)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </Card>

      <Card title="Vehicle Orientation" style={styles.card}>
        {!movementData ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <View style={styles.orientationContainer}>
            <View style={styles.orientationItem}>
              <Text style={[styles.orientationLabel, { color: colors.text }]}>
                Pitch (Forward/Backward)
              </Text>
              <View style={styles.orientationGaugeContainer}>
                <View style={styles.orientationGauge}>
                  <View 
                    style={[
                      styles.orientationGaugeProgress, 
                      { 
                        width: `${Math.min(Math.abs(movementData.orientation.pitch) * 100 / 90, 100)}%`,
                        backgroundColor: Math.abs(movementData.orientation.pitch) > 20 ? 
                          colors.warning : colors.success
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.orientationValue, { color: colors.text }]}>
                  {movementData.orientation.pitch.toFixed(1)}°
                </Text>
                <Text style={[styles.orientationDirection, { color: colors.text }]}>
                  {movementData.orientation.pitch > 0 ? 'Uphill' : 'Downhill'}
                </Text>
              </View>
            </View>
            
            <View style={styles.orientationItem}>
              <Text style={[styles.orientationLabel, { color: colors.text }]}>
                Roll (Side to Side)
              </Text>
              <View style={styles.orientationGaugeContainer}>
                <View style={styles.orientationGauge}>
                  <View 
                    style={[
                      styles.orientationGaugeProgress, 
                      { 
                        width: `${Math.min(Math.abs(movementData.orientation.roll) * 100 / 90, 100)}%`,
                        backgroundColor: Math.abs(movementData.orientation.roll) > 20 ? 
                          colors.warning : colors.success
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.orientationValue, { color: colors.text }]}>
                  {movementData.orientation.roll.toFixed(1)}°
                </Text>
                <Text style={[styles.orientationDirection, { color: colors.text }]}>
                  {movementData.orientation.roll > 0 ? 'Tilted Right' : 'Tilted Left'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </Card>

      <Card title="Movement History" style={styles.card}>
        <View style={styles.historyControlsContainer}>
          <Text style={[styles.rangeLabel, { color: colors.text }]}>Time Range:</Text>
          <Picker
            selectedValue={timeRange}
            style={styles.rangePicker}
            onValueChange={(itemValue) => setTimeRange(itemValue)}
            dropdownIconColor={colors.primary}
          >
            <Picker.Item label="Last Hour" value={1} />
            <Picker.Item label="Last 6 Hours" value={6} />
            <Picker.Item label="Last 24 Hours" value={24} />
          </Picker>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.chartLoading} />
        ) : historyData.length === 0 ? (
          <View style={styles.noDataContainer}>
            <Ionicons name="analytics-outline" size={40} color={colors.text + '70'} />
            <Text style={[styles.noDataText, { color: colors.text }]}>
              No historical data available
            </Text>
          </View>
        ) : chartData ? (
          <View style={styles.chartContainer}>
            <LineChart
              data={chartData}
              width={width - 40}
              height={220}
              chartConfig={{
                backgroundColor: colors.card,
                backgroundGradientFrom: colors.card,
                backgroundGradientTo: colors.card,
                decimalPlaces: 1,
                color: (opacity = 1) => colors.text + (opacity * 255).toString(16).substring(0, 2),
                labelColor: () => colors.text,
                style: {
                  borderRadius: 16
                },
                propsForDots: {
                  r: '4',
                  strokeWidth: '1',
                }
              }}
              bezier
              style={styles.chart}
            />
            
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: colors.primary }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>G-Force</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: colors.success }]} />
                <Text style={[styles.legendText, { color: colors.text }]}>Rotation Rate</Text>
              </View>
            </View>
          </View>
        ) : null}
      </Card>

      <Card title="Drive Safety Analysis" style={styles.card}>
        {!safetyMetrics ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <View style={styles.safetyContainer}>
            <View style={styles.safetyMetric}>
              <View style={styles.safetyIconContainer}>
                <Ionicons name="alert-circle" size={24} color={colors.error} />
              </View>
              <View style={styles.safetyInfo}>
                <Text style={[styles.safetyLabel, { color: colors.text }]}>
                  Harsh Braking Events
                </Text>
                <Text style={[styles.safetyValue, { color: colors.error }]}>
                  {safetyMetrics.harshBraking}
                </Text>
              </View>
            </View>
            
            <View style={styles.safetyMetric}>
              <View style={styles.safetyIconContainer}>
                <Ionicons name="speedometer" size={24} color={colors.warning} />
              </View>
              <View style={styles.safetyInfo}>
                <Text style={[styles.safetyLabel, { color: colors.text }]}>
                  Rapid Acceleration Events
                </Text>
                <Text style={[styles.safetyValue, { color: colors.warning }]}>
                  {safetyMetrics.rapidAcceleration}
                </Text>
              </View>
            </View>
            
            <View style={styles.safetyMetric}>
              <View style={styles.safetyIconContainer}>
                <Ionicons name="trail-sign" size={24} color="#722ed1" />
              </View>
              <View style={styles.safetyInfo}>
                <Text style={[styles.safetyLabel, { color: colors.text }]}>
                  Rough Road Sections
                </Text>
                <Text style={[styles.safetyValue, { color: '#722ed1' }]}>
                  {safetyMetrics.roughRoad} / {safetyMetrics.totalPoints}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={[styles.tipButton, { backgroundColor: colors.primary }]}
              onPress={() => {}}
            >
              <Text style={styles.tipButtonText}>Driving Efficiency Tips</Text>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  currentMovementContainer: {
    padding: 10,
  },
  movementTypeContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  movementTypeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    marginBottom: 5,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  orientationContainer: {
    padding: 10,
  },
  orientationItem: {
    marginBottom: 20,
  },
  orientationLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  orientationGaugeContainer: {
    alignItems: 'center',
  },
  orientationGauge: {
    width: '100%',
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 5,
  },
  orientationGaugeProgress: {
    height: '100%',
  },
  orientationValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  orientationDirection: {
    fontSize: 14,
  },
  historyControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  rangeLabel: {
    fontSize: 16,
    marginRight: 10,
  },
  rangePicker: {
    flex: 1,
    height: 40,
  },
  chartLoading: {
    marginVertical: 40,
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 30,
  },
  noDataText: {
    marginTop: 10,
    fontSize: 16,
  },
  chartContainer: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 5,
  },
  legendText: {
    fontSize: 12,
  },
  safetyContainer: {
    padding: 10,
  },
  safetyMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  safetyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  safetyInfo: {
    flex: 1,
  },
  safetyLabel: {
    fontSize: 14,
    marginBottom: 2,
  },
  safetyValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  tipButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginRight: 5,
  },
});

export default VehicleMonitor;