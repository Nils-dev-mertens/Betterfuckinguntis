import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { CalendarScreen } from '@/components/calendar-screen';
import { useCalendar } from '@/context/calendar-context';
import { Text } from '@/components/ui/text';

export default function IndexScreen() {
  const { hydrated, data } = useCalendar();

  if (!hydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="hsl(var(--primary))" />
        <Text className="mt-3 text-sm text-muted-foreground">Loading your calendar…</Text>
      </View>
    );
  }

  if (data.timetables.length === 0) {
    return <Redirect href="/setup" />;
  }

  return <CalendarScreen />;
}