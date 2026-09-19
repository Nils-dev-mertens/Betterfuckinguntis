import { Stack } from 'expo-router';
import * as React from 'react';
import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import '@/global.css';
import { CalendarProvider } from '@/context/calendar-context';
import { ThemeProvider, useTheme } from '@/context/theme-context';
import { configureHandler } from '@/lib/notifications';

function RootNavigator() {
  const { isDark, style: themeStyle } = useTheme();

  React.useEffect(() => {
    // Foreground presentation for reminders; scheduled ones fire natively.
    configureHandler();
  }, []);

  return (
    // `dark` anchors NativeWind's dark: variants — our palettes are dark-first.
    <View className={`flex-1 bg-background ${isDark ? 'dark' : ''}`} style={themeStyle}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'hsl(var(--background))' },
          animation: 'slide_from_right',
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="intro" options={{ animation: 'fade' }} />
        <Stack.Screen name="setup" />
        <Stack.Screen name="settings" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  React.useEffect(() => {
    if (Platform.OS === 'web') {
      document.title = 'Actually Usable Calendar';
    }
  }, []);

  return (
    <ThemeProvider>
      <CalendarProvider>
        <RootNavigator />
      </CalendarProvider>
    </ThemeProvider>
  );
}
