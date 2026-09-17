import * as React from 'react';
import { format, addDays, startOfDay } from 'date-fns';
import { View, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { X, Calendar, Clock, MapPin, User, BookOpen } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { useCalendar } from '@/context/calendar-context';
import type { Lesson } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

function timeOptions() {
  const opts: { value: string; label: string }[] = [];
  for (const h of HOURS) {
    for (const m of MINUTES) {
      const v = `${h}:${m}`;
      opts.push({ value: v, label: v });
    }
  }
  return opts;
}

const TIME_OPTIONS = timeOptions();

interface AddLessonSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (lesson: Omit<Lesson, 'uid' | 'manual'>) => Promise<void>;
}

export function AddLessonSheet({ isOpen, onClose, onAdd }: AddLessonSheetProps) {
  if (!isOpen) return null;

  const { data } = useCalendar();
  const today = startOfDay(new Date());

  const [subject, setSubject] = React.useState('');
  const [info, setInfo] = React.useState('');
  const [date, setDate] = React.useState(format(today, 'yyyy-MM-dd'));
  const [startTime, setStartTime] = React.useState('08:00');
  const [endTime, setEndTime] = React.useState('09:30');
  const [teacher, setTeacher] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [className, setClassName] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  // Preset class from first timetable if available
  React.useEffect(() => {
    if (data.timetables[0]?.config.className) {
      setClassName(data.timetables[0].config.className);
    }
  }, [data.timetables]);

  const handleSubmit = async () => {
    if (!subject.trim()) return;
    const start = new Date(`${date}T${startTime}`).getTime();
    const end = new Date(`${date}T${endTime}`).getTime();
    if (end <= start) return;

    setSaving(true);
    try {
      await onAdd({
        start,
        end,
        subject: subject.trim(),
        info: info.trim(),
        teachers: teacher.trim() ? [teacher.trim()] : [],
        locations: location.trim() ? [location.trim()] : [],
        classes: className.trim() ? [className.trim()] : [],
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
        className="flex-1 bg-background/95"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View className="flex-1 items-center justify-center p-4">
          <View className="w-full max-w-md rounded-2xl bg-card shadow-2xl">
            <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
              <Text className="text-lg font-bold">Add Lesson</Text>
              <Pressable onPress={onClose} className="h-8 w-8 items-center justify-center rounded-md active:bg-accent">
                <X size={18} color="hsl(var(--muted-foreground))" />
              </Pressable>
            </View>

            <ScrollView className="p-4 gap-4" contentContainerStyle={{ paddingBottom: 24 }}>
              <View className="gap-2">
                <Text className="text-sm font-medium">Subject</Text>
                <Input
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="e.g. Mathematics"
                  autoCapitalize="words"
                  autoComplete="off"
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-medium">Info (optional)</Text>
                <Input
                  value={info}
                  onChangeText={setInfo}
                  placeholder="e.g. Theory, Lab, Exercise"
                  autoCapitalize="words"
                  autoComplete="off"
                />
              </View>

              <Separator />

              <View className="gap-2">
                <Text className="text-sm font-medium">Date</Text>
                <Input
                  value={date}
                  onChangeText={setDate}
                  editable={false}
                  className="bg-secondary"
                />
                <Text className="text-xs text-muted-foreground">Tap to pick a date</Text>
              </View>

              <View className="flex-row gap-3">
                <View className="flex-1 gap-2">
                  <Text className="text-sm font-medium">Start time</Text>
                  <Select value={startTime as any} onValueChange={(opt) => opt && setStartTime(opt.value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Start" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((opt) => (
                        // @ts-ignore - SelectItem type expects label prop but we use children
                        <SelectItem key={opt.value} value={opt.value} className="py-2" asChild>
                          <Text>{opt.label}</Text>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </View>
                <View className="flex-1 gap-2">
                  <Text className="text-sm font-medium">End time</Text>
                  <Select value={endTime as any} onValueChange={(opt) => opt && setEndTime(opt.value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="End" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((opt) => (
                        // @ts-ignore - SelectItem type expects label prop but we use children
                        <SelectItem key={opt.value} value={opt.value} className="py-2" asChild>
                          <Text>{opt.label}</Text>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </View>
              </View>

              <Separator />

              <View className="gap-2">
                <Text className="text-sm font-medium">Teacher (optional)</Text>
                <Input
                  value={teacher}
                  onChangeText={setTeacher}
                  placeholder="e.g. Dr. Smith"
                  autoCapitalize="words"
                  autoComplete="off"
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-medium">Room (optional)</Text>
                <Input
                  value={location}
                  onChangeText={setLocation}
                  placeholder="e.g. Room 101"
                  autoCapitalize="words"
                  autoComplete="off"
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-medium">Class / Group (optional)</Text>
                <Input
                  value={className}
                  onChangeText={setClassName}
                  placeholder="e.g. 1A"
                  autoCapitalize="characters"
                  autoComplete="off"
                />
              </View>

              <View className="mt-4 flex-row gap-2">
                <Button variant="outline" className="flex-1" onPress={onClose} disabled={saving}>
                  <Text>Cancel</Text>
                </Button>
                <Button className="flex-1" onPress={handleSubmit} disabled={saving || !subject.trim()}>
                  {saving ? <ActivityIndicator size="small" color="hsl(var(--primary-foreground))" /> : null}
                  <Text>Add lesson</Text>
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

