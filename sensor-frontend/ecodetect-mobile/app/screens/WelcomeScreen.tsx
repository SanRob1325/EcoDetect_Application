import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/app/context/ThemeContext';

const WelcomeScreen: React.FC = () => {
  const router = useRouter();
  const { colors } = useTheme();

  const featuresList = [
    {
      icon: 'leaf-outline',
      title: 'Eco-friendly Monitoring',
      description: 'Track your environmental impact in real-time with advanced sensors.'
    },
    {
      icon: 'analytics-outline',
      title: 'Comprehensive Analysis',
      description: 'Detailed insights into temperature, humidity, water usage, and more.'
    },
    {
      icon: 'planet-outline',
      title: 'Smart Recommendations',
      description: 'AI-powered suggestions to reduce your carbon footprint.'
    }
  ];

  const handleGetStarted = () => {
    router.replace('/(tabs)/dashboard');
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.headerContainer}>
        <Ionicons name="leaf" size={80} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>Welcome to EcoDetect</Text>
        <Text style={[styles.subtitle, { color: colors.text }]}>
          Your Personal Environmental Monitoring Solution
        </Text>
      </View>

      <View style={styles.featuresContainer}>
        {featuresList.map((feature, index) => (
          <View 
            key={index} 
            style={[
              styles.featureItem, 
              { 
                backgroundColor: colors.card, 
                borderColor: colors.border 
              }
            ]}
          >
            <View style={styles.featureIconContainer}>
              <Ionicons 
                name={feature.icon} 
                size={30} 
                color={colors.primary} 
              />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={[styles.featureTitle, { color: colors.text }]}>
                {feature.title}
              </Text>
              <Text style={[styles.featureDescription, { color: colors.text }]}>
                {feature.description}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.howItWorksContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          How EcoDetect Works
        </Text>
        <View style={styles.stepContainer}>
          <View style={[styles.stepNumberContainer, { backgroundColor: colors.primary }]}>
            <Text style={styles.stepNumber}>1</Text>
          </View>
          <Text style={[styles.stepDescription, { color: colors.text }]}>
            Install sensors in key areas of your home or vehicle
          </Text>
        </View>
        <View style={styles.stepContainer}>
          <View style={[styles.stepNumberContainer, { backgroundColor: colors.primary }]}>
            <Text style={styles.stepNumber}>2</Text>
          </View>
          <Text style={[styles.stepDescription, { color: colors.text }]}>
            Connect to the EcoDetect mobile app
          </Text>
        </View>
        <View style={styles.stepContainer}>
          <View style={[styles.stepNumberContainer, { backgroundColor: colors.primary }]}>
            <Text style={styles.stepNumber}>3</Text>
          </View>
          <Text style={[styles.stepDescription, { color: colors.text }]}>
            Receive real-time insights and eco-friendly recommendations
          </Text>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.getStartedButton, { backgroundColor: colors.primary }]}
        onPress={handleGetStarted}
      >
        <Text style={styles.getStartedButtonText}>Explore Dashboard</Text>
        <Ionicons name="arrow-forward" size={24} color="white" />
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
    color: '#666',
  },
  featuresContainer: {
    marginBottom: 30,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
  },
  featureIconContainer: {
    marginRight: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
  },
  howItWorksContainer: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumberContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumber: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepDescription: {
    flex: 1,
    fontSize: 16,
  },
  getStartedButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
  },
  getStartedButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
});

export default WelcomeScreen;