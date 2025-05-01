import React from 'react';
import { View, StyleSheet } from 'react-native';
import RoomMonitor from '@/app/screens/RoomMonitor';

export default function RoomsTab() {
  return (
    <View style={styles.container}>
      <RoomMonitor />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});