import type { Lesson } from './types';

/**
 * Minimal ICS parser tailored to the output of the AP-WebUntisToICS-Node
 * server (ical-generator). Events carry DTSTART/DTEND with a `TZID`
 * parameter; we intentionally read the wall-clock time so lessons show at
 * their school timetable time regardless of the device timezone.
 */

interface IcsRawEvent {
  uid: string;
  dtstart: Date;
  dtend: Date;
  summary: string;
  location: string;
  description: string;
  allDay: boolean;
}

function decodeScalar(text: string): string {
  const lines = text.split(/\r\n/);
  const unfolded: string[] = [];
  for (const line of lines) {
    if (!unfolded.length || (line[0] !== ' ' && line[0] !== '\t')) {
      unfolded.push(line.trim());
    } else {
      unfolded[unfolded.length - 1] += line.slice(1).trim();
    }
  }
  return unfolded.join('\n');
}

function unescape(value: string): string {
  return value
    .replace(/\\\\/g, '\u0000')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\u0000/g, '\\');
}

function stripZero(value: string): string {
  return value.replace(/^0+(?=\d)/, '');
}

/** `20260921T083000` or `20260921` (all-day) -> local Date */
function parseTimestamp(value: string): Date {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?$/);
  if (!match) {
    throw new Error(`Unsupported ICS timestamp: ${value}`);
  }
  const [, y, m, d, hh = '0', mm = '0', ss = '0'] = match;
  return new Date(+y, +m - 1, +d, +hh, +mm, +ss, 0);
}

function buildEvents(body: string, indexOffset: number): IcsRawEvent[] {
  const events: IcsRawEvent[] = [];
  const blocks = body.split(/(?=BEGIN:VEVENT)/i).filter((b) => /^BEGIN:VEVENT/i.test(b));

  blocks.forEach((block, i) => {
    const props = new Map<string, string[]>();
    for (const line of block.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || /^END:VEVENT$/i.test(trimmed)) continue;
      const colon = trimmed.indexOf(':');
      if (colon === -1) continue;
      const nameLine = trimmed.slice(0, colon).trim().toUpperCase();
      const name = nameLine.split(';')[0];
      const list = props.get(name) ?? [];
      list.push(trimmed.slice(colon + 1));
      props.set(name, list);
    }

    if (!props.has('DTSTART')) return;

    const dtstartRaw = props.get('DTSTART')![0];
    const dtendRaw = props.get('DTEND')?.[0] ?? dtstartRaw;
    const allDay = !dtstartRaw.includes('T');
    const dtstart = parseTimestamp(dtstartRaw);
    const dtend = allDay
      ? new Date(dtstart.getFullYear(), dtstart.getMonth(), dtstart.getDate() + 1, 0, 0, 0, 0)
      : parseTimestamp(dtendRaw);

    const uid = unescape(stripZero((props.get('UID')?.[0] ?? `v${indexOffset + i}`).trim()));
    const summary = unescape((props.get('SUMMARY')?.[0] ?? '').trim());
    const location = unescape((props.get('LOCATION')?.[0] ?? '').trim());
    const description = unescape((props.get('DESCRIPTION')?.[0] ?? '').trim());

    events.push({ uid, dtstart, dtend, summary, location, description, allDay });
  });

  return events;
}

function splitSubject(summary: string): { subject: string; info: string } {
  const match = summary.match(/^(.+?)\s+\((.+)\)$/);
  if (match) return { subject: match[1].trim(), info: match[2].trim() };
  return { subject: summary.trim() || 'No subject', info: '' };
}

function parseDescription(
  description: string,
  fallbackSubject: string
): { teachers: string[]; classes: string[]; info: string } {
  const lines = description
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^-{2,}$/.test(line));

  const teachers = lines[0] ? lines[0].split(/,\s*/).filter(Boolean) : [];
  const classesLine = lines.findIndex((line) => !line.includes('ℹ️') && line !== lines[0]);
  const classes =
    classesLine !== -1 && classesLine < lines.length
      ? (lines[classesLine] ?? '').split(/\s*\/\s*/).filter(Boolean)
      : [];
  const infoLine = lines.find((line) => line.includes('ℹ️'));
  const info = infoLine ? infoLine.replace(/ℹ️\s*/g, '').trim() : '';
  return { teachers, classes, info: info || '' };
}

export function parseIcs(icsText: string): Lesson[] {
  const unfolded = decodeScalar(icsText).trim();
  const events = buildEvents(unfolded, 0);
  const lessons: Lesson[] = [];

  for (const event of events) {
    if (event.allDay || event.dtend.getTime() <= event.dtstart.getTime()) continue;

    const { subject, info: infoFromSummary } = splitSubject(event.summary);
    const { teachers, classes, info: infoFromDescription } = parseDescription(
      event.description,
      subject
    );

    let info = infoFromSummary || infoFromDescription;
    // The server prints "ℹ️ {info}" in the description but leaves the info out
    // of the summary when empty; avoid duplication.
    if (infoFromSummary && infoFromDescription === infoFromSummary) {
      info = infoFromSummary;
    }

    lessons.push({
      uid: event.uid,
      start: event.dtstart.getTime(),
      end: event.dtend.getTime(),
      subject,
      info,
      teachers,
      locations: event.location
        .split(/\s*\/\s*/)
        .map((l) => l.trim())
        .filter(Boolean),
      classes,
    });
  }

  return lessons.sort((a, b) => a.start - b.start);
}