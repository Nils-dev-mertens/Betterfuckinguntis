import * as React from 'react';
import { format, addDays, startOfDay, isSameDay, addWeeks } from 'date-fns';
import {
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { ChevronDown, ChevronUp, Clock, Repeat, X } from 'lucide-react-native';
import { useCalendar } from '@/context/calendar-context';
import type { Lesson } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const STEP_MINUTES = 15;

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

export function AddLessonSheet({ isOpen, onClose, onAdd }: AddLessonSheetProps) {
  const { data } = useCalendar();
  const today = startOfDay(new Date());

  const [subject, setSubject] = React.useState('');
  const [date, setDate] = React.useState(today);
  const [startMinutes, setStartMinutes] = React.useState(8 * 60);
  const [endMinutes, setEndMinutes] = React.useState(9 * 60 + 30);
  const [repeat, setRepeat] = React.useState<'none' | 'weekly'>('none');
  const [showDetails, setShowDetails] = React.useState(false);
  const [info, setInfo] = React.useState('');
  const [teacher, setTeacher] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const dateChips = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(today, i)),
    [today]
  );

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
        repeatUntil:
          repeat === 'weekly' ? format(addWeeks(date, 12), 'yyyy-MM-dd') : undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <Pressable onPress={onClose} className="flex-1" accessibilityLabel="Close" />
        <View className="rounded-t-2xl border-t border-border bg-card px-4 pb-6 pt-3">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-bold">Add lesson</Text>
            <Pressable
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-md active:bg-accent">
              <X size={18} color="hsl(var(--muted-foreground))" />
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

            {/* Date chips: today + next 6 days */}
            <View className="mt-3 flex-row flex-wrap gap-1.5">
              {dateChips.map((chip) => {
                const active = isSameDay(chip, date);
                return (
                  <Pressable
                    key={chip.getTime()}
                    onPress={() => setDate(chip)}
                    className={cn(
                      'rounded-md border px-2.5 py-1.5',
                      active ? 'border-primary bg-primary/15' : 'border-border bg-secondary active:bg-accent'
                    )}>
                    <Text
                      className={cn(
                        'text-xs font-semibold',
                        active ? 'text-primary' : 'text-muted-foreground'
                      )}>
                      {isSameDay(chip, today) ? 'Today' : format(chip, 'EEE d')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Time steppers */}
            <View className="mt-3 flex-row items-center gap-2">
              <Clock size={16} color="hsl(var(--muted-foreground))" />
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

            {/* Repeat weekly toggle */}
            <Pressable
              onPress={() => setRepeat((current) => (current === 'weekly' ? 'none' : 'weekly'))}
              className="mt-2.5 flex-row items-center gap-2"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: repeat === 'weekly' }}>
              <View
                className={cn(
                  'h-5 w-5 items-center justify-center rounded-md border',
                  repeat === 'weekly' ? 'border-primary bg-primary' : 'border-border bg-secondary'
                )}>
                {repeat === 'weekly' ? (
                  <Repeat size={12} color="hsl(var(--primary-foreground))" />
                ) : null}
              </View>
              <Text className="text-sm text-foreground">Repeat weekly for 3 months</Text>
            </Pressable>

            {/* Optional details, collapsed by default */}
            <Pressable
              onPress={() => setShowDetails((current) => !current)}
              className="mt-3 flex-row items-center gap-1 self-start rounded-md px-1 py-1 active:bg-accent">
              {showDetails ? (
                <ChevronUp size={14} color="hsl(var(--muted-foreground))" />
              ) : (
                <ChevronDown size={14} color="hsl(var(--muted-foreground))" />
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
      </KeyboardAvoidingView>
    </View>
  );
}
