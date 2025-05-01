import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Switch
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import Card from '../components/Card';
import Gauge from '../components/Gauge';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/apiService';

interface RoomData {
  room_id?: string;
  temperature?: number;
  humidity?: number;
  flow_rate?: number;
  pressure?: number;
  timestamp?: string;
  location?: string;
  _id?: string;
}

const RoomMonitor = () => {
  const { colors } = useTheme();
  const [rooms, setRooms] = useState<string[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enabledRooms, setEnabledRooms] = useState<Record<string, boolean>>({});

  // Fetch list of rooms
  const fetchRooms = useCallback(async () => {
    try {
      const response = await apiService.getRooms();
      setRooms(response.data);

      // Initialize enabled rooms
      const initialEnabledState: Record<string, boolean> = {};
      response.data.forEach((room: string) => {
        initialEnabledState[room] = true;
      });
      setEnabledRooms(initialEnabledState);

      // Set default selected room
      if (response.data.length > 0 && !selectedRoom) {
        setSelectedRoom(response.data[0]);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  }, [selectedRoom]);

  // Fetch data for the selected room
  const fetchRoomData = useCallback(async () => {
    if (!selectedRoom || !enabledRooms[selectedRoom]) {
      setRoomData(null);
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.getRoomSensorData(selectedRoom);
      setRoomData(response.data);
    } catch (error) {
      console.error(`Error fetching data for room ${selectedRoom}:`, error);
      setRoomData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedRoom, enabledRooms]);

  // Fetch initial data when the screen loads
  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Fetch room data when selected room changes
  useEffect(() => {
    fetchRoomData();
    const interval = setInterval(fetchRoomData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [fetchRoomData]);

  // Refresh data when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchRooms();
      fetchRoomData();
    }, [fetchRooms, fetchRoomData])
  );

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRoomData();
    setRefreshing(false);
  };

  // Toggle room enabled/disabled state
  const toggleRoomStatus = (room: string) => {
    setEnabledRooms(prev => ({
      ...prev,
      [room]: !prev[room]
    }));

    // If disabling the currently selected room, switch to another enabled room
    if (room === selectedRoom) {
      const nextEnabledRoom = Object.keys(enabledRooms).find(
        r => r !== room && enabledRooms[r]
      );
      if (nextEnabledRoom) {
        setSelectedRoom(nextEnabledRoom);
      }
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
      }
    >
      {/* Room Selector */}
      <Card title="Select Room" style={styles.pickerCard}>
        <Picker
          selectedValue={selectedRoom}
          onValueChange={(itemValue) => setSelectedRoom(itemValue)}
          style={[styles.picker, { color: colors.text }]}
          dropdownIconColor={colors.primary}
        >
          {rooms.map((room) => (
            <Picker.Item
              key={room}
              label={room.charAt(0).toUpperCase() + room.slice(1)}
              value={room}
              color={enabledRooms[room] ? colors.text : colors.text + '50'}
              enabled={enabledRooms[room]}
            />
          ))}
        </Picker>
      </Card>

      {/* Room Controls */}
      <Card style={styles.controlsCard}>
        <View style={styles.controlsRow}>
          <Text style={[styles.controlLabel, { color: colors.text }]}>
            Room Status:
          </Text>
          <View style={styles.controlsRow}>
            <Text style={[styles.controlValue, { color: colors.text }]}>
              {selectedRoom && enabledRooms[selectedRoom] ? 'Enabled' : 'Disabled'}
            </Text>
            {selectedRoom && (
              <Switch
                value={selectedRoom ? enabledRooms[selectedRoom] : false}
                onValueChange={() => toggleRoomStatus(selectedRoom)}
                trackColor={{ false: '#767577', true: colors.primary + '70' }}
                thumbColor={selectedRoom && enabledRooms[selectedRoom] ? colors.primary : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
                style={{ marginLeft: 8 }}
              />
            )}
          </View>
        </View>
      </Card>

      {/* Room Data */}
      {selectedRoom ? (
        enabledRooms[selectedRoom] ? (
          loading && !roomData ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.text }]}>Loading room data...</Text>
            </View>
          ) : !roomData ? (
            <Card style={styles.noDataCard}>
              <View style={styles.noDataContainer}>
                <Ionicons name="alert-circle-outline" size={48} color={colors.text} />
                <Text style={[styles.noDataText, { color: colors.text }]}>
                  No data available for this room
                </Text>
              </View>
            </Card>
          ) : (
            <>
              {/* Temperature and Humidity Card */}
              <Card title="Temperature & Humidity" style={styles.dataCard}>
                <View style={styles.gaugeRow}>
                  <View style={styles.gaugeContainer}>
                    <Gauge
                      value={roomData.temperature !== undefined ? roomData.temperature : null}
                      minValue={15}
                      maxValue={30}
                      unit="°C"
                      title="Temperature"
                      size={120}
                    />
                  </View>
                  <View style={styles.gaugeContainer}>
                    <Gauge
                      value={roomData.humidity !== undefined ? roomData.humidity : null}
                      minValue={0}
                      maxValue={100}
                      unit="%"
                      title="Humidity"
                      size={120}
                    />
                  </View>
                </View>
              </Card>

              {/* Water Flow Card */}
              <Card title="Water Flow" style={styles.dataCard}>
                <View style={styles.waterFlowContainer}>
                  <Ionicons name="water-outline" size={36} color={colors.primary} />
                  <Text style={[styles.flowRateValue, { color: colors.text }]}>
                    {roomData.flow_rate !== undefined ? 
                      `${roomData.flow_rate.toFixed(1)} L/min` : 'No water data'}
                  </Text>
                  {roomData.flow_rate !== undefined && (
                    <View style={styles.flowRateIndicator}>
                      <View style={styles.flowRateBar}>
                        <View 
                          style={[
                            styles.flowRateProgress, 
                            { 
                              width: `${Math.min((roomData.flow_rate / 20) * 100, 100)}%`,
                              backgroundColor: roomData.flow_rate > 10 ? colors.error : colors.success
                            }
                          ]} 
                        />
                      </View>
                      <View style={styles.flowRateLabels}>
                        <Text style={styles.flowRateLabel}>0</Text>
                        <Text style={styles.flowRateLabel}>10</Text>
                        <Text style={styles.flowRateLabel}>20</Text>
                      </View>
                    </View>
                  )}
                </View>
              </Card>

              {/* Room Status Card */}
              <Card title="Room Status" style={styles.dataCard}>
                <View style={styles.statusContainer}>
                  <View style={styles.statusRow}>
                    <Text style={[styles.statusLabel, { color: colors.text }]}>Last Updated:</Text>
                    <Text style={[styles.statusValue, { color: colors.text }]}>
                      {formatTimestamp(roomData.timestamp)}
                    </Text>
                  </View>

                  <View style={styles.statusRow}>
                    <Text style={[styles.statusLabel, { color: colors.text }]}>Location:</Text>
                    <Text style={[styles.statusValue, { color: colors.text }]}>
                      {roomData.location || selectedRoom}
                    </Text>
                  </View>

                  <View style={styles.statusRow}>
                    <Text style={[styles.statusLabel, { color: colors.text }]}>Overall Status:</Text>
                    <View style={styles.statusIndicatorContainer}>
                      <View 
                        style={[
                          styles.statusIndicator, 
                          { 
                            backgroundColor: 
                              (roomData.temperature !== undefined && (roomData.temperature > 25 || roomData.temperature < 18)) ||
                              (roomData.humidity !== undefined && (roomData.humidity > 70 || roomData.humidity < 30)) ||
                              (roomData.flow_rate !== undefined && roomData.flow_rate > 10)
                                ? colors.error
                                : colors.success
                          }
                        ]} 
                      />
                      <Text style={[styles.statusIndicatorText, { color: colors.text }]}>
                        {(roomData.temperature !== undefined && (roomData.temperature > 25 || roomData.temperature < 18)) ||
                        (roomData.humidity !== undefined && (roomData.humidity > 70 || roomData.humidity < 30)) ||
                        (roomData.flow_rate !== undefined && roomData.flow_rate > 10)
                          ? 'Needs Attention'
                          : 'Optimal'}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            </>
          )
        ) : (
          <Card style={styles.disabledCard}>
            <View style={styles.disabledContainer}>
              <Ionicons name="power-outline" size={48} color={colors.text + '70'} />
              <Text style={[styles.disabledText, { color: colors.text }]}>
                This room is currently disabled
              </Text>
              <TouchableOpacity
                style={[styles.enableButton, { backgroundColor: colors.primary }]}
                onPress={() => toggleRoomStatus(selectedRoom)}
              >
                <Text style={styles.enableButtonText}>Enable Room</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )
      ) : (
        <Card style={styles.noRoomsCard}>
          <View style={styles.noRoomsContainer}>
            <Ionicons name="home-outline" size={48} color={colors.text} />
            <Text style={[styles.noRoomsText, { color: colors.text }]}>
              No rooms available to monitor
            </Text>
          </View>
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pickerCard: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  controlsCard: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  controlValue: {
    fontSize: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  noDataCard: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  noDataContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noDataText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  dataCard: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  gaugeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  gaugeContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  waterFlowContainer: {
    alignItems: 'center',
    padding: 16,
  },
  flowRateValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  flowRateIndicator: {
    width: '100%',
    marginTop: 8,
  },
  flowRateBar: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  flowRateProgress: {
    height: '100%',
  },
  flowRateLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  flowRateLabel: {
    fontSize: 12,
    color: '#666',
  },
  statusContainer: {
    padding: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusValue: {
    fontSize: 16,
  },
  statusIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusIndicatorText: {
    fontSize: 16,
  },
  disabledCard: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  disabledContainer: {
    padding: 40,
    alignItems: 'center',
  },
  disabledText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  enableButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  enableButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  noRoomsCard: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  noRoomsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noRoomsText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default RoomMonitor;