import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { formatWeekLabel } from '@/lib/time';
import { Text } from '@/components/ui/text';

interface CalendarHeaderProps {
  currentWeek: Date;
  classLabel?: string;
  onPrev: () => void;
  onNext: () => void;
}

export function CalendarHeader({ currentWeek, classLabel, onPrev, onNext }: CalendarHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
      <View className="flex-1">
        {classLabel ? (
          <Text className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            {classLabel}
          </Text>
        ) : null}
        <Text className="text-lg font-bold">{formatWeekLabel(currentWeek)}</Text>
      </View>
      <View className="flex-row items-center gap-1">
        <Pressable
          onPress={onPrev}
          accessibilityLabel="Previous week"
          className="h-9 w-9 items-center justify-center rounded-md border border-border bg-secondary active:bg-accent">
          <ChevronLeft size={17} color="hsl(var(--foreground))" />
        </Pressable>
        <Pressable
          onPress={onNext}
          accessibilityLabel="Next week"
          className="h-9 w-9 items-center justify-center rounded-md border border-border bg-secondary active:bg-accent">
          <ChevronRight size={17} color="hsl(var(--foreground))" />
        </Pressable>
      </View>
    </View>
  );
}