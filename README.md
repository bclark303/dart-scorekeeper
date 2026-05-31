# Dart Scorekeeper

A local-first X01 dart scoring app built with Next.js.

## Current Version

v0.2.0

## In Development

v0.3.0 — graphical dartboard input and full-screen/tablet scoring refinements.

Current development branch:

```text
feature/graphical-input
```

## Current Features

- 301 / 501 / 701 X01 scoring
- Straight-out and double-out finishes
- Total-turn score entry
- Dart-by-dart score entry
- Singles, doubles, and larger team matches
- Uneven team sizes
- Dummy-score rotation for missing players
- Undo last turn
- Completed leg history
- Dart details in history
- Compact / full scoring layouts
- Game Mode compact navigation during active matches
- Hamburger menu access to setup, settings, stats, history, and feedback during a match
- Safety confirmation before clearing saved match/app settings
- Theme and branding settings
- Local browser save/resume
- Feedback form with diagnostics

## In-Progress Features

- Graphical dartboard input
- Full-screen/tablet board mode
- Full-screen post-scoring summary card
- Cleaner setup defaults for teams and players

## Known Limitations

- X01 is the only supported game type right now.
- Graphical dartboard input is still in development.
- Full-screen/tablet board mode is still being refined.
- No league, tournament, or backend sync yet.
- Match data is stored only in the current browser/device.
- Clearing browser data may erase saved matches.
- Feedback submission requires an internet connection.

## Local Development

Install dependencies:

```powershell
npm install
```

Run the dev server:

```powershell
npm run dev
```

Run the dev server on the local network for tablet testing:

```powershell
npm run dev -- --hostname 0.0.0.0
```

Or bind to a specific LAN IP:

```powershell
npx next dev -H 192.168.2.152
```

Build for production:

```powershell
npm run build
```

Run lint checks:

```powershell
npm run lint
```

## Feedback Form Setup

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_FEEDBACK_ENDPOINT=https://formspree.io/f/your-form-id
```

Do not commit `.env.local`.

The project `.gitignore` should include:

```text
.env*.local
```

## Deployment Notes

This app can be deployed to Vercel as a Next.js project.

Required environment variable on Vercel:

```text
NEXT_PUBLIC_FEEDBACK_ENDPOINT
```

Set it to the Formspree endpoint used for tester feedback.

## Tester Notes

For v0.2.0 testing, focus on:

- Game Mode compact navigation
- Compact scoring layout on tablets/phones
- Hamburger menu access during active matches
- Total-turn score entry
- Dart-by-dart score entry
- Undo behavior
- Checkouts
- Team rotation
- Uneven teams
- Dummy-score rotation
- Feedback form submissions

For the v0.3.0 graphical-input branch, also focus on:

- Graphical dartboard input
- Full-screen board mode
- Full-screen state persistence across turns
- Checkout suggestions during graphical dart entry
- Post-scoring card behavior after normal scores, busts, and checkouts
- Team/player default naming from blank setup fields
