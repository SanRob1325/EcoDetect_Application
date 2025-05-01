import React from 'react';
import { View, StyleSheet } from 'react-native';
import AIAssistant from '@/app/screens/AIAssistant';

export default function AssistantTab() {
  return (
    <View style={styles.container}>
      <AIAssistant />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});