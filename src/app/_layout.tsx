import { Stack } from 'expo-router';
import * as React from 'react';
import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import '@/global.css';
import { CalendarProvider } from '@/context/calendar-context';

export default function RootLayout() {
  React.useEffect(() => {
    if (Platform.OS === 'web') {
      document.title = 'Actually Usable Calendar';
    }
  }, []);

  return (
    <CalendarProvider>
      {/* `dark` anchors NativeWind's dark: variants; our CSS variables are dark-first. */}
      <View className="dark flex-1 bg-background">
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'hsl(var(--background))' },
            animation: 'slide_from_right',
          }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="setup" />
          <Stack.Screen name="settings" />
        </Stack>
      </View>
    </CalendarProvider>
  );
}