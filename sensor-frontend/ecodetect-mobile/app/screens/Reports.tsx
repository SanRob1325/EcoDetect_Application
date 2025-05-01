import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import CheckBox from '@react-native-community/checkbox';
import * as WebBrowser from 'expo-web-browser';
import DateTimePicker from '@react-native-community/datetimepicker';

import Card from '../components/Card';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/apiService';

const Reports:  React.FC = () => {
  const { colors } = useTheme();
  const [timeRange, setTimeRange] = useState('daily');
  const [dataTypes, setDataTypes] = useState<string[]>(['temperature']);
  const [reportFormat, setReportFormat] = useState('pdf');
  const [selectedDateRange, setSelectedDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    end: new Date()
  });
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // Toggle data type selection
  const toggleDataType = (dataType: string) => {
    setDataTypes(current =>
      current.includes(dataType)
      ? current.filter(type => type !== dataType)
      : [...current, dataType]
    );
  };

  // Generate a report
  const generateReport = async () => {
    if (dataTypes.length === 0) {
      Alert.alert('Error', 'Please select at least one data type');
      return;
    }

    setLoading(true);

    try {
      // Prepare request payload
      const payload: any = {
        time_range: timeRange,
        data_types: dataTypes,
        format: reportFormat
      };

      // Add custom date range if selected
      if (timeRange === 'custom') {
        payload.custom_start = selectedDateRange.start.toISOString();
        payload.custom_end = selectedDateRange.end.toISOString();
      }

      // Send request to generate report
      const response = await apiService.generateReport(payload);

      if (response.data.success && response.data.download_url) {
        const url = response.data.download_url;
        
        // Show success message
        Alert.alert(
          'Report Generated',
          'Your report is ready to download',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Download',
              onPress: () => openReportUrl(url)
            }
          ]
        );
      } else {
        Alert.alert('Error', response.data.message || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      Alert.alert('Error', 'An error occurred while generating the report');
    } finally {
      setLoading(false);
    }
  };

  // Open report URL in browser
  const openReportUrl = async (url: string) => {
    try {
      if (await Linking.canOpenURL(url)) {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          // Use WebBrowser on mobile for better experience
          await WebBrowser.openBrowserAsync(url);
        } else {
          // Fallback to Linking
          await Linking.openURL(url);
        }
      } else {
        Alert.alert('Error', 'Cannot open URL');
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      Alert.alert('Error', 'Failed to open the report');
    }
  };

  // Handle date changes
  const onStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      setSelectedDateRange(prev => ({ ...prev, start: selectedDate }));
    }
  };

  const onEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      setSelectedDateRange(prev => ({ ...prev, end: selectedDate }));
    }
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString();
  };

  const CustomCheckbox = ({
    value,
    onValueChange,
    label
  } : {
    value: boolean,
    onValueChange: (newValue: boolean) => void,
    label: string
  }) => (
    <TouchableOpacity
      style={styles.checkboxContainer}
      onPress={() => onValueChange(!value)}
      >
        <View
          style={[
            styles.checkbox,
            value ? { backgroundColor: colors.primary } : {borderColor: colors.text, borderWidth: 2}
          ]}
        >
          {value && <Ionicons name="checkmark" color="white" size={16} />}         
        </View>
        <Text style={[styles.checkboxLabel, { color: colors.text }]}>{label}</Text>
      </TouchableOpacity>
  )

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Card title="Generate Environmental Report" style={styles.card}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Time Range</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={timeRange}
            onValueChange={(value) => setTimeRange(value)}
            style={[styles.picker, { color: colors.text }]}
            dropdownIconColor={colors.primary}
          >
            <Picker.Item label="Daily (Last 24 hours)" value="daily" />
            <Picker.Item label="Weekly (Last 7 days)" value="weekly" />
            <Picker.Item label="Monthly (Last 30 days)" value="monthly" />
            <Picker.Item label="Custom Range" value="custom" />
          </Picker>
        </View>

        {timeRange === 'custom' && (
          <View style={styles.datePickerContainer}>
            <View style={styles.dateRow}>
              <Text style={[styles.dateLabel, { color: colors.text }]}>Start Date:</Text>
              <TouchableOpacity
                onPress={() => setShowStartDatePicker(true)}
                style={[styles.dateButton, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.text }}>{formatDate(selectedDateRange.start)}</Text>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.dateRow}>
              <Text style={[styles.dateLabel, { color: colors.text }]}>End Date:</Text>
              <TouchableOpacity
                onPress={() => setShowEndDatePicker(true)}
                style={[styles.dateButton, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.text }}>{formatDate(selectedDateRange.end)}</Text>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {showStartDatePicker && (
              <DateTimePicker
                value={selectedDateRange.start}
                mode="date"
                display="default"
                onChange={onStartDateChange}
              />
            )}

            {showEndDatePicker && (
              <DateTimePicker
                value={selectedDateRange.end}
                mode="date"
                display="default"
                onChange={onEndDateChange}
              />
            )}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Types</Text>
        <View style={styles.checkboxContainer}>
          <CustomCheckbox
            value={dataTypes.includes('temperature')}
            onValueChange={() => toggleDataType('temperature')}
            label="Temperature"
          />
           
          <CustomCheckbox
            value={dataTypes.includes('humidity')}
            onValueChange={() => toggleDataType('humidity')}
            label="Humidity"
          />
          <CustomCheckbox
            value={dataTypes.includes('pressure')}
            onValueChange={() => toggleDataType('pressure')}
            label="Pressure"
            />

          <CustomCheckbox
            value={dataTypes.includes('water_usage')}
            onValueChange={() => toggleDataType('water_usage')}
            label="Water Usage"
          />

          <CustomCheckbox
            value={dataTypes.includes('all')}
            onValueChange={() => toggleDataType('all')}
            label="All Available Data"
          />           
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Report Format</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={reportFormat}
            onValueChange={(value) => setReportFormat(value)}
            style={[styles.picker, { color: colors.text }]}
            dropdownIconColor={colors.primary}
          >
            <Picker.Item label="PDF Document" value="pdf" />
            <Picker.Item label="CSV Spreadsheet" value="csv" />
            <Picker.Item label="JSON Data" value="json" />
          </Picker>
        </View>

        <TouchableOpacity
          style={[styles.generateButton, { backgroundColor: colors.primary }]}
          onPress={generateReport}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Generate Report</Text>
            </>
          )}
        </TouchableOpacity>
      </Card>

      <Card title="Report Types" style={styles.card}>
        <View style={styles.reportTypeContainer}>
          <TouchableOpacity 
            style={styles.reportTypeItem}
            onPress={() => {
              setTimeRange('daily');
              setDataTypes(['temperature', 'humidity']);
              setReportFormat('pdf');
              setTimeout(() => generateReport(), 500);
            }}
          >
            <View style={[styles.reportTypeIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="thermometer-outline" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.reportTypeName, { color: colors.text }]}>Climate Report</Text>
            <Text style={styles.reportTypeDesc}>Temperature and humidity analysis</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.reportTypeItem}
            onPress={() => {
              setTimeRange('weekly');
              setDataTypes(['water_usage']);
              setReportFormat('pdf');
              setTimeout(() => generateReport(), 500);
            }}
          >
            <View style={[styles.reportTypeIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="water-outline" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.reportTypeName, { color: colors.text }]}>Water Usage</Text>
            <Text style={styles.reportTypeDesc}>Water consumption patterns</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.reportTypeItem}
            onPress={() => {
              setTimeRange('monthly');
              setDataTypes(['all']);
              setReportFormat('pdf');
              setTimeout(() => generateReport(), 500);
            }}
          >
            <View style={[styles.reportTypeIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="analytics-outline" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.reportTypeName, { color: colors.text }]}>Complete Analysis</Text>
            <Text style={styles.reportTypeDesc}>Comprehensive environmental report</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxLabel: {
    fontSize: 16,

  },
  container: {
    flex: 1,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 16,
  },
  picker: {
    height: 50,
  },
  datePickerContainer: {
    marginBottom: 16,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dateLabel: {
    fontSize: 14,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    width: '70%',
  },
  checkboxContainer: {
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 16,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  reportTypeContainer: {
    flexDirection: 'column',
  },
  reportTypeItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  reportTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTypeName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  reportTypeDesc: {
    fontSize: 12,
    color: '#666',
  },
});

export default Reports;