import { useRouter } from 'expo-router';
import * as React from 'react';
import { Dimensions, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useCalendar } from '@/context/calendar-context';

const SLIDES = [
  {
    icon: 'calendar' as const,
    title: 'Your timetable, always ready',
    body: 'Sync your class schedule straight from WebUntis once — everything is stored on your device, so the calendar works fully offline.',
  },
  {
    icon: 'layers' as const,
    title: 'Watch several classes',
    body: 'Add as many classes as you need, even across school years, and view them combined or filter to one with the chip row.',
  },
  {
    icon: 'edit-3' as const,
    title: 'Make it yours',
    body: 'Add your own lessons with weekly repeats, hide slots you never attend, and export everything as ICS or CSV.',
  },
  {
    icon: 'bell' as const,
    title: 'Never be late',
    body: 'Optional reminders buzz you before a lesson starts — pick 5, 10 or 15 minutes in Settings.',
  },
] as const;

export default function IntroScreen() {
  const router = useRouter();
  const { markIntroSeen } = useCalendar();
  const insets = useSafeAreaInsets();

  const [index, setIndex] = React.useState(0);
  const [width, setWidth] = React.useState(() => Dimensions.get('window').width);
  const scrollRef = React.useRef<ScrollView>(null);

  const finish = React.useCallback(async () => {
    await markIntroSeen();
    router.replace('/setup');
  }, [markIntroSeen, router]);

  const goTo = React.useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(SLIDES.length - 1, next));
      scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
      // Optimistic update — onScroll keeps it in sync while swiping.
      setIndex(clamped);
    },
    [width]
  );

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {/* Skip is available on every slide */}
      <View className="flex-row items-center justify-end px-4 pt-2">
        <Pressable onPress={() => void finish()} accessibilityLabel="Skip introduction" className="px-3 py-2">
          <Text className="text-sm font-medium text-muted-foreground">Skip</Text>
        </Pressable>
      </View>

      {/* `onScroll` (not onMomentumScrollEnd) — momentum events never fire on
          web, which used to freeze the walkthrough on the second slide. */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const page = Math.round(event.nativeEvent.contentOffset.x / width);
          setIndex(Math.max(0, Math.min(SLIDES.length - 1, page)));
        }}>
        {SLIDES.map((item) => (
          <View key={item.title} style={{ width }} className="items-center justify-center px-8">
            <View className="h-24 w-24 items-center justify-center rounded-3xl bg-primary/10">
              <Icon as={item.icon} size={44} color="hsl(var(--primary))" />
            </View>
            <Text variant="h2" className="mt-8 text-center border-b-0 pb-0">
              {item.title}
            </Text>
            <Text className="mt-3 text-center text-base leading-6 text-muted-foreground">{item.body}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Dots */}
      <View className="flex-row items-center justify-center gap-2 pb-4">
        {SLIDES.map((slide, i) => (
          <Pressable key={slide.title} onPress={() => goTo(i)} accessibilityLabel={`Go to slide ${i + 1}`}>
            <View
              className={`h-2 rounded-full ${i === index ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/40'}`}
            />
          </Pressable>
        ))}
      </View>

      <View className="flex-row items-center gap-3 px-6" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
        {index > 0 ? (
          <Button variant="outline" size="lg" className="flex-1" onPress={() => goTo(index - 1)}>
            <Text>Back</Text>
          </Button>
        ) : null}
        {index < SLIDES.length - 1 ? (
          <Button size="lg" className="flex-1" onPress={() => goTo(index + 1)}>
            <Text>Next</Text>
          </Button>
        ) : (
          <Button size="lg" className="flex-1" onPress={() => void finish()}>
            <Text>Get started</Text>
          </Button>
        )}
      </View>
    </View>
  );
}
