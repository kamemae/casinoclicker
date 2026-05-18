import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native'; // 1. Import Text from react-native

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '777',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🎰</Text>,
        }}
      />
      <Tabs.Screen
        name="coinflip"
        options={{
          title: 'Coin',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🪙</Text>,
        }}
      />
      <Tabs.Screen
        name="blackjack"
        options={{
          title: 'BJ',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>♠️</Text>,
        }}
      />
      <Tabs.Screen
        name="plinko"
        options={{
          title: 'Plinko (ERROR)',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🔺</Text>,
        }}
      />
      <Tabs.Screen
        name="roulette"
        options={{
          title: 'Roulette',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🟢</Text>,
        }}
      />
      <Tabs.Screen
        name="horserace"
        options={{
          title: 'Race',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🐴</Text>,
        }}
      />
      <Tabs.Screen
        name="chickenroads"
        options={{
          title: 'Roads',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🐔</Text>,
        }}
      />


      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}