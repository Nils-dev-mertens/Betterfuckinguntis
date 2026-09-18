# Actually Usable Calendar

A school timetable app for AP Hogeschool students: fetches lessons **directly from the WebUntis REST API** (the same source the [AP-WebUntisToICS-Node](https://github.com/Viovyx/AP-WebUntisToICS-Node) server uses), stores everything offline, and stays out of your way.

- **React Native + Expo SDK 57** (expo-router), **bun**
- **React Native Reusables** (RNR) components + **NativeWind v4**, dark theme
- Syncs once, then works fully offline (AsyncStorage)
- **No server needed on mobile** — Android/iOS call WebUntis directly

## Features

- **3 / 5 / 7-day grid + agenda list** — columns always fit the screen width; the full-week view uses compact cards. Every grid mode has an hour axis with a red "now" bubble, and auto-scrolls to the current time on open.
- **Now & Next banner** — the lesson in progress (with minutes left) and the next one up, tappable for details.
- **Multiple classes** — watch several classes (even across school years), view them combined (default) or filter to one with the chip row.
- **Manual lessons** — add your own lessons with date chips and time steppers, optionally repeated weekly; delete a single lesson, a whole series, or from a date onward. Synced lessons can be hidden instead (per weekly slot, restorable in Settings).
- **ICS + CSV export** — share your timetable as a calendar file (Google Calendar, ICSx⁵, …) or spreadsheet.
- **School-year aware** — every class belongs to a year (Sept–Sept); the year is shown while picking classes and in Settings, and empty states point you there when data is missing.

## Setup

```sh
bun install
bun start              # dev server (scan QR for Expo Go / dev build)
```

The first launch walks you through: WebUntis server → school year → class.

## Web

```sh
bun run web:build      # expo export --platform web  → dist/
bun run web:serve      # serves dist/ on http://localhost:8080
```

Browsers require CORS preflight approval for the API's custom
`anonymous-school` header, which WebUntis does not grant. The web build
therefore goes through the same-origin proxy at `/proxy?url=<encoded>`
(which forwards that header) served by `web:serve`. Running under `bun start`
alone has no proxy — you'll get HTML instead of JSON.
Android/iOS are unaffected and hit the API directly.

## Data source

Base URL (the `API_BASE_URL` from the reference project's `.env.example`):

```
https://ap.webuntis.com/WebUntis/api/rest/view/v1
```

The school tenant is selected with the `anonymous-school: ap` request header.
Responses are cached in memory with the reference server's TTLs: school
years / class lists for 7 days, timetable entries for 15 minutes.

| Endpoint | Used for |
| --- | --- |
| `GET /schoolyears` | available school years |
| `GET /app/data` | current school year (default date range) |
| `GET /timetable/filter?resourceType=CLASS&start=&end=` | class list for a year |
| `GET /timetable/entries?resourceType=CLASS&start=&end=&resources=<id>` | timetable entries |

Lessons are mapped from the raw grid entries (positions 1–7 → subject /
teachers / rooms / info / classes) the same way the reference server does,
including merging same-slot lessons and subject filtering (hidden subjects
are excluded at sync time).

## Builds & updates

The app is distributed as a self-hosted APK: the landing page (`website/index.html`, plain HTML, no build step) offers the download; install once, and receive JS-only fixes silently via [EAS Update](https://docs.expo.dev/eas-update/introduction/)
(no reinstall). Native changes require a new APK; the `fingerprint`
runtime-version policy guarantees devices only get compatible updates.

The landing page resolves the newest release at runtime via the GitHub API,
so its download button always points at the latest APK without redeploying.
Host it anywhere static files work — e.g. with the bundled Dockerfile:

```sh
docker build -t betteruntis-site .
docker run -d -p 8080:80 betteruntis-site     # → http://localhost:8080
bun run site:serve                            # local preview without Docker
```

| Pipeline | Trigger | Output |
| --- | --- | --- |
| `update.yml` | push to `main` | EAS OTA update (JS-only, typechecked first) |
| `release.yml` | tag `v*.*.*` | APK built on EAS cloud, attached to a GitHub Release (= download button target) |

Both need an `EXPO_TOKEN` repo secret (create at expo.dev/settings/access-tokens).

Manual equivalents:

```sh
eas update --auto --branch production                     # push an OTA update
eas build -p android --profile apk                       # build APK on EAS cloud (same as the release pipeline)
```

In-app, Settings → "Check for updates" fetches and applies OTA updates
immediately; otherwise they apply on the next launch.

## Commands

```sh
bun run typecheck        # typecheck app + server
bunx expo run:android    # native build
```

## Layout

- `src/app/` — routes: setup wizard, calendar, settings
- `src/components/` — week grid (3/5/7-day), agenda, now banner, lesson & add-lesson sheets
- `src/lib/` — data layer: WebUntis client + mappers (`webuntis.ts`), sync, storage, ICS/CSV export, hidden-rule logic
- `src/context/calendar-context.tsx` — app state, repeat expansion, persistence
- `src/components/ui/` — RNR primitives
- `server/` — static web server with the CORS proxy (web only; mobile needs no server)
