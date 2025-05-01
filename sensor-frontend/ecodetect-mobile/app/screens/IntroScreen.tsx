import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/app/context/ThemeContext';

const IntroScreen: React.FC = () => {
  const router = useRouter();
  const { colors } = useTheme();

  const handleGetStarted = () => {
    router.replace('/welcome');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.logoContainer}>
        <Ionicons name="leaf" size={100} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>EcoDetect</Text>
      </View>

      <View style={styles.contentContainer}>
        <Text style={[styles.subtitle, { color: colors.text }]}>
          Your Personal Environmental Monitoring Companion
        </Text>
        
        <View style={styles.featureContainer}>
          <View style={styles.featureItem}>
            <Ionicons name="thermometer-outline" size={24} color={colors.primary} />
            <Text style={[styles.featureText, { color: colors.text }]}>
              Real-time Sensor Monitoring
            </Text>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="analytics-outline" size={24} color={colors.primary} />
            <Text style={[styles.featureText, { color: colors.text }]}>
              Comprehensive Data Analysis
            </Text>
          </View>
          
          <View style={styles.featureItem}>
            <Ionicons name="planet-outline" size={24} color={colors.primary} />
            <Text style={[styles.featureText, { color: colors.text }]}>
              Eco-friendly Insights
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.getStartedButton, { backgroundColor: colors.primary }]}
        onPress={handleGetStarted}
      >
        <Text style={styles.getStartedText}>Get Started</Text>
        <Ionicons name="arrow-forward" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 100,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 16,
  },
  contentContainer: {
    alignItems: 'center',
    width: '100%',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  featureContainer: {
    width: '100%',
    alignItems: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    width: '80%',
  },
  featureText: {
    marginLeft: 16,
    fontSize: 16,
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: 16,
    borderRadius: 10,
    marginBottom: 24,
  },
  getStartedText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
});

export default IntroScreen;