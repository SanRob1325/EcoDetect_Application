import React from 'react';
import { View, StyleSheet } from 'react-native';
import Settings from '@/app/screens/Settings';

export default function SettingsTab() {
  return (
    <View style={styles.container}>
      <Settings />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});