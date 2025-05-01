import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

import Card from '../components/Card';
import { useTheme } from '../context/ThemeContext';
import { useAPI } from '../context/APIContext';
import apiService from '../services/apiService';

const Settings = () => {
  const { colors, toggleTheme, theme } = useTheme();
  const { thresholds, updateThresholds } = useAPI();
  
  const [temperatureRange, setTemperatureRange] = useState([20, 25]);
  const [humidityRange, setHumidityRange] = useState([30, 60]);
  const [waterFlowThreshold, setWaterFlowThreshold] = useState(10);
  const [notificationPrefs, setNotificationPrefs] = useState({
    email_enabled: true,
    sms_enabled: true,
    critical_only: false
  });
  const [loading, setLoading] = useState(false);
  const [appVersion, setAppVersion] = useState('1.0.0');

  // Load settings from API
  useEffect(() => {
    // Initialize with thresholds from context
    setTemperatureRange([...thresholds.temperature_range]);
    setHumidityRange([...thresholds.humidity_range]);
    setWaterFlowThreshold(thresholds.flow_rate_threshold || 10);

    // Fetch notification preferences
    const fetchNotificationPrefs = async () => {
      try {
        const response = await apiService.getNotificationPreferences();
        setNotificationPrefs(response.data);
      } catch (error) {
        console.error('Error fetching notification preferences:', error);
      }
    };

    fetchNotificationPrefs();
  }, [thresholds]);

  // Format values for display
  const formatValue = (value: number, unit: string) => {
    return `${value.toFixed(1)}${unit}`;
  };

  // Save threshold settings
  const saveThresholds = async () => {
    setLoading(true);
    try {
      await updateThresholds({
        temperature_range: temperatureRange,
        humidity_range: humidityRange,
        flow_rate_threshold: waterFlowThreshold
      });
      Alert.alert('Success', 'Thresholds updated successfully');
    } catch (error) {
      console.error('Error updating thresholds:', error);
      Alert.alert('Error', 'Failed to update thresholds');
    } finally {
      setLoading(false);
    }
  };

  // Save notification preferences
  const saveNotificationPrefs = async () => {
    setLoading(true);
    try {
      await apiService.setNotificationPreferences(notificationPrefs);
      Alert.alert('Success', 'Notification preferences updated successfully');
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      Alert.alert('Error', 'Failed to update notification preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Card title="Appearance" style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Ionicons name="moon-outline" size={24} color={colors.primary} style={styles.settingIcon} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
          </View>
          <Switch
            value={theme === 'dark'}
            onValueChange={toggleTheme}
            trackColor={{ false: '#767577', true: colors.primary + '70' }}
            thumbColor={theme === 'dark' ? colors.primary : '#f4f3f4'}
          />
        </View>
      </Card>

      <Card title="Environmental Thresholds" style={styles.card}>
        <View style={styles.thresholdContainer}>
          <Text style={[styles.thresholdLabel, { color: colors.text }]}>
            Temperature Range ({formatValue(temperatureRange[0], '°C')} - {formatValue(temperatureRange[1], '°C')})
          </Text>
          <View style={styles.sliderContainer}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={40}
              step={0.5}
              value={temperatureRange[0]}
              onValueChange={(value) => setTemperatureRange([value, temperatureRange[1]])}
              minimumTrackTintColor={colors.background}
              maximumTrackTintColor={colors.primary}
              thumbTintColor={colors.primary}
            />
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={40}
              step={0.5}
              value={temperatureRange[1]}
              onValueChange={(value) => setTemperatureRange([temperatureRange[0], value])}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.background}
              thumbTintColor={colors.primary}
            />
          </View>

          <Text style={[styles.thresholdLabel, { color: colors.text }]}>
            Humidity Range ({formatValue(humidityRange[0], '%')} - {formatValue(humidityRange[1], '%')})
          </Text>
          <View style={styles.sliderContainer}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={humidityRange[0]}
              onValueChange={(value) => setHumidityRange([value, humidityRange[1]])}
              minimumTrackTintColor={colors.background}
              maximumTrackTintColor={colors.primary}
              thumbTintColor={colors.primary}
            />
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={humidityRange[1]}
              onValueChange={(value) => setHumidityRange([humidityRange[0], value])}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.background}
              thumbTintColor={colors.primary}
            />
          </View>

          <Text style={[styles.thresholdLabel, { color: colors.text }]}>
            Water Flow Threshold ({formatValue(waterFlowThreshold, ' L/min')})
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={20}
            step={0.5}
            value={waterFlowThreshold}
            onValueChange={setWaterFlowThreshold}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.background}
            thumbTintColor={colors.primary}
          />

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={saveThresholds}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save Thresholds</Text>
            )}
          </TouchableOpacity>
        </View>
      </Card>

      <Card title="Notifications" style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Ionicons name="mail-outline" size={24} color={colors.primary} style={styles.settingIcon} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Email Notifications</Text>
          </View>
          <Switch
            value={notificationPrefs.email_enabled}
            onValueChange={(value) => setNotificationPrefs({ ...notificationPrefs, email_enabled: value })}
            trackColor={{ false: '#767577', true: colors.primary + '70' }}
            thumbColor={notificationPrefs.email_enabled ? colors.primary : '#f4f3f4'}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Ionicons name="chatbubble-outline" size={24} color={colors.primary} style={styles.settingIcon} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>SMS Notifications</Text>
          </View>
          <Switch
            value={notificationPrefs.sms_enabled}
            onValueChange={(value) => setNotificationPrefs({ ...notificationPrefs, sms_enabled: value })}
            trackColor={{ false: '#767577', true: colors.primary + '70' }}
            thumbColor={notificationPrefs.sms_enabled ? colors.primary : '#f4f3f4'}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingLabelContainer}>
            <Ionicons name="warning-outline" size={24} color={colors.primary} style={styles.settingIcon} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Critical Alerts Only</Text>
          </View>
          <Switch
            value={notificationPrefs.critical_only}
            onValueChange={(value) => setNotificationPrefs({ ...notificationPrefs, critical_only: value })}
            trackColor={{ false: '#767577', true: colors.primary + '70' }}
            thumbColor={notificationPrefs.critical_only ? colors.primary : '#f4f3f4'}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={saveNotificationPrefs}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Notification Settings</Text>
          )}
        </TouchableOpacity>
      </Card>

      <Card title="About" style={styles.card}>
        <View style={styles.aboutContainer}>
          <View style={styles.logoContainer}>
            <Ionicons name="leaf" size={48} color={colors.primary} />
            <Text style={[styles.appName, { color: colors.text }]}>EcoDetect Mobile</Text>
          </View>
          
          <Text style={[styles.versionText, { color: colors.text }]}>Version {appVersion}</Text>
          
          <View style={styles.aboutRow}>
            <Ionicons name="code-outline" size={20} color={colors.primary} style={styles.aboutIcon} />
            <Text style={[styles.aboutText, { color: colors.text }]}>
              Environmental monitoring app for the Raspberry Pi Sense HAT
            </Text>
          </View>
          
          <View style={styles.aboutRow}>
            <Ionicons name="server-outline" size={20} color={colors.primary} style={styles.aboutIcon} />
            <Text style={[styles.aboutText, { color: colors.text }]}>
              Connected to backend API at {apiService.getBaseUrl?.() || "localhost:5000"}
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
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
  },
  thresholdContainer: {
    padding: 10,
  },
  thresholdLabel: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  sliderContainer: {
    marginBottom: 20,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  aboutContainer: {
    padding: 20,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  versionText: {
    fontSize: 14,
    marginBottom: 20,
  },
  aboutRow: {
    flexDirection: 'row',
    marginBottom: 12,
    width: '100%',
  },
  aboutIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  aboutText: {
    fontSize: 14,
    flex: 1,
  },
});

export default Settings;