import React from 'react';
import { View, StyleSheet } from 'react-native';
import Dashboard from '@/app/screens/Dashboard';

export default function DashboardTab() {
  return (
    <View style={styles.container}>
      <Dashboard />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});