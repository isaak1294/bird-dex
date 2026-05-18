import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

import { AppProvider } from './src/AppContext';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import BirddexScreen from './src/screens/BirddexScreen';
import BirdDetailScreen from './src/screens/BirdDetailScreen';
import QuizScreen from './src/screens/QuizScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import type { RootTabParamList, BirdDexStackParamList } from './src/types';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<BirdDexStackParamList>();

function BirdDexStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BirdDexHome" component={BirddexScreen} />
      <Stack.Screen name="BirdDetail" component={BirdDetailScreen} />
    </Stack.Navigator>
  );
}

function BirdTabIcon({ focused, color }: { focused: boolean; color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 100 100">
      <Path
        d="M50 18 C28 18 12 34 12 52 C12 63 18 73 28 79 L20 92 L36 83 C40 85 45 86 50 86 C72 86 88 70 88 52 C88 34 72 18 50 18 Z"
        fill={color}
      />
      <Circle cx="38" cy="44" r="5" fill="rgba(255,255,255,0.6)" />
    </Svg>
  );
}

function QuizTabIcon({ focused, color }: { focused: boolean; color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Rect x="3" y="3" width="7" height="7" rx="1.5" fill={color} />
      <Rect x="14" y="3" width="7" height="7" rx="1.5" fill={color} opacity={focused ? 1 : 0.6} />
      <Rect x="3" y="14" width="7" height="7" rx="1.5" fill={color} opacity={focused ? 1 : 0.6} />
      <Rect x="14" y="14" width="7" height="7" rx="1.5" fill={color} />
    </Svg>
  );
}

function ProfileTabIcon({ focused, color }: { focused: boolean; color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Circle cx="12" cy="8" r="4" fill={color} />
      <Path
        d="M4 20 C4 15.6 7.6 12 12 12 C16.4 12 20 15.6 20 20"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function AppTabs() {
  const C = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: C.header }}>
      <StatusBar style="light" backgroundColor={C.header} />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: C.accent,
          tabBarInactiveTintColor: C.textMuted,
          tabBarStyle: {
            backgroundColor: C.tabBar,
            borderTopColor: C.tabBorder,
            borderTopWidth: 1,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        <Tab.Screen
          name="BirdDexTab"
          component={BirdDexStack}
          options={{
            title: 'BirdDex',
            tabBarIcon: ({ focused, color }) => <BirdTabIcon focused={focused} color={color} />,
          }}
        />
        <Tab.Screen
          name="QuizTab"
          component={QuizScreen}
          options={{
            title: 'Quiz',
            tabBarIcon: ({ focused, color }) => <QuizTabIcon focused={focused} color={color} />,
          }}
        />
        <Tab.Screen
          name="ProfileTab"
          component={ProfileScreen}
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused, color }) => <ProfileTabIcon focused={focused} color={color} />,
          }}
        />
      </Tab.Navigator>
    </View>
  );
}

export default function App() {
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    }).catch(() => {});
  }, []);

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AppProvider>
          <NavigationContainer>
            <AppTabs />
          </NavigationContainer>
        </AppProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
