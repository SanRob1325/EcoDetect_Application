import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Screens
import Dashboard from './app/screens/Dashboard';
import RoomMonitor from './app/screens/RoomMonitor';
import AIAssistant from './app/screens/AIAssistant';
import Settings from './app/screens/Settings';
import VehicleMonitor from './app/screens/VehicleMonitor';
import Reports from './app/screens/Reports';

// Theme and context
import ThemeProvider from './app/context/ThemeContext';
import APIProvider from './app/context/APIContext';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <APIProvider>
          <NavigationContainer>
            <StatusBar style="auto" />
            <Tab.Navigator
              screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                  let iconName;
                  if (route.name === 'Dashboard') {
                    iconName = focused ? 'home' : 'home-outline';
                  } else if (route.name === 'Rooms') {
                    iconName = focused ? 'grid' : 'grid-outline';
                  } else if (route.name === 'Assistant') {
                    iconName = focused ? 'chatbubble' : 'chatbubble-outline';
                  } else if (route.name === 'Vehicle') {
                    iconName = focused ? 'car' : 'car-outline';
                  } else if (route.name === 'Reports') {
                    iconName = focused ? 'document-text' : 'document-text-outline';
                  } else if (route.name === 'Settings') {
                    iconName = focused ? 'settings' : 'settings-outline';
                  }
                  return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: '#388E3C',
                tabBarInactiveTintColor: 'gray',
                headerStyle: {
                  backgroundColor: '#388E3C',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              })}
            >
              <Tab.Screen name="Dashboard" component={Dashboard} />
              <Tab.Screen name="Rooms" component={RoomMonitor} />
              <Tab.Screen name="Assistant" component={AIAssistant} />
              <Tab.Screen name="Vehicle" component={VehicleMonitor} />
              <Tab.Screen name="Reports" component={Reports} />
              <Tab.Screen name="Settings" component={Settings} />
            </Tab.Navigator>
          </NavigationContainer>
        </APIProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}