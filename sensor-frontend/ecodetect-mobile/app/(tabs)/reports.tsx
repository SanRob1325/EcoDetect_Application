import React from 'react';
import { View, StyleSheet } from 'react-native';
import Reports from '@/app/screens/Reports';

export default function ReportsTab() {
  return (
    <View style={styles.container}>
      <Reports />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});