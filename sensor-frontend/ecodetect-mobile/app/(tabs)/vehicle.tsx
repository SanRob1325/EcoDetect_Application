import React from 'react';
import { View, StyleSheet } from 'react-native';
import VehicleMonitor from '@/app/screens/VehicleMonitor';

export default function VehicleTab() {
  return (
    <View style={styles.container}>
      <VehicleMonitor />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});