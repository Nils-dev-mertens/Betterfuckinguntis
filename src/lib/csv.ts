import { format } from 'date-fns';
import { Platform } from 'react-native';
import { EncodingType, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Lesson } from './types';

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Renders lessons as CSV rows sorted by start time. Columns match what a
 * spreadsheet user expects: date, day, time range, subject, info, teachers,
 * rooms and the groups the lesson covers.
 */
export function lessonsToCsv(lessons: Lesson[]): string {
  const header = ['Date', 'Day', 'Start', 'End', 'Subject', 'Info', 'Teacher', 'Room', 'Class'];
  const rows: string[][] = [header];

  const sorted = [...lessons].sort(
    (a, b) => a.start - b.start || a.end - b.end || a.subject.localeCompare(b.subject)
  );

  for (const lesson of sorted) {
    rows.push([
      format(lesson.start, 'yyyy-MM-dd'),
      format(lesson.start, 'EEEE'),
      format(lesson.start, 'HH:mm'),
      format(lesson.end, 'HH:mm'),
      lesson.subject,
      lesson.info,
      lesson.teachers.join(' / '),
      lesson.locations.join(' / '),
      lesson.classes.join(' + '),
    ]);
  }

  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

/** Downloads (web) or opens the native share sheet (Android/iOS) with the CSV. */
export async function downloadLessonsCsv(lessons: Lesson[]): Promise<void> {
  const csv = lessonsToCsv(lessons);
  const name = `timetable-${format(new Date(), 'yyyy-MM-dd')}.csv`;

  if (Platform.OS === 'web') {
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return;
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  const file = new File(Paths.cache, name);
  file.create({ intermediates: true, overwrite: true });
  file.write(csv, { encoding: EncodingType.UTF8 });
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export timetable' });
}