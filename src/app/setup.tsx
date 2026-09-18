import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Search, School, Check, RefreshCw } from 'lucide-react-native';
import { useCalendar } from '@/context/calendar-context';
import { DEFAULT_BASE_URL, fetchClasses, fetchSchoolyears, normalizeBaseUrl } from '@/lib/sync';
import type { SchoolClass, SchoolYear, SyncConfig } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';

type Step = 'provider' | 'schoolyear' | 'class';

export default function SetupScreen() {
  const router = useRouter();
  const { data, addClass, syncing } = useCalendar();

  const addingAnother = data.timetables.length > 0;

  const [step, setStep] = React.useState<Step>('provider');
  const [baseUrl, setBaseUrl] = React.useState(DEFAULT_BASE_URL);
  const [schoolyears, setSchoolyears] = React.useState<SchoolYear[] | null>(null);
  const [selectedSchoolYear, setSelectedSchoolYear] = React.useState<SchoolYear | null>(null);
  const [classes, setClasses] = React.useState<SchoolClass[] | null>(null);
  const [classQuery, setClassQuery] = React.useState('');
  const [savingClass, setSavingClass] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  // Only clear the status bar on native; web gets no extra top gap.
  const insets = useSafeAreaInsets();

  /** Shown while picking a class so the year context is always visible. */
  const yearHint = selectedSchoolYear
    ? selectedSchoolYear.name
    : schoolyears
      ? 'Current school year (server default)'
      : null;

  const goBack = React.useCallback(() => {
    setError(null);
    if (step === 'schoolyear') setStep('provider');
    else if (step === 'class') {
      setClasses(null);
      setStep('schoolyear');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [step, router]);

  const loadSchoolyears = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSchoolyears(baseUrl);
      setSchoolyears(result);
      setStep('schoolyear');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the WebUntis server.');
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  const loadClasses = React.useCallback(
    async (schoolYear: SchoolYear | null) => {
      setLoading(true);
      setError(null);
      try {
        setClasses(null);
        const result = await fetchClasses(baseUrl, schoolYear?.dateRange);
        setClasses(result);
        setSelectedSchoolYear(schoolYear);
        setStep('class');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load classes.');
      } finally {
        setLoading(false);
      }
    },
    [baseUrl]
  );

  const pickClass = React.useCallback(
    async (schoolClass: SchoolClass) => {
      setSavingClass(schoolClass.id);
      setError(null);
      const config: SyncConfig = {
        baseUrl: normalizeBaseUrl(baseUrl),
        classId: schoolClass.id,
        className: schoolClass.name,
        schoolYear: selectedSchoolYear?.name,
        dateRange: selectedSchoolYear?.dateRange,
      };
      const outcome = await addClass(config);
      setSavingClass(null);
      if (outcome.ok) {
        if (data.timetables.length > 0 && router.canGoBack()) {
          router.back();
        } else {
          router.replace('/');
        }
      } else {
        setError(outcome.error ?? 'Could not sync this class.');
      }
    },
    [baseUrl, selectedSchoolYear, addClass, data.timetables.length, router]
  );

  const filteredClasses = React.useMemo(() => {
    if (!classes) return [];
    const query = classQuery.trim().toLowerCase();
    if (!query) return classes;
    return classes.filter((c) => c.name.toLowerCase().includes(query));
  }, [classes, classQuery]);

  /**
   * The school year that is most relevant right now: the one with the latest
   * start that has not ended yet. At a year boundary this is the upcoming
   * year; mid-year it is the current one.
   */
  const recommendedYear = React.useMemo(() => {
    if (!schoolyears?.length) return null;
    const now = Date.now();
    const active = schoolyears
      .filter((sy) => now < new Date(`${sy.dateRange.end}T23:59:59`).getTime())
      .sort((a, b) => a.dateRange.start.localeCompare(b.dateRange.start));
    return active[active.length - 1] ?? null;
  }, [schoolyears]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        className="flex-row items-center gap-3 px-4 pb-2 pt-3"
        style={{ paddingTop: Math.max(insets.top, 12) }}>
        <Pressable
          onPress={goBack}
          accessibilityLabel="Back"
          className="h-9 w-9 items-center justify-center rounded-md bg-secondary active:bg-accent">
          <ArrowLeft size={17} color="hsl(var(--foreground))" />
        </Pressable>
        <View>
          <Text className="text-lg font-bold">Actually Usable Calendar</Text>
          <Text className="text-xs text-muted-foreground">
            {addingAnother
              ? 'Add a class'
              : `Step ${step === 'provider' ? '1' : step === 'schoolyear' ? '2' : '3'} of 3`}
            {yearHint && step === 'class' ? ` · ${yearHint}` : ''}
          </Text>
        </View>
      </View>

      <Separator />

      {step === 'provider' && (
        <View className="px-4 py-6">
          <Text className="text-sm font-semibold">WebUntis server</Text>
          <Text className="mt-1 text-sm leading-5 text-muted-foreground">
            Your timetable is fetched straight from the WebUntis API of your school. Keep the default
            AP tenant, or point to another tenant's API root.
          </Text>
          <Input
            value={baseUrl}
            onChangeText={setBaseUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="https://ap.webuntis.com/WebUntis/api/rest/view/v1"
            className="mt-4"
            onSubmitEditing={() => void loadSchoolyears()}
          />
          {error ? (
            <Text className="mt-3 text-xs text-destructive">{error}</Text>
          ) : null}
          <Button
            className="mt-6"
            size="lg"
            disabled={loading || !baseUrl.trim()}
            onPress={() => void loadSchoolyears()}>
            {loading ? <ActivityIndicator size="small" color="hsl(var(--primary-foreground))" /> : null}
            <Text>Continue</Text>
          </Button>
          {data.timetables.length > 0 ? (
            <Text className="mt-4 text-center text-xs text-muted-foreground">
              {addingAnother
                ? `Watching ${data.timetables.length} class${data.timetables.length === 1 ? '' : 'es'} — picking one adds it to your calendar.`
                : 'No class synced yet.'}
            </Text>
          ) : null}
        </View>
      )}

      {step === 'schoolyear' && (
        <View className="px-4 py-6">
          {loading || !schoolyears ? (
            <View className="items-center py-12">
              <ActivityIndicator color="hsl(var(--primary))" />
            </View>
          ) : (
            <>
              <Text className="text-sm font-semibold">School year</Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                Pick the year whose timetable you need. A school year runs from September to the
                September of the next year, and every class belongs to exactly one year.
              </Text>
              <View className="mt-4 gap-2">
                <SchoolyearRow
                  label="Server default (current school year)"
                  detail="Recommended — what the server picks automatically"
                  selected={selectedSchoolYear === null}
                  onPress={() => void loadClasses(null)}
                />
                {schoolyears.map((schoolYear) => (
                  <SchoolyearRow
                    key={schoolYear.id}
                    label={schoolYear.name}
                    detail={`${schoolYear.dateRange.start} – ${schoolYear.dateRange.end}${
                      recommendedYear?.id === schoolYear.id ? ' · upcoming/active year' : ''
                    }`}
                    recommended={recommendedYear?.id === schoolYear.id}
                    selected={selectedSchoolYear?.id === schoolYear.id}
                    onPress={() => void loadClasses(schoolYear)}
                  />
                ))}
              </View>
              {error ? (
                <Text className="mt-3 text-xs text-destructive">{error}</Text>
              ) : null}
            </>
          )}
        </View>
      )}

      {step === 'class' && (
        <View className="flex-1 px-4 pt-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold">Pick your class</Text>
            {selectedSchoolYear ? (
              <View className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1">
                <Text className="text-xs font-bold text-primary">
                  {selectedSchoolYear.name} · {selectedSchoolYear.dateRange.start.slice(0, 4)}/
                  {selectedSchoolYear.dateRange.end.slice(2, 4)}
                </Text>
              </View>
            ) : (
              <Text className="text-xs text-muted-foreground">Current school year</Text>
            )}
          </View>
          <Text className="mt-1 text-sm text-muted-foreground">
            Tapping a class syncs its schedule to this device for offline use. Classes only exist
            within one school year (Sept–Sept); switch the year above if yours is missing.
          </Text>

          <View className="mt-4 flex-row items-center gap-2 rounded-md border border-border bg-secondary px-3">
            <Search size={16} color="hsl(var(--muted-foreground))" />
            <Input
              value={classQuery}
              onChangeText={setClassQuery}
              placeholder={classes ? `Search ${classes.length} classes…` : 'Search classes…'}
              autoCapitalize="characters"
              autoCorrect={false}
              className="h-10 flex-1 border-0 bg-transparent px-0 shadow-none dark:bg-transparent"
            />
          </View>

          {loading ? (
            <View className="items-center py-12">
              <ActivityIndicator color="hsl(var(--primary))" />
            </View>
          ) : (
            <FlatList
              className="mt-3"
              data={filteredClasses}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View className="items-center py-12">
                  <Text className="text-sm text-muted-foreground">
                    {classes ? 'No class matches your search.' : 'Waiting to load classes…'}
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => void pickClass(item)}
                  disabled={Boolean(savingClass)}
                  className="flex-row items-center justify-between rounded-lg border border-border bg-card px-4 py-3 active:bg-accent">
                  <View className="flex-row items-center gap-3">
                    <View className="h-9 w-9 items-center justify-center rounded-md bg-secondary">
                      <School size={16} color="hsl(var(--muted-foreground))" />
                    </View>
                    <Text className="text-sm font-semibold">{item.name}</Text>
                  </View>
                  {savingClass === item.id ? (
                    <ActivityIndicator size="small" color="hsl(var(--primary))" />
                  ) : (
                    <Check size={16} color="hsl(var(--muted-foreground))" />
                  )}
                </Pressable>
              )}
            />
          )}
          {error ? (
            <View className="pb-4">
              <Text className="text-xs text-destructive">{error}</Text>
              <Button variant="outline" size="sm" className="mt-2" onPress={() => setError(null)}>
                <RefreshCw size={14} color="hsl(var(--foreground))" />
                <Text>Retry</Text>
              </Button>
            </View>
          ) : null}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function SchoolyearRow({
  label,
  detail,
  selected,
  recommended,
  onPress,
}: {
  label: string;
  detail: string;
  selected: boolean;
  recommended?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center justify-between rounded-lg border px-4 py-3',
        selected ? 'border-primary bg-primary/10' : 'border-border bg-card active:bg-accent'
      )}>
      <View className="flex-1 pr-3">
        <Text className={cn('text-sm font-semibold', selected && 'text-primary')}>{label}</Text>
        <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
          {recommended && !selected ? '★ ' : ''}
          {detail}
        </Text>
      </View>
      <View
        className={cn(
          'h-5 w-5 items-center justify-center rounded-full border',
          selected ? 'border-primary bg-primary' : 'border-border'
        )}>
        {selected ? <Check size={12} color="hsl(var(--primary-foreground))" /> : null}
      </View>
    </Pressable>
  );
}