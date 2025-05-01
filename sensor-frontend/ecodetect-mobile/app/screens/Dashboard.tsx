import React, { useCallback, useState } from 'react';
import { 
  View, 
  ScrollView, 
  Text, 
  StyleSheet, 
  RefreshControl, 
  ActivityIndicator,
  useWindowDimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// Components
import Card from '../components/Card';
import Gauge from '../components/Gauge';

// Contexts
import { useTheme } from '../context/ThemeContext';
import { useAPI } from '../context/APIContext';

const Dashboard = () => {
  const { colors } = useTheme();
  const { sensorData, waterFlowData, thresholds, isLoading, refreshData, lastUpdated } = useAPI();
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();

  // Refresh data when the screen is focused
  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  // Format time since last update
  const formatTimeSinceUpdate = () => {
    if (!lastUpdated) return 'Never';
    
    const seconds = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds} seconds ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    return `${Math.floor(seconds / 3600)} hours ago`;
  };

  // Calculate gauge values based on thresholds
  const getTempGaugeValues = () => {
    if (!sensorData || sensorData.temperature === null) return { min: 0, max: 40, value: null };
    const [min, max] = thresholds.temperature_range;
    return { min, max, value: sensorData.temperature };
  };

  const getHumidityGaugeValues = () => {
    if (!sensorData || sensorData.humidity === null) return { min: 0, max: 100, value: null };
    const [min, max] = thresholds.humidity_range;
    return { min, max, value: sensorData.humidity };
  };

  const getWaterFlowValues = () => {
    if (!waterFlowData) return { min: 0, max: 20, value: null };
    return { min: 0, max: 20, value: waterFlowData.flow_rate };
  };

  // Carbon footprint calculation
  const calculateCarbonFootprint = () => {
    if (!sensorData) return 0;
    
    let footprint = 0;
    
    if (sensorData.temperature !== null) {
      footprint += sensorData.temperature * 0.2;
    }
    
    if (waterFlowData?.flow_rate) {
      footprint += waterFlowData.flow_rate * 0.5;
    }
    
    if (sensorData.altitude !== null) {
      footprint += sensorData.altitude * 0.1;
    }
    
    if (sensorData.pressure !== null) {
      footprint += sensorData.pressure * 0.05;
    }
    
    return Math.min(Math.max(footprint, 0), 100);
  };

  const carbonFootprint = calculateCarbonFootprint();

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
      }
    >
      {/* Last Updated Info */}
      <View style={styles.lastUpdatedContainer}>
        <Text style={[styles.lastUpdatedText, { color: colors.text }]}>
          Last updated: {formatTimeSinceUpdate()}
        </Text>
      </View>
      
      {/* Carbon Footprint Card */}
      <Card 
        title="Carbon Footprint" 
        style={styles.card}
      >
        <View style={styles.carbonFootprintContainer}>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar, 
                { 
                  width: `${carbonFootprint}%`,
                  backgroundColor: carbonFootprint > 70 
                    ? colors.error 
                    : carbonFootprint > 40 
                      ? colors.warning 
                      : colors.success
                }
              ]} 
            />
          </View>
          <Text style={[styles.carbonFootprintValue, { color: colors.text }]}>
            {carbonFootprint.toFixed(1)}% Environmental Impact
          </Text>
        </View>
      </Card>
      
      {/* Main Sensors Row */}
      <View style={styles.row}>
        {/* Temperature Card */}
        <Card 
          title="Temperature" 
          style={[styles.card, { width: width / 2.2 }]}
        >
          {isLoading && !sensorData ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <Gauge
              {...getTempGaugeValues()}
              title=""
              unit="°C"
              size={120}
            />
          )}
        </Card>
        
        {/* Humidity Card */}
        <Card 
          title="Humidity" 
          style={[styles.card, { width: width / 2.2 }]}
        >
          {isLoading && !sensorData ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <Gauge
              {...getHumidityGaugeValues()}
              title=""
              unit="%"
              size={120}
            />
          )}
        </Card>
      </View>
      
      {/* Secondary Sensors Row */}
      <View style={styles.row}>
        {/* Pressure Card */}
        <Card 
          title="Pressure" 
          style={[styles.card, { width: width / 2.2 }]}
        >
          {isLoading && !sensorData ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <View style={styles.infoContainer}>
              <Ionicons name="cloudy-outline" size={24} color={colors.primary} />
              <Text style={[styles.valueText, { color: colors.text }]}>
                {sensorData?.pressure !== null ? `${sensorData?.pressure.toFixed(1)} hPa` : 'N/A'}
              </Text>
            </View>
          )}
        </Card>
        
        {/* Water Flow Card */}
        <Card 
          title="Water Flow" 
          style={[styles.card, { width: width / 2.2 }]}
        >
          {isLoading && !waterFlowData ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <View style={styles.infoContainer}>
              <Ionicons name="water-outline" size={24} color={colors.primary} />
              <Text style={[styles.valueText, { color: colors.text }]}>
                {waterFlowData?.flow_rate !== undefined ? 
                  `${waterFlowData.flow_rate.toFixed(1)} ${waterFlowData.unit || 'L/min'}` : 'N/A'}
              </Text>
              {waterFlowData?.flow_rate !== undefined && thresholds.flow_rate_threshold && (
                <Text style={{ 
                  color: waterFlowData.flow_rate > thresholds.flow_rate_threshold ? 
                    colors.error : colors.success,
                  fontSize: 12,
                  marginTop: 4
                }}>
                  {waterFlowData.flow_rate > thresholds.flow_rate_threshold ? 
                    'Above threshold' : 'Normal usage'}
                </Text>
              )}
            </View>
          )}
        </Card>
      </View>

      {/* IMU Data Card */}
      <Card title="IMU Data" style={styles.card}>
        {isLoading && !sensorData ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : sensorData?.imu ? (
          <View style={styles.imuContainer}>
            <View style={styles.imuRow}>
              <Text style={[styles.imuLabel, { color: colors.text }]}>Acceleration:</Text>
              <Text style={[styles.imuValue, { color: colors.text }]}>
                {sensorData.imu.acceleration.map(val => val.toFixed(2)).join(', ')} m/s²
              </Text>
            </View>
            <View style={styles.imuRow}>
              <Text style={[styles.imuLabel, { color: colors.text }]}>Gyroscope:</Text>
              <Text style={[styles.imuValue, { color: colors.text }]}>
                {sensorData.imu.gyroscope.map(val => val.toFixed(2)).join(', ')} °/s
              </Text>
            </View>
            <View style={styles.imuRow}>
              <Text style={[styles.imuLabel, { color: colors.text }]}>Magnetometer:</Text>
              <Text style={[styles.imuValue, { color: colors.text }]}>
                {sensorData.imu.magnetometer.map(val => val.toFixed(2)).join(', ')} μT
              </Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.noDataText, { color: colors.text }]}>No IMU data available</Text>
        )}
      </Card>

      {/* Information Card */}
      <Card title="Eco Tips" style={styles.card}>
        <View style={styles.tipsContainer}>
          <View style={styles.tipRow}>
            <Ionicons name="bulb-outline" size={24} color={colors.primary} style={styles.tipIcon} />
            <Text style={[styles.tipText, { color: colors.text }]}>
              Maintaining indoor temperature between {thresholds.temperature_range[0]}°C and {thresholds.temperature_range[1]}°C can reduce energy consumption.
            </Text>
          </View>
          <View style={styles.tipRow}>
            <Ionicons name="water-outline" size={24} color={colors.primary} style={styles.tipIcon} />
            <Text style={[styles.tipText, { color: colors.text }]}>
              Keep water flow below {thresholds.flow_rate_threshold || 10} L/min to conserve water resources.
            </Text>
          </View>
          <View style={styles.tipRow}>
            <Ionicons name="leaf-outline" size={24} color={colors.primary} style={styles.tipIcon} />
            <Text style={[styles.tipText, { color: colors.text }]}>
              Optimal humidity levels between {thresholds.humidity_range[0]}% and {thresholds.humidity_range[1]}% improve air quality and reduce energy needs.
            </Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 8,
  },
  lastUpdatedContainer: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  lastUpdatedText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  card: {
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 8,
  },
  carbonFootprintContainer: {
    alignItems: 'center',
    padding: 10,
  },
  progressBarContainer: {
    width: '100%',
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
  },
  carbonFootprintValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
  },
  infoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  valueText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  noDataText: {
    textAlign: 'center',
    padding: 20,
    fontStyle: 'italic',
  },
  imuContainer: {
    padding: 10,
  },
  imuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  imuLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  imuValue: {
    fontSize: 14,
  },
  tipsContainer: {
    padding: 5,
  },
  tipRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  tipIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default Dashboard;