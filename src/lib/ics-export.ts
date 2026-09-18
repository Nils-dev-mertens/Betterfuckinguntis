import { format } from 'date-fns';
import { Platform } from 'react-native';
import { EncodingType, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Lesson } from './types';

/**
 * Minimal RFC 5545 calendar writer tailored to timetable export: local
 * wall-clock times with a Europe/Brussels TZID (school time), proper text
 * escaping, and 75-character line folding.
 */

const TZID = 'Europe/Brussels';

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Local timestamp in ICS "floating" form with TZID, e.g. 20261005T083000. */
function toIcsTimestamp(epochMs: number): string {
  return format(epochMs, "yyyyMMdd'T'HHmmss");
}

/** RFC 5545 §3.1: lines longer than 75 octets are folded with CRLF + space. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return parts.join('\r\n');
}

export function lessonsToIcs(lessons: Lesson[], calendarName = 'Timetable'): string {
  const stamp = toIcsTimestamp(Date.now());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Actually Usable Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    `X-WR-TIMEZONE:${TZID}`,
  ];

  const sorted = [...lessons].sort((a, b) => a.start - b.start);

  for (const lesson of sorted) {
    const descriptionParts = [
      lesson.teachers.length > 0 ? `Teachers: ${lesson.teachers.join(', ')}` : null,
      lesson.classes.length > 0 ? `Classes: ${lesson.classes.join(' / ')}` : null,
      lesson.manual ? 'Added manually in Actually Usable Calendar' : null,
    ].filter(Boolean) as string[];
    if (lesson.info) descriptionParts.unshift(lesson.info);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeText(lesson.uid)}@actually-usable-calendar`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${TZID}:${toIcsTimestamp(lesson.start)}`,
      `DTEND;TZID=${TZID}:${toIcsTimestamp(lesson.end)}`,
      `SUMMARY:${escapeText(lesson.subject + (lesson.info ? ` (${lesson.info})` : ''))}`,
      `LOCATION:${escapeText(lesson.locations.join(' / '))}`,
      `DESCRIPTION:${escapeText(descriptionParts.join('\n'))}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** Downloads (web) or opens the native share sheet (Android/iOS) with the ICS. */
export async function downloadLessonsIcs(lessons: Lesson[], calendarName?: string): Promise<void> {
  const ics = lessonsToIcs(lessons, calendarName);
  const name = `timetable-${format(new Date(), 'yyyy-MM-dd')}.ics`;

  if (Platform.OS === 'web') {
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
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
  file.write(ics, { encoding: EncodingType.UTF8 });
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/calendar',
    dialogTitle: 'Export timetable',
  });
}
