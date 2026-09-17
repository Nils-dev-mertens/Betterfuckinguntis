# Actually Usable Calendar

A school timetable app: syncs from the [AP-WebUntisToICS-Node](https://github.com/ap-laboratoria/AP-WebUntisToICS-Node) server, stores everything offline, and lets you remove any class — hidden for all future weeks.

- **React Native + Expo SDK 57** (expo-router) and **bun**
- **React Native Reusables** (RNR) components + **NativeWind v4**, dark theme first
- Syncs once, then works fully offline (AsyncStorage)
- Multi-week mode / agenda view, hide-and-restore per class

## Setup

```sh
bun install
bun start              # dev server (scan QR for the Expo Go / dev build)
```

## Web

```sh
bun run web:build      # expo export --platform web  → dist/
bun run web:serve      # serves dist/ on http://localhost:8080
```

The web app talks to the WebUntis provider through a same-origin proxy at
`/proxy?url=<encoded>` (the provider sends no CORS headers, so the proxy is
required in the browser). Android/iOS hit the provider directly.

## Data source

| Endpoint | Used for |
| --- | --- |
| `GET /schoolyears` | available school years |
| `GET /classes?start=&end=` | class list for a year |
| `GET /calendar?class=<id>&start=&end=` | ICS timetable for a class |

The default server URL is `https://ap.webuntis.viovyx.com`; you can point to
your own instance in the in-app Setup screen.

## Commands

```sh
bunx tsc --noEmit        # typecheck (app)
bunx tsc -p server       # typecheck (web server)
bun run typecheck        # both
bunx expo run:android    # native build
```

## Layout

- `src/app/` — routes: setup wizard, calendar, settings
- `src/components/` — week grid, agenda, lesson sheet, header
- `src/lib/` — data layer: ICS parser, sync, storage, hidden-rule logic
- `src/context/calendar-context.tsx` — app state + persistence
- `src/components/ui/` — RNR primitives
- `server/` — static web server with the CORS proxy for the provider