import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import ThemeProvider from '@/app/context/ThemeContext';
import APIProvider from '@/app/context/APIContext';
import { StatusBar } from 'expo-status-bar';


export default function RootLayout() {
  return (
    <ThemeProvider>
      <APIProvider>
        <StatusBar style="auto" />
        <Stack 
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right'
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              headerShown: false
            }}
          />
          {/* Welcome screen */}
          <Stack.Screen 
            name="welcome"
            options={{
              headerShown: false
            }}
          />
          {/* Tab navigation */}
          <Stack.Screen 
            name="(tabs)" 
            options={{ 
              headerShown: false 
            }} 
          />
        </Stack>
      </APIProvider>
    </ThemeProvider>
  );
}

