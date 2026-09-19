import * as React from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import {
  View,
  TextInput,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import {
  Icon as ChevronDown,
  Icon as ChevronLeft,
  Icon as ChevronRight,
  Icon as Clock,
  Icon as Repeat,
  Icon as X,
} from '@/components/ui/icon';
import { useCalendar } from '@/context/calendar-context';
import { useTheme } from '@/context/theme-context';
import type { Lesson } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const STEP_MINUTES = 15;

/** Swatches offered when picking a custom color for the lesson. */
const COLOR_CHOICES = [
  { hex: '#8b5cf6', name: 'Violet' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#06b6d4', name: 'Cyan' },
  { hex: '#10b981', name: 'Emerald' },
  { hex: '#84cc16', name: 'Lime' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#f97316', name: 'Orange' },
  { hex: '#ef4444', name: 'Red' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#6366f1', name: 'Indigo' },
] as const;

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

interface AddLessonSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (lesson: Omit<Lesson, 'uid' | 'manual'>) => Promise<void>;
}

function minutesToLabel(minutes: number): string {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function Stepper({
  value,
  onChange,
  min,
  max,
  testIDPrefix,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  testIDPrefix: string;
}) {
  const clamp = (next: number) => Math.max(min, Math.min(max, next));
  return (
    <View className="flex-1 flex-row items-center gap-1">
      <Pressable
        onPress={() => onChange(clamp(value - STEP_MINUTES))}
        accessibilityLabel={`${testIDPrefix} earlier`}
        className="h-9 w-8 items-center justify-center rounded-md bg-secondary active:bg-accent">
        <Text className="text-base font-bold text-secondary-foreground">−</Text>
      </Pressable>
      <View className="flex-1 items-center rounded-md border border-border bg-background py-1.5">
        <Text className="text-sm font-semibold tabular-nums">{minutesToLabel(value)}</Text>
      </View>
      <Pressable
        onPress={() => onChange(clamp(value + STEP_MINUTES))}
        accessibilityLabel={`${testIDPrefix} later`}
        className="h-9 w-8 items-center justify-center rounded-md bg-secondary active:bg-accent">
        <Text className="text-base font-bold text-secondary-foreground">+</Text>
      </Pressable>
    </View>
  );
}

/**
 * Month grid for picking the lesson date. Arrows move months, the day cells
 * tap to select; days outside the shown month are dimmed, today is
 * highlighted, the selected day is filled.
 */
function MiniCalendar({
  month,
  selected,
  onSelect,
  onMonthChange,
}: {
  month: Date;
  selected: Date;
  onSelect: (day: Date) => void;
  onMonthChange: (next: Date) => void;
}) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  // Grid always starts on Monday (the app's week start).
  const gridStart = addDays(monthStart, -((monthStart.getDay() + 6) % 7));
  const gridEnd = addDays(monthEnd, 6 - ((monthEnd.getDay() + 6) % 7));
  const cells: Date[] = [];
  for (let d = gridStart; d.getTime() <= gridEnd.getTime(); d = addDays(d, 1)) {
    cells.push(d);
  }
  const today = startOfDay(new Date());

  return (
    <View className="rounded-xl border border-border bg-background p-2">
      <View className="mb-1 flex-row items-center justify-between px-1">
        <Pressable
          onPress={() => onMonthChange(addMonths(month, -1))}
          accessibilityLabel="Previous month"
          className="h-8 w-8 items-center justify-center rounded-md bg-secondary active:bg-accent">
          <ChevronLeft size={15} color="hsl(var(--foreground))" as="chevron-left" />
        </Pressable>
        <Text className="text-sm font-bold">{format(month, 'MMMM yyyy')}</Text>
        <Pressable
          onPress={() => onMonthChange(addMonths(month, 1))}
          accessibilityLabel="Next month"
          className="h-8 w-8 items-center justify-center rounded-md bg-secondary active:bg-accent">
          <ChevronRight size={15} color="hsl(var(--foreground))" as="chevron-right" />
        </Pressable>
      </View>

      <View className="flex-row px-1 pb-1">
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} className="flex-1 items-center">
            <Text className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</Text>
          </View>
        ))}
      </View>

      {Array.from({ length: cells.length / 7 }, (_, week) => (
        <View key={week} className="flex-row">
          {cells.slice(week * 7, week * 7 + 7).map((cell) => {
            const inMonth = isSameMonth(cell, month);
            const isSelected = isSameDay(cell, selected);
            const isToday = isSameDay(cell, today);
            return (
              <Pressable
                key={cell.getTime()}
                onPress={() => onSelect(cell)}
                accessibilityLabel={`Pick ${format(cell, 'd MMMM yyyy')}`}
                className="flex-1 items-center py-0.5">
                <View
                  className={cn(
                    'h-8 w-8 items-center justify-center rounded-full',
                    isSelected && 'bg-primary',
                    !isSelected && isToday && 'border border-primary'
                  )}>
                  <Text
                    className={cn(
                      'text-xs font-semibold tabular-nums',
                      isSelected
                        ? 'text-primary-foreground'
                        : isToday
                          ? 'text-primary'
                          : inMonth
                            ? 'text-foreground'
                            : 'text-muted-foreground/50'
                    )}>
                    {format(cell, 'd')}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function AddLessonSheet({ isOpen, onClose, onAdd }: AddLessonSheetProps) {
  const { data } = useCalendar();
  // Modals render outside the themed root view, so the CSS variables must
  // be re-declared here for the picked theme/accent to apply inside.
  const { style: themeStyle } = useTheme();
  const today = startOfDay(new Date());

  const [subject, setSubject] = React.useState('');
  const [date, setDate] = React.useState(today);
  const [calendarMonth, setCalendarMonth] = React.useState(() => startOfMonth(new Date()));
  const [startMinutes, setStartMinutes] = React.useState(8 * 60);
  const [endMinutes, setEndMinutes] = React.useState(9 * 60 + 30);
  const [repeat, setRepeat] = React.useState<'none' | 'weekly'>('none');
  const [color, setColor] = React.useState<string | null>(null);
  const [showDetails, setShowDetails] = React.useState(false);
  const [info, setInfo] = React.useState('');
  const [teacher, setTeacher] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!subject.trim()) return;
    if (endMinutes <= startMinutes) return;
    const start = date.getTime() + startMinutes * 60_000;
    const end = date.getTime() + endMinutes * 60_000;

    setSaving(true);
    try {
      await onAdd({
        start,
        end,
        subject: subject.trim(),
        info: info.trim(),
        teachers: teacher.trim() ? [teacher.trim()] : [],
        locations: location.trim() ? [location.trim()] : [],
        classes: data.timetables[0]?.config.className
          ? [data.timetables[0].config.className]
          : [],
        repeat,
        repeatUntil: repeat === 'weekly' ? format(addWeeks(date, 12), 'yyyy-MM-dd') : undefined,
        color: color ?? undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    // Transparent Modal like the lesson sheet: guarantees the overlay sits
    // above everything (including the status bar on Android) and the scrim
    // can never be lost to class-resolution quirks — hence inline styles.
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close"
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.65)' }]}
        />
        <View className="flex-1 justify-end" style={themeStyle}>
          <View className="rounded-t-2xl border-t border-border bg-card px-4 pb-6 pt-3">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-bold">Add lesson</Text>
              <Pressable
                onPress={onClose}
                className="h-8 w-8 items-center justify-center rounded-md active:bg-accent">
                <X size={18} color="hsl(var(--muted-foreground))" as="x" />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {/* Subject */}
              <Input
                value={subject}
                onChangeText={setSubject}
                placeholder="Subject (e.g. Mathematics)"
                autoCapitalize="words"
                autoComplete="off"
                autoFocus
              />

              {/* Date: full month picker */}
              <MiniCalendar
                month={calendarMonth}
                selected={date}
                onSelect={(day) => setDate(day)}
                onMonthChange={setCalendarMonth}
              />
              <Text className="mt-1.5 px-1 text-xs text-muted-foreground">
                Lesson on {format(date, 'EEEE d MMMM yyyy')}
              </Text>

              {/* Time steppers */}
              <View className="mt-3 flex-row items-center gap-2">
                <Clock size={16} color="hsl(var(--muted-foreground))" as="clock" />
                <Stepper
                  value={startMinutes}
                  onChange={(next) => {
                    setStartMinutes(next);
                    // Keep the duration when the start moves.
                    const duration = endMinutes - startMinutes;
                    setEndMinutes(Math.max(next + STEP_MINUTES, next + duration));
                  }}
                  min={0}
                  max={24 * 60 - STEP_MINUTES}
                  testIDPrefix="Start time"
                />
                <Text className="text-muted-foreground">–</Text>
                <Stepper
                  value={endMinutes}
                  onChange={(next) => setEndMinutes(Math.max(next, startMinutes + STEP_MINUTES))}
                  min={STEP_MINUTES}
                  max={24 * 60}
                  testIDPrefix="End time"
                />
              </View>
              {endMinutes <= startMinutes ? (
                <Text className="mt-1 text-xs text-destructive">End must be after the start.</Text>
              ) : null}

              {/* Color: “Auto” plus a curated swatch row */}
              <View className="mt-3">
                <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Color
                </Text>
                <View className="flex-row flex-wrap items-center gap-2">
                  <Pressable
                    onPress={() => setColor(null)}
                    accessibilityLabel="Automatic color"
                    className={cn(
                      'h-8 items-center justify-center rounded-full border px-3',
                      color === null ? 'border-primary bg-primary/10' : 'border-border bg-secondary'
                    )}>
                    <Text
                      className={cn(
                        'text-xs font-semibold',
                        color === null ? 'text-primary' : 'text-muted-foreground'
                      )}>
                      Auto
                    </Text>
                  </Pressable>
                  {COLOR_CHOICES.map((choice) => (
                    <Pressable
                      key={choice.hex}
                      onPress={() => setColor(choice.hex)}
                      accessibilityLabel={`Color ${choice.name}`}
                      className={cn(
                        'h-8 w-8 items-center justify-center rounded-full border-2',
                        color === choice.hex ? 'border-foreground' : 'border-transparent'
                      )}>
                      <View className="h-5 w-5 rounded-full" style={{ backgroundColor: choice.hex }} />
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Repeat weekly toggle */}
              <Pressable
                onPress={() => setRepeat((current) => (current === 'weekly' ? 'none' : 'weekly'))}
                className="mt-3 flex-row items-center gap-2"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: repeat === 'weekly' }}>
                <View
                  className={cn(
                    'h-5 w-5 items-center justify-center rounded-md border',
                    repeat === 'weekly' ? 'border-primary bg-primary' : 'border-border bg-secondary'
                  )}>
                  {repeat === 'weekly' ? (
                    <Repeat size={12} color="hsl(var(--primary-foreground))" as="repeat" />
                  ) : null}
                </View>
                <Text className="text-sm text-foreground">Repeat weekly for 3 months</Text>
              </Pressable>

              {/* Optional details, collapsed by default */}
              <Pressable
                onPress={() => setShowDetails((current) => !current)}
                className="mt-3 flex-row items-center gap-1 self-start rounded-md px-1 py-1 active:bg-accent">
                {showDetails ? (
                  <ChevronDown size={14} color="hsl(var(--muted-foreground))" as="chevron-down" style={{ transform: [{ rotate: '180deg' }] }} />
                ) : (
                  <ChevronDown size={14} color="hsl(var(--muted-foreground))" as="chevron-down" />
                )}
                <Text className="text-xs font-medium text-muted-foreground">
                  {showDetails ? 'Hide details' : 'Room, teacher, note (optional)'}
                </Text>
              </Pressable>
              {showDetails ? (
                <View className="mt-2 gap-2">
                  <Input
                    value={location}
                    onChangeText={setLocation}
                    placeholder="Room (e.g. B101)"
                    autoCapitalize="characters"
                    autoComplete="off"
                  />
                  <Input
                    value={teacher}
                    onChangeText={setTeacher}
                    placeholder="Teacher"
                    autoCapitalize="words"
                    autoComplete="off"
                  />
                  <Input
                    value={info}
                    onChangeText={setInfo}
                    placeholder="Note (theory, lab…)"
                    autoCapitalize="words"
                    autoComplete="off"
                  />
                </View>
              ) : null}

              <View className="mt-4 flex-row gap-2">
                <Button variant="outline" className="flex-1" onPress={onClose} disabled={saving}>
                  <Text>Cancel</Text>
                </Button>
                <Button
                  className="flex-1"
                  onPress={handleSubmit}
                  disabled={saving || !subject.trim() || endMinutes <= startMinutes}>
                  {saving ? <ActivityIndicator size="small" color="hsl(var(--primary-foreground))" /> : null}
                  <Text>Add lesson</Text>
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
